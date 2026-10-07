/**
 * Dulce Arte - Lógica del Catálogo Digital y Generador de Pedidos por WhatsApp
 */

class CatalogApp {
    constructor() {
        this.products = [];
        this.cart = [];
        this.currentFilter = 'all';
        this.businessConfig = {
            whatsapp_number: '5493804232210',
            delivery_hours: '17:00 a 20:00 hs',
            max_daily_orders: 8
        };
        this.isDateAvailable = false;

        this.init();
    }

    async init() {
        this.loadCartFromStorage();
        this.bindEvents();
        await this.fetchConfig();
        await this.fetchProducts();
        this.setupDatePicker();
        this.updateCartUI();
    }

    bindEvents() {
        // Filtros de categoría
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.getAttribute('data-category');
                this.renderProducts();
            });
        });

        // Botón abrir carrito
        const trigger = document.getElementById('cartTriggerBtn');
        if (trigger) {
            trigger.addEventListener('click', () => this.toggleCartDrawer(true));
        }

        // Botón cerrar carrito
        const closeBtn = document.getElementById('cartCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleCartDrawer(false));
        }

        // Overlay cerrar
        const overlay = document.getElementById('cartDrawerOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.toggleCartDrawer(false);
            });
        }

        // Cambio de fecha
        const dateInput = document.getElementById('deliveryDateInput');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => this.checkDateAvailability(e.target.value));
        }

        // Envío de pedido por WhatsApp
        const btnWa = document.getElementById('btnSubmitWhatsApp');
        if (btnWa) {
            btnWa.addEventListener('click', () => this.submitOrderToWhatsApp());
        }
    }

    async fetchConfig() {
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            if (data.success && data.business) {
                this.businessConfig = data.business;
                // Actualizar textos si existen
                const hoursLabel = document.getElementById('deliveryHoursLabel');
                if (hoursLabel) hoursLabel.textContent = this.businessConfig.delivery_hours;
            }
        } catch (e) {
            console.warn('Usando configuración por defecto de negocio.');
        }
    }

    async fetchProducts() {
        try {
            const res = await fetch('/api/products?active=1');
            const data = await res.json();
            if (data.success) {
                this.products = data.products || [];
                this.renderProducts();
            }
        } catch (e) {
            console.error('Error al cargar productos:', e);
            document.getElementById('productsGrid').innerHTML = '<p style="text-align: center; color: var(--text-muted);">No fue posible cargar el catálogo en este momento.</p>';
        }
    }

    renderProducts() {
        const grid = document.getElementById('productsGrid');
        if (!grid) return;

        let filtered = this.products;
        if (this.currentFilter !== 'all') {
            filtered = this.products.filter(p => p.category === this.currentFilter);
        }

        if (filtered.length === 0) {
            grid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; padding: 40px; color: var(--text-muted);">No hay productos en esta categoría por el momento.</p>';
            return;
        }

        grid.innerHTML = filtered.map(p => {
            const priceFormatted = parseFloat(p.final_price).toLocaleString('es-AR', {minimumFractionDigits: 2});
            const imgPath = p.image_url ? `/${p.image_url}` : '/assets/images/hero_dulce_arte.jpg';

            return `
                <article class="product-card">
                    <div class="product-thumb">
                        <img src="${imgPath}" alt="${this.escape(p.name)}" loading="lazy" onerror="this.src='/assets/images/hero_dulce_arte.jpg'">
                        <span class="product-badge-cat ${p.category}">
                            ${p.category === 'daily' ? 'Diario' : 'Mesa Dulce'}
                        </span>
                    </div>
                    <div class="product-info">
                        <h3 class="product-title">${this.escape(p.name)}</h3>
                        <p class="product-description">${this.escape(p.description || 'Elaboración 100% artesanal con ingredientes de primera calidad.')}</p>
                        <div class="product-bottom">
                            <span class="product-price">$${priceFormatted}</span>
                            <button class="btn-add-cart" onclick="catalogApp.addToCart(${p.id})">
                                <span>+</span>
                                <span>Encargar</span>
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    // ============================================================
    // GESTIÓN DEL CARRITO / LISTA DE ENCARGOS
    // ============================================================
    addToCart(productId) {
        const prod = this.products.find(p => p.id === productId);
        if (!prod) return;

        const existing = this.cart.find(item => item.product.id === productId);
        if (existing) {
            existing.quantity += 1;
        } else {
            this.cart.push({
                product: prod,
                quantity: 1
            });
        }

        this.saveCartToStorage();
        this.updateCartUI();
        this.toggleCartDrawer(true);
    }

    updateQuantity(productId, delta) {
        const item = this.cart.find(i => i.product.id === productId);
        if (!item) return;

        item.quantity += delta;
        if (item.quantity <= 0) {
            this.removeFromCart(productId);
            return;
        }

        this.saveCartToStorage();
        this.updateCartUI();
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.product.id !== productId);
        this.saveCartToStorage();
        this.updateCartUI();
    }

    updateCartUI() {
        const badge = document.getElementById('cartCounterBadge');
        const itemsContainer = document.getElementById('cartItemsList');
        const totalAmountElem = document.getElementById('cartTotalAmount');
        const btnWa = document.getElementById('btnSubmitWhatsApp');

        const totalItemsCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = this.cart.reduce((sum, item) => sum + (item.quantity * parseFloat(item.product.final_price)), 0);

        if (badge) badge.textContent = totalItemsCount;
        if (totalAmountElem) {
            totalAmountElem.textContent = `$${totalPrice.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
        }

        if (this.cart.length === 0) {
            if (itemsContainer) {
                itemsContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
                        <div style="font-size: 36px; margin-bottom: 8px;">🍰</div>
                        <p style="font-weight: 600;">Tu pedido está vacío</p>
                        <p style="font-size: 0.85rem; margin-top: 4px;">Selecciona productos del catálogo para armar tu encargo.</p>
                    </div>
                `;
            }
            if (btnWa) btnWa.disabled = true;
            return;
        }

        if (itemsContainer) {
            itemsContainer.innerHTML = this.cart.map(item => {
                const p = item.product;
                const subtotal = item.quantity * parseFloat(p.final_price);
                const imgPath = p.image_url ? `/${p.image_url}` : '/assets/images/hero_dulce_arte.jpg';

                return `
                    <div class="cart-item-row">
                        <img src="${imgPath}" alt="${this.escape(p.name)}" class="cart-item-img" onerror="this.src='/assets/images/hero_dulce_arte.jpg'">
                        <div class="cart-item-details">
                            <div class="cart-item-title">${this.escape(p.name)}</div>
                            <div class="cart-item-price">$${parseFloat(p.final_price).toLocaleString('es-AR', {minimumFractionDigits: 2})} c/u</div>
                            <div class="cart-item-qty-controls">
                                <button class="qty-btn" onclick="catalogApp.updateQuantity(${p.id}, -1)">-</button>
                                <span style="font-weight: 700; font-size: 0.9rem;">${item.quantity}</span>
                                <button class="qty-btn" onclick="catalogApp.updateQuantity(${p.id}, 1)">+</button>
                                <span style="margin-left: auto; font-weight: 700; color: var(--secondary); font-size: 0.95rem;">
                                    $${subtotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                </span>
                            </div>
                        </div>
                        <button class="cart-item-remove" onclick="catalogApp.removeFromCart(${p.id})" title="Quitar">✕</button>
                    </div>
                `;
            }).join('');
        }

        // Habilitar botón si fecha es válida
        if (btnWa) {
            btnWa.disabled = !(this.cart.length > 0 && this.isDateAvailable);
        }
    }

    toggleCartDrawer(show) {
        const overlay = document.getElementById('cartDrawerOverlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('open');
                document.body.style.overflow = 'hidden';
            } else {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
            }
        }
    }

    setupDatePicker() {
        const dateInput = document.getElementById('deliveryDateInput');
        if (!dateInput) return;

        // Por defecto, fecha de mañana o hoy
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.value = tomorrowStr;
        this.checkDateAvailability(tomorrowStr);
    }

    async checkDateAvailability(dateStr) {
        const alertBox = document.getElementById('availabilityAlert');
        const btnWa = document.getElementById('btnSubmitWhatsApp');
        if (!alertBox || !dateStr) return;

        try {
            const res = await fetch(`/api/availability?date=${dateStr}`);
            const data = await res.json();

            this.isDateAvailable = !!data.available;

            alertBox.className = `availability-alert ${data.available ? 'ok' : 'error'}`;
            alertBox.innerHTML = `<span>${data.message}</span>`;

            if (btnWa) {
                btnWa.disabled = !(this.cart.length > 0 && this.isDateAvailable);
            }
        } catch (e) {
            console.error('Error al chequear disponibilidad:', e);
            alertBox.className = 'availability-alert ok';
            alertBox.textContent = 'Horario de entrega: Lunes a Sábado de 17:00 a 20:00 hs.';
            this.isDateAvailable = true;
            if (btnWa) btnWa.disabled = this.cart.length === 0;
        }
    }

    // ============================================================
    // GENERADOR DE MENSAJE Y ENVÍO A WHATSAPP
    // ============================================================
    async submitOrderToWhatsApp() {
        const nameInput = document.getElementById('clientNameInput');
        const phoneInput = document.getElementById('clientPhoneInput');
        const dateInput = document.getElementById('deliveryDateInput');

        const clientName = nameInput ? nameInput.value.trim() : '';
        const clientPhone = phoneInput ? phoneInput.value.trim() : '';
        const deliveryDate = dateInput ? dateInput.value : '';

        if (!clientName) {
            alert('Por favor ingrese su nombre para el encargo.');
            if (nameInput) nameInput.focus();
            return;
        }

        if (this.cart.length === 0) {
            alert('Por favor seleccione al menos un producto.');
            return;
        }

        // Construir el texto del pedido según el formato solicitado:
        // "¡Hola Dulce Arte! Quisiera encargar: 1x Pastafrola, 1x Docena de Maicenitas. Fecha de entrega deseada: [Fecha] (Horario 17-20 hs)."
        const itemsText = this.cart.map(i => `${i.quantity}x ${i.product.name}`).join(', ');
        const totalPrice = this.cart.reduce((sum, item) => sum + (item.quantity * parseFloat(item.product.final_price)), 0);

        let message = `¡Hola Dulce Arte! Quisiera encargar: ${itemsText}. Fecha de entrega deseada: ${deliveryDate} (Horario ${this.businessConfig.delivery_hours}). Nombre: ${clientName}`;
        if (clientPhone) {
            message += `. Teléfono de contacto: ${clientPhone}`;
        }
        message += `. Total estimado: $${totalPrice.toLocaleString('es-AR', {minimumFractionDigits: 2})}.`;

        // 1. Asentar también en la base de datos en estado "pending" para el pastelero
        try {
            await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: clientName,
                    client_phone: clientPhone || this.businessConfig.whatsapp_number,
                    delivery_date: deliveryDate,
                    delivery_time_slot: this.businessConfig.delivery_hours,
                    status: 'pending',
                    total_price: totalPrice,
                    items: this.cart.map(i => ({
                        product_id: i.product.id,
                        quantity: i.quantity,
                        unit_price: parseFloat(i.product.final_price)
                    }))
                })
            });
        } catch (e) {
            console.warn('No se pudo pre-guardar pedido en backend, procediendo con WhatsApp...');
        }

        // 2. Abrir WhatsApp con el mensaje estructurado
        const cleanPhone = this.businessConfig.whatsapp_number.replace(/\D/g, '');
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

        // Limpiar carrito tras completar
        this.cart = [];
        this.saveCartToStorage();
        this.updateCartUI();
        this.toggleCartDrawer(false);

        // Abrir ventana de chat
        window.open(waUrl, '_blank');
    }

    saveCartToStorage() {
        try {
            localStorage.setItem('dulce_arte_cart', JSON.stringify(this.cart));
        } catch (e) {}
    }

    loadCartFromStorage() {
        try {
            const data = localStorage.getItem('dulce_arte_cart');
            if (data) {
                this.cart = JSON.parse(data);
            }
        } catch (e) {
            this.cart = [];
        }
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

// Inicializar Catálogo al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    window.catalogApp = new CatalogApp();
});
