/**
 * Dulce Arte - Lógica del Panel de Administración (Vanilla JS Moderno)
 */

const API_BASE = '/api';

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
        // Navegación Sidebar
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = item.getAttribute('data-view');
                if (view) this.navigate(view);
            });
        });
    }

    navigate(viewName) {
        this.currentView = viewName;
        
        // Actualizar sidebar activo
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Actualizar vistas
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.remove('active');
        });
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.add('active');

        // Actualizar título topbar
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
            const res = await fetch(`${API_BASE}/health`);
            const data = await res.json();
            const badge = document.getElementById('systemHealthText');
            if (badge && data.success) {
                badge.textContent = `Online (${data.database.toUpperCase()})`;
            }
        } catch (e) {
            const badge = document.getElementById('systemHealthText');
            if (badge) badge.textContent = 'Modo Local';
        }
    }

    async loadInitialData() {
        await Promise.all([
            this.fetchStats(),
            this.fetchIngredients(),
            this.fetchProducts(),
            this.fetchOrders()
        ]);
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'ingredients':
                this.renderIngredientsTable();
                break;
            case 'recipes':
                this.renderRecipeBuilder();
                break;
            case 'products':
                this.renderProductsGrid();
                break;
            case 'calendar':
                this.renderOrdersTable();
                break;
        }
    }

    // ============================================================
    // SECCIÓN 1: DASHBOARD
    // ============================================================
    async fetchStats() {
        try {
            const res = await fetch(`${API_BASE}/stats`);
            const data = await res.json();
            if (data.success) {
                const s = data.stats;
                document.getElementById('statIngredients').textContent = s.total_ingredients;
                document.getElementById('statProducts').textContent = s.active_products;
                document.getElementById('statTodayOrders').textContent = `${s.today_orders} / ${s.max_daily_orders}`;
                document.getElementById('statPendingOrders').textContent = s.pending_orders;
            }
        } catch (err) {
            console.error('Error stats:', err);
        }
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

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>WhatsApp</th>
                        <th>Detalle</th>
                        <th>Horario</th>
                        <th>Total</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;

        todayOrders.forEach(o => {
            html += `
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
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    // ============================================================
    // SECCIÓN 2: INSUMOS (INGREDIENTS CRUD & CASCADE RECALCULATE)
    // ============================================================
    async fetchIngredients() {
        try {
            const res = await fetch(`${API_BASE}/ingredients`);
            const data = await res.json();
            if (data.success) {
                this.ingredients = data.ingredients || [];
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
            name: document.getElementById('ingredientName').value,
            unit_of_measure: document.getElementById('ingredientUnit').value,
            cost_per_unit: parseFloat(document.getElementById('ingredientCost').value),
            stock_quantity: parseFloat(document.getElementById('ingredientStock').value || 0)
        };

        const url = id ? `${API_BASE}/ingredients/${id}` : `${API_BASE}/ingredients`;
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                this.closeModal('ingredientModal');
                await this.fetchIngredients();
                await this.fetchProducts(); // Refrescar productos con sus nuevos costos en cascada
                this.renderIngredientsTable();

                if (data.recalculated_count && data.recalculated_count > 0) {
                    this.showToast(`¡Costo actualizado! Se recalcularon ${data.recalculated_count} productos en cascada.`, 'success');
                } else {
                    this.showToast('Insumo guardado correctamente.', 'success');
                }
            } else {
                this.showToast(data.error || 'Error al guardar insumo', 'error');
            }
        } catch (err) {
            this.showToast('Error de conexión', 'error');
        }
    }

    async deleteIngredient(id) {
        if (!confirm('¿Confirma que desea eliminar este insumo?')) return;

        try {
            const res = await fetch(`${API_BASE}/ingredients/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                this.showToast('Insumo eliminado con éxito.', 'success');
                await this.fetchIngredients();
                this.renderIngredientsTable();
            } else {
                this.showToast(data.error || 'No se pudo eliminar el insumo', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión', 'error');
        }
    }

    // ============================================================
    // SECCIÓN 3: CONSTRUCTOR DE ESCANDALLOS / RECETAS
    // ============================================================
    async fetchProducts() {
        try {
            const res = await fetch(`${API_BASE}/products`);
            const data = await res.json();
            if (data.success) {
                this.products = data.products || [];
            }
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

        // Si no hay seleccionado, elegir el primero
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
            const res = await fetch(`${API_BASE}/recipes/${productId}`);
            const data = await res.json();
            if (data.success) {
                const r = data.recipe;
                document.getElementById('recipeCostPrice').textContent = `$${parseFloat(r.cost_price).toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
                document.getElementById('recipeMarginPct').textContent = `${r.profit_margin_percentage}%`;
                document.getElementById('recipeOverheadPct').textContent = `${r.fixed_overhead_percentage}%`;
                document.getElementById('recipeFinalPrice').textContent = `$${parseFloat(r.final_price).toLocaleString('es-AR', {minimumFractionDigits: 2})}`;

                const tbody = document.getElementById('recipeItemsTableBody');
                if (r.items.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Este producto aún no tiene insumos asignados en su escandallo.</td></tr>`;
                    return;
                }

                tbody.innerHTML = r.items.map(item => `
                    <tr>
                        <td><strong>${this.escape(item.ingredient_name)}</strong></td>
                        <td>${parseFloat(item.quantity_required).toLocaleString('es-AR')} ${item.unit_of_measure}</td>
                        <td>$${parseFloat(item.cost_per_unit).toLocaleString('es-AR', {minimumFractionDigits: 2})} / ${item.unit_of_measure}</td>
                        <td><strong>$${parseFloat(item.item_cost).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong></td>
                        <td>
                            <button class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick="adminApp.removeRecipeItem(${item.recipe_item_id})">
                                🗑️ Quitar
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
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
        const payload = {
            ingredient_id: parseInt(document.getElementById('recipeIngredientSelect').value),
            quantity_required: parseFloat(document.getElementById('recipeQuantityRequired').value)
        };

        try {
            const res = await fetch(`${API_BASE}/recipes/${this.selectedProductId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.closeModal('recipeItemModal');
                this.showToast('Insumo agregado y escandallo recalculado.', 'success');
                await this.fetchProducts();
                this.loadRecipeDetails(this.selectedProductId);
            } else {
                this.showToast(data.error || 'Error al guardar insumo en escandallo', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión', 'error');
        }
    }

    async removeRecipeItem(itemId) {
        if (!confirm('¿Desea quitar este insumo de la receta?')) return;

        try {
            const res = await fetch(`${API_BASE}/recipes/items/${itemId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                this.showToast('Insumo quitado de la receta.', 'success');
                await this.fetchProducts();
                this.loadRecipeDetails(this.selectedProductId);
            }
        } catch (e) {
            this.showToast('Error de conexión', 'error');
        }
    }

    // ============================================================
    // SECCIÓN 4: GESTIÓN DE PRODUCTOS Y CATÁLOGO
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
                                <input type="checkbox" ${parseInt(p.is_active_in_catalog) === 1 ? 'checked' : ''} onchange="adminApp.toggleProductCatalog(${p.id})">
                                <span class="slider"></span>
                            </label>
                            <span style="font-size: 0.78rem; font-weight: 600; color: ${parseInt(p.is_active_in_catalog) === 1 ? 'var(--success)' : 'var(--text-muted)'};">
                                ${parseInt(p.is_active_in_catalog) === 1 ? 'En Catálogo' : 'Pausado'}
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
        try {
            const res = await fetch(`${API_BASE}/products/${id}/toggle-catalog`, {
                method: 'PATCH'
            });
            const data = await res.json();
            if (data.success) {
                this.showToast(`Producto ${data.status_label.toLowerCase()}.`, 'success');
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
                document.getElementById('productIsActive').checked = parseInt(prod.is_active_in_catalog) === 1;
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
            is_active_in_catalog: document.getElementById('productIsActive').checked ? 1 : 0
        };

        const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.closeModal('productModal');
                this.showToast('Producto guardado correctamente.', 'success');
                await this.fetchProducts();
                this.renderProductsGrid();
            } else {
                this.showToast(data.error || 'Error al guardar producto', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión', 'error');
        }
    }

    async deleteProduct(id) {
        if (!confirm('¿Confirma que desea eliminar este producto? Se eliminará también su escandallo.')) return;

        try {
            const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                this.showToast('Producto eliminado.', 'success');
                await this.fetchProducts();
                this.renderProductsGrid();
            }
        } catch (e) {
            this.showToast('Error al eliminar', 'error');
        }
    }

    // ============================================================
    // SECCIÓN 5: AGENDA Y CALENDARIO DE PRODUCCIÓN
    // ============================================================
    async fetchOrders() {
        try {
            const res = await fetch(`${API_BASE}/orders`);
            const data = await res.json();
            if (data.success) {
                this.orders = data.orders || [];
            }
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
            const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                this.showToast('Estado de pedido actualizado.', 'success');
                await this.fetchOrders();
                await this.fetchStats();
            }
        } catch (e) {
            this.showToast('Error al actualizar estado', 'error');
        }
    }

    async deleteOrder(id) {
        if (!confirm('¿Confirma que desea eliminar este pedido de la agenda?')) return;
        try {
            const res = await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                this.showToast('Pedido eliminado.', 'success');
                await this.fetchOrders();
                await this.fetchStats();
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
            const res = await fetch(`${API_BASE}/availability?date=${dateStr}`);
            const data = await res.json();

            if (data.available) {
                notice.innerHTML = `<span style="color: var(--success); font-weight: 600;">✓ ${data.message}</span>`;
                btn.disabled = false;
            } else {
                notice.innerHTML = `<span style="color: var(--danger); font-weight: 600;">⚠ ${data.message}</span>`;
                btn.disabled = true;
            }
        } catch (e) {
            notice.innerHTML = '';
        }
    }

    async saveOrder(e) {
        e.preventDefault();
        const select = document.getElementById('orderProductSelect');
        const selectedProdId = parseInt(select.value);
        const totalPrice = parseFloat(document.getElementById('orderTotalPrice').value);

        const payload = {
            client_name: document.getElementById('orderClientName').value,
            client_phone: document.getElementById('orderClientPhone').value,
            delivery_date: document.getElementById('orderDeliveryDate').value,
            delivery_time_slot: document.getElementById('orderTimeSlot').value,
            status: 'confirmed',
            total_price: totalPrice,
            notes: document.getElementById('orderNotes').value,
            items: [
                {
                    product_id: selectedProdId,
                    quantity: 1,
                    unit_price: totalPrice
                }
            ]
        };

        try {
            const res = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                this.closeModal('orderModal');
                this.showToast('Pedido registrado con éxito en la agenda.', 'success');
                await this.fetchOrders();
                await this.fetchStats();
                this.renderOrdersTable();
            } else {
                this.showToast(data.error || 'No se pudo asentar el pedido', 'error');
            }
        } catch (e) {
            this.showToast('Error de conexión', 'error');
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
