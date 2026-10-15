/**
 * Dulce Arte - Panel de Administración
 * Backend: Supabase REST API (compatible con Vercel / hosting estático)
 */

// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================
const SUPABASE_URL = 'https://chrsuxwrtgkzabvxsiqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNocnN1eHdydGdremFidnhzaXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0OTM0MzUsImV4cCI6MjEwNzA2OTQzNX0.p2A-SLtNtBRIBUPudPhdNMRDpwi6Qz-eedZiuFuODGo';

const MAX_DAILY_ORDERS = 8;
const DELIVERY_HOURS = '17:00 a 20:00 hs';

// ============================================================
// CLIENTE SUPABASE (REST API nativo, sin dependencias)
// ============================================================
class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
    }

    headers(extras = {}) {
        return {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...extras
        };
    }

    async from(table) {
        return new SupabaseQuery(this, table);
    }

    async rpc(fn, params = {}) {
        const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(params)
        });
        return res.json();
    }
}

class SupabaseQuery {
    constructor(client, table) {
        this.client = client;
        this.table = table;
        this._filters = [];
        this._select = '*';
        this._order = null;
        this._method = 'GET';
        this._body = null;
        this._single = false;
        this._prefer = 'return=representation';
    }

    select(cols = '*') { this._select = cols; return this; }
    eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; }
    neq(col, val) { this._filters.push(`${col}=neq.${val}`); return this; }
    gte(col, val) { this._filters.push(`${col}=gte.${val}`); return this; }
    lte(col, val) { this._filters.push(`${col}=lte.${val}`); return this; }
    order(col, { ascending = true } = {}) { this._order = `${col}.${ascending ? 'asc' : 'desc'}`; return this; }
    single() { this._single = true; return this; }

    insert(data) {
        this._method = 'POST';
        this._body = Array.isArray(data) ? data : [data];
        return this;
    }

    update(data) {
        this._method = 'PATCH';
        this._body = data;
        return this;
    }

    delete() {
        this._method = 'DELETE';
        return this;
    }

    async execute() {
        let url = `${this.client.url}/rest/v1/${this.table}?select=${encodeURIComponent(this._select)}`;

        if (this._filters.length) url += '&' + this._filters.join('&');
        if (this._order) url += `&order=${this._order}`;

        const headers = this.client.headers({ 'Prefer': this._prefer });

        const opts = { method: this._method, headers };
        if (this._body !== null) opts.body = JSON.stringify(this._body);

        const res = await fetch(url, opts);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { data: null, error: err };
        }

        if (res.status === 204) return { data: [], error: null };

        const data = await res.json();
        if (this._single) return { data: Array.isArray(data) ? data[0] : data, error: null };
        return { data, error: null };
    }

    // Alias para compatibilidad con patrones supabase-js
    then(resolve, reject) {
        return this.execute().then(resolve, reject);
    }
}

const db = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// UTILIDADES DE BASE DE DATOS
// ============================================================
async function dbSelect(table, select = '*', filters = {}, orderBy = null) {
    const q = new SupabaseQuery(db, table);
    q.select(select);
    for (const [col, val] of Object.entries(filters)) q.eq(col, val);
    if (orderBy) q.order(orderBy.col, { ascending: orderBy.asc ?? true });
    return q.execute();
}

async function dbInsert(table, data) {
    const q = new SupabaseQuery(db, table);
    q.insert(data);
    return q.execute();
}

async function dbUpdate(table, data, filters = {}) {
    const q = new SupabaseQuery(db, table);
    q.update(data);
    for (const [col, val] of Object.entries(filters)) q.eq(col, val);
    return q.execute();
}

async function dbDelete(table, filters = {}) {
    const q = new SupabaseQuery(db, table);
    q.delete();
    for (const [col, val] of Object.entries(filters)) q.eq(col, val);
    return q.execute();
}

