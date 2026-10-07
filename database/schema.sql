-- ============================================================
-- BASE DE DATOS DULCE ARTE
-- Sistema de Gestión y Catálogo Web de Pastelería Artesanal
-- ============================================================

CREATE DATABASE IF NOT EXISTS `dulce_arte_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `dulce_arte_db`;

-- 1. Tabla de Ingredientes (Insumos Base)
CREATE TABLE IF NOT EXISTS `ingredients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `unit_of_measure` ENUM('gr', 'kg', 'ml', 'l', 'unidad') NOT NULL,
    `cost_per_unit` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `stock_quantity` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Productos
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `category` ENUM('daily', 'event') NOT NULL,
    `description` TEXT NULL,
    `profit_margin_percentage` DECIMAL(5,2) NOT NULL DEFAULT 35.00,
    `fixed_overhead_percentage` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `final_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `is_active_in_catalog` TINYINT(1) NOT NULL DEFAULT 1,
    `image_url` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Recetas / Escandallos (Relación Producto - Ingredientes)
CREATE TABLE IF NOT EXISTS `product_recipes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `ingredient_id` INT NOT NULL,
    `quantity_required` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT `fk_recipe_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_recipe_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE RESTRICT,
    UNIQUE KEY `uk_product_ingredient` (`product_id`, `ingredient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de Pedidos
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_name` VARCHAR(150) NOT NULL,
    `client_phone` VARCHAR(50) NOT NULL,
    `delivery_date` DATE NOT NULL,
    `delivery_time_slot` VARCHAR(50) NOT NULL DEFAULT '17:00 a 20:00 hs',
    `status` ENUM('pending', 'confirmed', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    `total_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_delivery_date` (`delivery_date`),
    INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de Items del Pedido
CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Configuración de Capacidad y Negocio
CREATE TABLE IF NOT EXISTS `production_config` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `max_orders_per_day` INT NOT NULL DEFAULT 8,
    `delivery_days` VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5,6',
    `delivery_hours` VARCHAR(50) NOT NULL DEFAULT '17:00 a 20:00 hs',
    `whatsapp_number` VARCHAR(30) NOT NULL DEFAULT '5493804232210'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
