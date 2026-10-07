# 🍰 Dulce Arte - Sistema de Gestión y Catálogo Web

Sistema integral para **Dulce Arte**, pastelería artesanal que opera bajo modalidad de encargos previos con entregas de lunes a sábado de 17:00 a 20:00 hs.

El proyecto consta de dos entornos principales:
1. **Panel de Administración Interno:** Gestión de insumos con costos unitarios, constructor interactivo de escandallos (recálculo en cascada de costo de producción y precio de venta final), control de visibilidad en catálogo y agenda/calendario de entregas.
2. **Catálogo Web Público:** Landing page de marca familiar, catálogo responsivo con filtros de productos diarios y eventos, carrito interactivo y generador de pedidos directos por WhatsApp (`wa.me`).

---

## 🚀 Requisitos del Sistema

- **PHP 8.x** (compatible con XAMPP en `C:\xampp\php\php.exe` o PHP global).
- **MySQL / MariaDB** (compatible con XAMPP en puerto 3306) o **SQLite** (activación automática de contingencia sin configuración adicional).
- **Navegador Web Moderno** (Chrome, Firefox, Edge, Safari).

---

## ⚡ Inicio Rápido en Desarrollo

### Opción 1: Lanzador con 1 Clic (Recomendado en Windows)
Haz doble clic sobre el archivo:
```
scripts/start-server.bat
```
El script verificará la base de datos, correrá las migraciones y levantará el servidor web en:
- **Catálogo Web Público:** [http://localhost:8000](http://localhost:8000)
- **Panel de Administración:** [http://localhost:8000/admin](http://localhost:8000/admin)

### Opción 2: Desde la Terminal (PowerShell / CMD)
```powershell
# 1. Ejecutar migraciones y datos iniciales
& "C:\xampp\php\php.exe" scripts/migrate.php

# 2. Iniciar servidor integrado
& "C:\xampp\php\php.exe" -S localhost:8000 router.php
```

---

## 📐 Fórmulas Matemáticas de Costeo y Escandallo

El sistema implementa en tiempo real las siguientes fórmulas para cada producto:

$$\text{Costo Materia Prima} = \sum (\text{Costo Unitario Insumo} \times \text{Cantidad Requerida})$$

$$\text{Precio Venta Final} = \text{Costo Materia Prima} \times \left(1 + \frac{\text{Margen \%}}{100} + \frac{\text{Costos Fijos \%}}{100}\right)$$

### 🔄 Recálculo en Cascada
Cuando se actualiza el costo de cualquier ingrediente en el panel de insumos (ej. harina, manteca, dulce de leche), el backend detecta automáticamente todas las recetas que lo utilizan y actualiza sus costos de materia prima y precios de venta sugeridos.

---

## 📱 Integración con WhatsApp (`wa.me`)

El catálogo público compila los productos seleccionados, valida la disponibilidad de la fecha de entrega seleccionada (lunes a sábado, 17:00 a 20:00 hs, máximo 8 pedidos diarios) y genera el mensaje formateado:

```text
¡Hola Dulce Arte! Quisiera encargar: 1x Pastafrola Tradicional de Membrillo, 1x Docena de Maicenitas con Dulce de Leche. Fecha de entrega deseada: 2026-10-05 (Horario 17:00 a 20:00 hs). Nombre: María Gómez.
```

El número de WhatsApp configurado para Dulce Arte es: **`+54 9 3804 23-2210`**.

---

## 🗄️ Esquema de Base de Datos Relacional

1. **`ingredients`**: Insumos base con unidad (`gr`, `kg`, `ml`, `l`, `unidad`), costo unitario y stock.
2. **`products`**: Productos finales, categoría (`daily` / `event`), margen %, costos fijos %, costo calculado, precio final y estado en catálogo.
3. **`product_recipes`**: Tabla intermedia que vincula productos con sus ingredientes y cantidades requeridas para el escandallo.
4. **`orders`**: Pedidos registrados con fecha de entrega, franja horaria, estado (`pending`, `confirmed`, `delivered`, `cancelled`) y total.
5. **`order_items`**: Detalle de productos y cantidades de cada pedido.
6. **`production_config`**: Parámetros de negocio (capacidad máxima de 8 pedidos diarios, horario 17 a 20 hs, teléfono WhatsApp).

---

## 🔌 API RESTful Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del sistema y base de datos activa |
| `GET` | `/api/config` | Parámetros comerciales y teléfono WhatsApp |
| `GET` | `/api/stats` | Resumen de métricas para el panel |
| `GET` | `/api/availability?date=YYYY-MM-DD` | Valida cupos y horario de entrega para una fecha |
| `GET` | `/api/products` | Lista de productos con precios calculados |
| `PATCH` | `/api/products/{id}/toggle-catalog` | Alterna visibilidad en catálogo público |
| `GET` | `/api/ingredients` | Lista de insumos y sus recetas vinculadas |
| `POST` | `/api/ingredients` | Alta de nuevo insumo |
| `PUT` | `/api/ingredients/{id}` | Modificación de costo (dispara recálculo en cascada) |
| `GET` | `/api/recipes/{productId}` | Desglose completo de escandallo de un producto |
| `POST` | `/api/recipes/{productId}` | Añadir o actualizar ingrediente en escandallo |
| `GET` | `/api/orders` | Lista de pedidos para la agenda de producción |
| `POST` | `/api/orders` | Registro de nuevo pedido |
| `PATCH` | `/api/orders/{id}/status` | Cambio de estado de pedido |

---

## 🛠️ Configuración de Entorno (`.env`)

```ini
APP_NAME="Dulce Arte"
APP_ENV=development
APP_URL=http://localhost:8000

# Base de datos
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=dulce_arte_db
DB_USER=root
DB_PASS=

# Configuración del Negocio
WHATSAPP_NUMBER=5493804232210
MAX_DAILY_ORDERS=8
DELIVERY_HOURS="17:00 a 20:00 hs"
DELIVERY_DAYS="1,2,3,4,5,6"

# Redes Sociales
INSTAGRAM_USER=dulceartelr
FACEBOOK_USER=dulceartedulce
```

---

## 🧪 Pruebas Unitarias del Motor

Para ejecutar las pruebas del motor de costos, recálculo en cascada y validación de domingos:
```powershell
& "C:\xampp\php\php.exe" scripts/test_costing.php
```

---

© 2026 **Dulce Arte** - Pastelería Artesanal.