// ============================================================
// LÓGICA DE NEGOCIO: RECÁLCULO EN CASCADA (antes CostCalculator.php)
// ============================================================
async function recalculateProductPricing(productId) {
    // Obtener datos del producto
    const { data: products } = await dbSelect('products', 'id,profit_margin_percentage,fixed_overhead_percentage', { id: productId });
    if (!products || products.length === 0) return null;
    const product = products[0];

    // Obtener items del escandallo con costo de ingrediente
    const { data: recipeItems } = await dbSelect(
        'product_recipes',
        'quantity_required,ingredients(cost_per_unit)',
        { product_id: productId }
    );

    let costPrice = 0;
    if (recipeItems) {
        for (const item of recipeItems) {
            const costPerUnit = item.ingredients?.cost_per_unit ?? 0;
            costPrice += parseFloat(item.quantity_required) * parseFloat(costPerUnit);
        }
    }

    const marginPct = parseFloat(product.profit_margin_percentage);
    const overheadPct = parseFloat(product.fixed_overhead_percentage);
    const multiplier = 1.0 + (marginPct / 100.0) + (overheadPct / 100.0);
    const finalPrice = Math.round(costPrice * multiplier * 100) / 100;
    costPrice = Math.round(costPrice * 100) / 100;

    // Actualizar en Supabase
    await dbUpdate('products', {
        cost_price: costPrice,
        final_price: finalPrice,
        updated_at: new Date().toISOString()
    }, { id: productId });

    return { productId, costPrice, finalPrice };
}

async function recalculateProductsByIngredient(ingredientId) {
    const { data: recipes } = await dbSelect('product_recipes', 'product_id', { ingredient_id: ingredientId });
    if (!recipes || recipes.length === 0) return [];

    const uniqueProductIds = [...new Set(recipes.map(r => r.product_id))];
    const results = [];
    for (const pid of uniqueProductIds) {
        const r = await recalculateProductPricing(pid);
        if (r) results.push(r);
    }
    return results;
}

// ============================================================
// APLICACIÓN PRINCIPAL
// ============================================================
class AdminApp {
    constructor() {
        this.currentView = 'dashboard';
        this.ingredients = [];
        this.products = [];
        this.orders = [];
        this.selectedProductId = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.checkHealth();
        await this.loadInitialData();
        this.renderCurrentView();
    }

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.getAttribute('data-view');
                if (view) this.navigate(view);
            });
        });
    }

    navigate(viewName) {
        this.currentView = viewName;
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-view') === viewName);
        });
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const target = document.getElementById(`view-${viewName}`);
        if (target) target.classList.add('active');

        const titles = {
            dashboard: 'Panel de Control & Resumen',
            ingredients: 'Gestión de Insumos y Costos Base',
            recipes: 'Constructor de Escandallos y Recetas',
            products: 'Productos y Catálogo Digital',
            calendar: 'Agenda de Producción y Entregas'
        };
        const titleElem = document.getElementById('pageTitleHeader');
        if (titleElem) titleElem.textContent = titles[viewName] || 'Panel de Administración';

        this.renderCurrentView();
    }

    async checkHealth() {
        try {
            const { data, error } = await dbSelect('ingredients', 'id', {});
            const badge = document.getElementById('systemHealthText');
            if (badge) {
                badge.textContent = error ? 'Error BD' : 'Online (Supabase)';
            }
        } catch (e) {
            const badge = document.getElementById('systemHealthText');
            if (badge) badge.textContent = 'Sin conexión';
            this.showToast('⚠️ No se pudo conectar con Supabase.', 'error');
        }
    }

    async loadInitialData() {
        await Promise.all([
            this.fetchIngredients(),
            this.fetchProducts(),
            this.fetchOrders()
        ]);
        this.fetchStats();
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'dashboard': this.renderDashboard(); break;
            case 'ingredients': this.renderIngredientsTable(); break;
            case 'recipes': this.renderRecipeBuilder(); break;
            case 'products': this.renderProductsGrid(); break;
            case 'calendar': this.renderOrdersTable(); break;
        }
    }

    // ============================================================
    // SECCIÓN 1: DASHBOARD
    // ============================================================
    async fetchStats() {
        const totalIngredients = this.ingredients.length;
        const totalProducts = this.products.length;
        const activeProducts = this.products.filter(p => p.is_active_in_catalog).length;
        const pendingOrders = this.orders.filter(o => o.status === 'pending').length;
        const todayStr = new Date().toISOString().split('T')[0];
        const todayOrders = this.orders.filter(o => o.delivery_date === todayStr && o.status !== 'cancelled').length;

        document.getElementById('statIngredients').textContent = totalIngredients;
        document.getElementById('statProducts').textContent = activeProducts;
        document.getElementById('statTodayOrders').textContent = `${todayOrders} / ${MAX_DAILY_ORDERS}`;
        document.getElementById('statPendingOrders').textContent = pendingOrders;
    }

    renderDashboard() {
        this.fetchStats();
        const container = document.getElementById('todayOrdersList');
        if (!container) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const todayOrders = this.orders.filter(o => o.delivery_date === todayStr && o.status !== 'cancelled');

        if (todayOrders.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 32px; color: var(--text-muted);">
                    <div style="font-size: 32px; margin-bottom: 8px;">🧁</div>
                    <p>No hay pedidos programados para entregar hoy.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Cliente</th><th>WhatsApp</th><th>Detalle</th>
                        <th>Horario</th><th>Total</th><th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${todayOrders.map(o => `
                        <tr>
                            <td><strong>${this.escape(o.client_name)}</strong></td>
                            <td>
                                <a href="https://wa.me/${o.client_phone}" target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 600;">
                                    💬 ${this.escape(o.client_phone)}
                                </a>
                            </td>
                            <td>${this.escape(o.items_summary || 'Encargo artesanal')}</td>
                            <td><span class="badge-status online">${o.delivery_time_slot}</span></td>
                            <td><strong>$${parseFloat(o.total_price).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong></td>
                            <td>
                                <span class="badge-status" style="background: ${this.getStatusColor(o.status)}; color: #fff;">
                                    ${this.getStatusLabel(o.status)}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // ============================================================
    // SECCIÓN 2: INSUMOS
    // ============================================================
    async fetchIngredients() {
        try {
            const { data, error } = await dbSelect(
                'ingredients',
                '*, product_recipes(id)',
                {},
                { col: 'name', asc: true }
            );
            if (!error && data) {
                this.ingredients = data.map(i => ({
                    ...i,
                    products_count: i.product_recipes ? i.product_recipes.length : 0
                }));
            }
        } catch (e) {
            console.error('Error fetching ingredients:', e);
        }
    }

    renderIngredientsTable() {
        const tbody = document.getElementById('ingredientsTableBody');
        if (!tbody) return;

        if (this.ingredients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay insumos registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.ingredients.map(ing => `
            <tr>
                <td><strong>${this.escape(ing.name)}</strong></td>
                <td><span style="font-weight: 600; color: var(--text-muted);">${ing.unit_of_measure}</span></td>
                <td>
                    <span style="font-size: 1.05rem; font-weight: 700; color: var(--primary);">
                        $${parseFloat(ing.cost_per_unit).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">/ ${ing.unit_of_measure}</span>
                </td>
                <td>${parseFloat(ing.stock_quantity).toLocaleString('es-AR')} ${ing.unit_of_measure}</td>
                <td>
                    <span class="badge-status online" style="font-size: 0.75rem;">
                        ${ing.products_count} producto(s)
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="adminApp.openIngredientModal(${ing.id})">
                            ✏️ Editar
                        </button>
                        <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="adminApp.deleteIngredient(${ing.id})">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    openIngredientModal(id = null) {
        const modal = document.getElementById('ingredientModal');
        const form = document.getElementById('ingredientForm');
        form.reset();

        if (id) {
            const ing = this.ingredients.find(i => i.id === id);
            if (ing) {
                document.getElementById('ingredientModalTitle').textContent = 'Editar Insumo (Recálculo en Cascada)';
                document.getElementById('ingredientId').value = ing.id;
                document.getElementById('ingredientName').value = ing.name;
                document.getElementById('ingredientUnit').value = ing.unit_of_measure;
                document.getElementById('ingredientCost').value = ing.cost_per_unit;
                document.getElementById('ingredientStock').value = ing.stock_quantity;
            }
        } else {
            document.getElementById('ingredientModalTitle').textContent = 'Nuevo Insumo';
            document.getElementById('ingredientId').value = '';
        }

        modal.classList.add('active');
    }

    async saveIngredient(e) {
        e.preventDefault();
        const id = document.getElementById('ingredientId').value;
        const payload = {
            name: document.getElementById('ingredientName').value.trim(),
            unit_of_measure: document.getElementById('ingredientUnit').value,
            cost_per_unit: parseFloat(document.getElementById('ingredientCost').value),
            stock_quantity: parseFloat(document.getElementById('ingredientStock').value || 0),
            updated_at: new Date().toISOString()
        };

        try {
            let error, data;

            if (id) {
                // Actualizar existente
                ({ data, error } = await dbUpdate('ingredients', payload, { id: parseInt(id) }));
                if (!error) {
                    // Recálculo en cascada de productos dependientes
                    const affected = await recalculateProductsByIngredient(parseInt(id));
                    this.closeModal('ingredientModal');
                    await this.fetchIngredients();
                    await this.fetchProducts();
                    this.renderIngredientsTable();
                    if (affected.length > 0) {
                        this.showToast(`¡Costo actualizado! Se recalcularon ${affected.length} productos en cascada.`, 'success');
                    } else {
                        this.showToast('Insumo actualizado correctamente.', 'success');
                    }
                }
            } else {
                // Crear nuevo
                payload.created_at = new Date().toISOString();
                ({ data, error } = await dbInsert('ingredients', payload));
                if (!error) {
                    this.closeModal('ingredientModal');
                    await this.fetchIngredients();
                    this.renderIngredientsTable();
                    this.showToast('Insumo creado correctamente.', 'success');
                }
            }

            if (error) {
                this.showToast(error.message || 'Error al guardar insumo', 'error');
            }
        } catch (err) {
            console.error(err);
            this.showToast('Error de conexión con Supabase.', 'error');
        }
    }

    async deleteIngredient(id) {
        if (!confirm('¿Confirma que desea eliminar este insumo?')) return;

        // Verificar si está en recetas
        const { data: recipes } = await dbSelect('product_recipes', 'id', { ingredient_id: id });
        if (recipes && recipes.length > 0) {
            this.showToast('No se puede eliminar: el insumo está asignado a uno o más escandallos.', 'error');
            return;
        }

        try {
            const { error } = await dbDelete('ingredients', { id });
            if (!error) {
                this.showToast('Insumo eliminado con éxito.', 'success');
                await this.fetchIngredients();
                this.renderIngredientsTable();
            } else {
                this.showToast(error.message || 'No se pudo eliminar el insumo', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión con Supabase.', 'error');
        }
    }

    // ============================================================
    // SECCIÓN 3: ESCANDALLOS / RECETAS
    // ============================================================
    async fetchProducts() {
        try {
            const { data, error } = await dbSelect(
                'products', '*', {}, { col: 'name', asc: true }
            );
            if (!error && data) this.products = data;
        } catch (e) {
            console.error('Error fetching products:', e);
        }
    }

    renderRecipeBuilder() {
        const selectorContainer = document.getElementById('recipeProductSelectorList');
        if (!selectorContainer) return;

        if (this.products.length === 0) {
            selectorContainer.innerHTML = '<p style="color: var(--text-muted);">No hay productos creados.</p>';
            return;
        }

        if (!this.selectedProductId && this.products.length > 0) {
            this.selectedProductId = this.products[0].id;
        }

        selectorContainer.innerHTML = this.products.map(p => `
            <button type="button" class="product-select-btn ${p.id === this.selectedProductId ? 'active' : ''}" onclick="adminApp.selectRecipeProduct(${p.id})">
                <div>
                    <div style="font-weight: 700; color: var(--secondary);">${this.escape(p.name)}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${p.category === 'daily' ? 'Diario' : 'Evento'}</div>
                </div>
                <div style="font-weight: 700; color: var(--primary);">
                    $${parseFloat(p.final_price).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                </div>
            </button>
        `).join('');

        this.loadRecipeDetails(this.selectedProductId);
    }

    selectRecipeProduct(productId) {
        this.selectedProductId = productId;
        this.renderRecipeBuilder();
    }

    async loadRecipeDetails(productId) {
        if (!productId) return;
        try {
            const product = this.products.find(p => p.id === productId);
            if (!product) return;

            document.getElementById('recipeCostPrice').textContent = `$${parseFloat(product.cost_price || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
            document.getElementById('recipeMarginPct').textContent = `${product.profit_margin_percentage}%`;
            document.getElementById('recipeOverheadPct').textContent = `${product.fixed_overhead_percentage}%`;
            document.getElementById('recipeFinalPrice').textContent = `$${parseFloat(product.final_price || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}`;

            // Obtener items del escandallo con JOIN a ingredients
            const { data: items } = await dbSelect(
                'product_recipes',
                'id,quantity_required,ingredients(id,name,unit_of_measure,cost_per_unit)',
                { product_id: productId }
            );

            const tbody = document.getElementById('recipeItemsTableBody');
            if (!items || items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Este producto aún no tiene insumos asignados en su escandallo.</td></tr>`;
                return;
            }

            tbody.innerHTML = items.map(item => {
                const ing = item.ingredients;
                const itemCost = parseFloat(item.quantity_required) * parseFloat(ing.cost_per_unit);
                return `
                    <tr>
                        <td><strong>${this.escape(ing.name)}</strong></td>
                        <td>${parseFloat(item.quantity_required).toLocaleString('es-AR')} ${ing.unit_of_measure}</td>
                        <td>$${parseFloat(ing.cost_per_unit).toLocaleString('es-AR', {minimumFractionDigits: 2})} / ${ing.unit_of_measure}</td>
                        <td><strong>$${itemCost.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong></td>
                        <td>
                            <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="adminApp.removeRecipeItem(${item.id})">
                                🗑️ Quitar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('Error loadRecipeDetails:', e);
        }
    }

    openAddRecipeItemModal() {
        if (!this.selectedProductId) {
            this.showToast('Primero seleccione un producto.', 'info');
            return;
        }

        const select = document.getElementById('recipeIngredientSelect');
        select.innerHTML = this.ingredients.map(i => `
            <option value="${i.id}" data-unit="${i.unit_of_measure}" data-cost="${i.cost_per_unit}">
                ${this.escape(i.name)} ($${parseFloat(i.cost_per_unit).toFixed(2)} / ${i.unit_of_measure})
            </option>
        `).join('');

        this.updateRecipeUnitHint();
        select.onchange = () => this.updateRecipeUnitHint();
        document.getElementById('recipeQuantityRequired').value = '';
        document.getElementById('recipeItemModal').classList.add('active');
    }

    updateRecipeUnitHint() {
        const select = document.getElementById('recipeIngredientSelect');
        const selected = select.options[select.selectedIndex];
        if (selected) {
            const unit = selected.getAttribute('data-unit');
            document.getElementById('recipeUnitHint').textContent = `* Ingrese la cantidad en ${unit}.`;
        }
    }

    async saveRecipeItem(e) {
        e.preventDefault();
        const ingredientId = parseInt(document.getElementById('recipeIngredientSelect').value);
        const quantityRequired = parseFloat(document.getElementById('recipeQuantityRequired').value);

        try {
            // Verificar si ya existe la combinación (UPSERT)
            const { data: existing } = await dbSelect('product_recipes', 'id', {
                product_id: this.selectedProductId,
                ingredient_id: ingredientId
            });

            let error;
            if (existing && existing.length > 0) {
                ({ error } = await dbUpdate('product_recipes', { quantity_required: quantityRequired }, { id: existing[0].id }));
            } else {
                ({ error } = await dbInsert('product_recipes', {
                    product_id: this.selectedProductId,
                    ingredient_id: ingredientId,
                    quantity_required: quantityRequired
                }));
            }

            if (!error) {
                // Recalcular precios del producto
                await recalculateProductPricing(this.selectedProductId);
                this.closeModal('recipeItemModal');
                this.showToast('Insumo agregado y escandallo recalculado.', 'success');
                await this.fetchProducts();
                this.loadRecipeDetails(this.selectedProductId);
            } else {
                this.showToast(error.message || 'Error al guardar insumo en escandallo', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión con Supabase.', 'error');
        }
    }

    async removeRecipeItem(itemId) {
        if (!confirm('¿Desea quitar este insumo de la receta?')) return;

        try {
            const { error } = await dbDelete('product_recipes', { id: itemId });
            if (!error) {
                // Recalcular precios
                await recalculateProductPricing(this.selectedProductId);
                this.showToast('Insumo quitado de la receta.', 'success');
                await this.fetchProducts();
                this.loadRecipeDetails(this.selectedProductId);
            }
        } catch (e) {
            this.showToast('Error de conexión con Supabase.', 'error');
        }
    }

    // ============================================================
    // SECCIÓN 4: PRODUCTOS Y CATÁLOGO
    // ============================================================
    renderProductsGrid() {
        const grid = document.getElementById('productsAdminGrid');
        if (!grid) return;

        if (this.products.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-muted);">No hay productos registrados.</p>';
            return;
        }

        grid.innerHTML = this.products.map(p => `
            <div class="product-admin-card">
                <div class="product-img-wrapper">
                    <img src="/${p.image_url || 'assets/images/hero_dulce_arte.jpg'}" alt="${this.escape(p.name)}" onerror="this.src='/assets/images/hero_dulce_arte.jpg'">
                    <span class="product-category-tag ${p.category}">
                        ${p.category === 'daily' ? 'Diario' : 'Mesa Dulce'}
                    </span>
                </div>
                <div class="product-admin-body">
                    <h3 class="product-admin-title">${this.escape(p.name)}</h3>
                    <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 12px; flex-grow: 1;">
                        ${this.escape(p.description || 'Sin descripción')}
                    </p>

                    <div class="product-pricing-box">
                        <div class="pricing-item">
                            <div class="label">Costo Base</div>
                            <div class="val">$${parseFloat(p.cost_price).toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                        </div>
                        <div class="pricing-item highlight">
                            <div class="label">PVP Catálogo</div>
                            <div class="val">$${parseFloat(p.final_price).toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label class="switch">
                                <input type="checkbox" ${p.is_active_in_catalog ? 'checked' : ''} onchange="adminApp.toggleProductCatalog(${p.id})">
                                <span class="slider"></span>
                            </label>
                            <span style="font-size: 0.78rem; font-weight: 600; color: ${p.is_active_in_catalog ? 'var(--success)' : 'var(--text-muted)'};">
                                ${p.is_active_in_catalog ? 'En Catálogo' : 'Pausado'}
                            </span>
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-secondary btn-sm" onclick="adminApp.openProductModal(${p.id})">✏️</button>
                            <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="adminApp.deleteProduct(${p.id})">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async toggleProductCatalog(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        const newVal = !product.is_active_in_catalog;
        try {
            const { error } = await dbUpdate('products', {
                is_active_in_catalog: newVal,
                updated_at: new Date().toISOString()
            }, { id });
            if (!error) {
                this.showToast(`Producto ${newVal ? 'activado en catálogo' : 'pausado'}.`, 'success');
                await this.fetchProducts();
                this.renderProductsGrid();
            }
        } catch (e) {
            this.showToast('Error al modificar visibilidad', 'error');
        }
    }

    openProductModal(id = null) {
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');
        form.reset();

        if (id) {
            const prod = this.products.find(p => p.id === id);
            if (prod) {
                document.getElementById('productModalTitle').textContent = 'Editar Producto';
                document.getElementById('productId').value = prod.id;
                document.getElementById('productName').value = prod.name;
                document.getElementById('productCategory').value = prod.category;
                document.getElementById('productDescription').value = prod.description || '';
                document.getElementById('productMargin').value = prod.profit_margin_percentage;
                document.getElementById('productOverhead').value = prod.fixed_overhead_percentage;
                document.getElementById('productImage').value = prod.image_url || '';
                document.getElementById('productIsActive').checked = prod.is_active_in_catalog;
            }
        } else {
            document.getElementById('productModalTitle').textContent = 'Nuevo Producto';
            document.getElementById('productId').value = '';
            document.getElementById('productMargin').value = '35.00';
            document.getElementById('productOverhead').value = '15.00';
            document.getElementById('productIsActive').checked = true;
        }

        modal.classList.add('active');
    }

    async saveProduct(e) {
        e.preventDefault();
        const id = document.getElementById('productId').value;
        const payload = {
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            description: document.getElementById('productDescription').value,
            profit_margin_percentage: parseFloat(document.getElementById('productMargin').value),
            fixed_overhead_percentage: parseFloat(document.getElementById('productOverhead').value),
            image_url: document.getElementById('productImage').value || null,
            is_active_in_catalog: document.getElementById('productIsActive').checked,
            updated_at: new Date().toISOString()
        };

        try {
            let error;
            if (id) {
                ({ error } = await dbUpdate('products', payload, { id: parseInt(id) }));
                if (!error) await recalculateProductPricing(parseInt(id));
            } else {
                payload.cost_price = 0;
                payload.final_price = 0;
                payload.created_at = new Date().toISOString();
                ({ error } = await dbInsert('products', payload));
            }

            if (!error) {
                this.closeModal('productModal');
                this.showToast('Producto guardado correctamente.', 'success');
                await this.fetchProducts();
                this.renderProductsGrid();
            } else {
                this.showToast(error.message || 'Error al guardar producto', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión con Supabase.', 'error');
        }
    }

    async deleteProduct(id) {
        if (!confirm('¿Confirma que desea eliminar este producto? Se eliminará también su escandallo.')) return;
        try {
            const { error } = await dbDelete('products', { id });
            if (!error) {
                this.showToast('Producto eliminado.', 'success');
                await this.fetchProducts();
                this.renderProductsGrid();
            }
        } catch (e) {
            this.showToast('Error al eliminar', 'error');
        }
    }

    // ============================================================
    // SECCIÓN 5: AGENDA Y PEDIDOS
    // ============================================================
    async fetchOrders() {
        try {
            const { data, error } = await dbSelect(
                'orders', '*', {}, { col: 'delivery_date', asc: true }
            );
            if (!error && data) this.orders = data;
        } catch (e) {
            console.error('Error fetching orders:', e);
        }
    }

    renderOrdersTable() {
        const tbody = document.getElementById('ordersTableBody');
        if (!tbody) return;

        if (this.orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">No hay pedidos registrados en la agenda.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.orders.map(o => `
            <tr>
                <td>
                    <div style="font-weight: 700; color: var(--secondary);">${o.delivery_date}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${o.delivery_time_slot}</div>
                </td>
                <td><strong>${this.escape(o.client_name)}</strong></td>
                <td>
                    <a href="https://wa.me/${o.client_phone}" target="_blank" style="color: #25d366; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                        <span>📱</span> ${this.escape(o.client_phone)}
                    </a>
                </td>
                <td style="max-width: 250px;">
                    <div style="font-size: 0.85rem; line-height: 1.3;">${this.escape(o.items_summary || 'Encargo')}</div>
                    ${o.notes ? `<small style="color: var(--text-muted); font-style: italic;">Nota: ${this.escape(o.notes)}</small>` : ''}
                </td>
                <td><strong style="color: var(--primary);">$${parseFloat(o.total_price).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong></td>
                <td>
                    <select class="form-select btn-sm" style="padding: 4px 8px; font-weight: 600;" onchange="adminApp.updateOrderStatus(${o.id}, this.value)">
                        <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>⏳ Pendiente</option>
                        <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>✅ Confirmado</option>
                        <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>🛵 Entregado</option>
                        <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>❌ Cancelado</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="adminApp.deleteOrder(${o.id})">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async updateOrderStatus(orderId, newStatus) {
        try {
            const { error } = await dbUpdate('orders', {
                status: newStatus,
                updated_at: new Date().toISOString()
            }, { id: orderId });
            if (!error) {
                this.showToast('Estado de pedido actualizado.', 'success');
                await this.fetchOrders();
                this.fetchStats();
            }
        } catch (e) {
            this.showToast('Error al actualizar estado', 'error');
        }
    }

    async deleteOrder(id) {
        if (!confirm('¿Confirma que desea eliminar este pedido de la agenda?')) return;
        try {
            const { error } = await dbDelete('orders', { id });
            if (!error) {
                this.showToast('Pedido eliminado.', 'success');
                await this.fetchOrders();
                this.fetchStats();
                this.renderOrdersTable();
            }
        } catch (e) {
            this.showToast('Error al eliminar', 'error');
        }
    }

    openOrderModal() {
        const modal = document.getElementById('orderModal');
        const form = document.getElementById('orderForm');
        form.reset();

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('orderDeliveryDate').value = today;
        document.getElementById('orderDeliveryDate').min = today;

        const select = document.getElementById('orderProductSelect');
        select.innerHTML = this.products.map(p => `
            <option value="${p.id}" data-price="${p.final_price}">${this.escape(p.name)} - $${parseFloat(p.final_price).toFixed(2)}</option>
        `).join('');

        this.onOrderProductChange();
        this.verifyOrderDateAvailability(today);
        modal.classList.add('active');
    }

    onOrderProductChange() {
        const select = document.getElementById('orderProductSelect');
        const opt = select.options[select.selectedIndex];
        if (opt) {
            const price = opt.getAttribute('data-price');
            document.getElementById('orderTotalPrice').value = parseFloat(price || 0).toFixed(2);
        }
    }

    async verifyOrderDateAvailability(dateStr) {
        const notice = document.getElementById('orderAvailabilityNotice');
        const btn = document.getElementById('btnSubmitOrder');
        if (!notice || !dateStr) return;

        try {
            // Consultar solo los pedidos de esa fecha directamente en Supabase
            const url = `${SUPABASE_URL}/rest/v1/orders?select=id&delivery_date=eq.${dateStr}&status=neq.cancelled`;
            const res = await fetch(url, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });
            const ordersOnDate = await res.json();
            const count = Array.isArray(ordersOnDate) ? ordersOnDate.length : 0;

            if (count < MAX_DAILY_ORDERS) {
                const remaining = MAX_DAILY_ORDERS - count;
                notice.innerHTML = `<span style="color: var(--success); font-weight: 600;">✓ Fecha disponible (${remaining} lugar${remaining !== 1 ? 'es' : ''} restante${remaining !== 1 ? 's' : ''})</span>`;
                if (btn) btn.disabled = false;
            } else {
                notice.innerHTML = `<span style="color: var(--danger); font-weight: 600;">⚠ Sin cupo para esta fecha (máximo ${MAX_DAILY_ORDERS} pedidos/día)</span>`;
                if (btn) btn.disabled = true;
            }
        } catch (e) {
            if (notice) notice.innerHTML = '';
        }
    }

    async saveOrder(e) {
        e.preventDefault();
        const select = document.getElementById('orderProductSelect');
        const selectedProdId = parseInt(select.value);
        const totalPrice = parseFloat(document.getElementById('orderTotalPrice').value);
        const selectedProduct = this.products.find(p => p.id === selectedProdId);

        const payload = {
            client_name: document.getElementById('orderClientName').value,
            client_phone: document.getElementById('orderClientPhone').value,
            delivery_date: document.getElementById('orderDeliveryDate').value,
            delivery_time_slot: document.getElementById('orderTimeSlot').value,
            status: 'confirmed',
            total_price: totalPrice,
            notes: document.getElementById('orderNotes').value,
            items_summary: selectedProduct ? selectedProduct.name : 'Encargo',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            const { data: newOrder, error } = await dbInsert('orders', payload);
            if (!error && newOrder && newOrder.length > 0) {
                // Insertar order_item
                await dbInsert('order_items', {
                    order_id: newOrder[0].id,
                    product_id: selectedProdId,
                    quantity: 1,
                    unit_price: totalPrice,
                    subtotal: totalPrice
                });

                this.closeModal('orderModal');
                this.showToast('Pedido registrado con éxito en la agenda.', 'success');
                await this.fetchOrders();
                this.fetchStats();
                this.renderOrdersTable();
            } else {
                this.showToast(error?.message || 'No se pudo asentar el pedido', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión con Supabase.', 'error');
        }
    }

    // ============================================================
    // UTILIDADES COMUNES
    // ============================================================
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    getStatusColor(status) {
        const colors = {
            pending: 'var(--warning)',
            confirmed: 'var(--info)',
            delivered: 'var(--success)',
            cancelled: 'var(--danger)'
        };
        return colors[status] || 'var(--text-muted)';
    }

    getStatusLabel(status) {
        const labels = {
            pending: 'Pendiente',
            confirmed: 'Confirmado',
            delivered: 'Entregado',
            cancelled: 'Cancelado'
        };
        return labels[status] || status;
    }

    escape(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Iniciar aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
});
