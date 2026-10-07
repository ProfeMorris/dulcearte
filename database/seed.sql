-- ============================================================
-- DATOS INICIALES (SEEDS) - DULCE ARTE
-- ============================================================

USE `dulce_arte_db`;

-- Configuración de producción
INSERT INTO `production_config` (`id`, `max_orders_per_day`, `delivery_days`, `delivery_hours`, `whatsapp_number`)
VALUES (1, 8, '1,2,3,4,5,6', '17:00 a 20:00 hs', '5493804232210')
ON DUPLICATE KEY UPDATE `max_orders_per_day` = 8, `whatsapp_number` = '5493804232210';

-- Ingredientes e insumos con costos base unitarios (en Pesos Argentinos)
INSERT INTO `ingredients` (`id`, `name`, `unit_of_measure`, `cost_per_unit`, `stock_quantity`) VALUES
(1, 'Harina 0000 Especial', 'gr', 1.30, 25000),
(2, 'Azúcar Común de Caña', 'gr', 1.15, 20000),
(3, 'Huevos de Granja', 'unidad', 190.00, 120),
(4, 'Manteca Primerísima Calidad', 'gr', 8.50, 8000),
(5, 'Dulce de Membrillo Artesanal', 'gr', 4.20, 15000),
(6, 'Dulce de Leche Repostero Premium', 'gr', 5.80, 18000),
(7, 'Fécula de Maíz (Maicena)', 'gr', 2.40, 10000),
(8, 'Coco Rallado Blanco Fino', 'gr', 6.20, 4000),
(9, 'Esencia Natural de Vainilla', 'ml', 16.00, 1000),
(10, 'Polvo para Hornear', 'gr', 4.50, 1500),
(11, 'Chocolate Semiamargo en Gotas', 'gr', 9.20, 6000),
(12, 'Leche Entera Homogeneizada', 'ml', 1.25, 10000),
(13, 'Crema de Leche Pastelera 36%', 'ml', 6.80, 5000),
(14, 'Frutos Rojos Frescos Seleccionados', 'gr', 12.50, 3000)
ON DUPLICATE KEY UPDATE `cost_per_unit` = VALUES(`cost_per_unit`), `stock_quantity` = VALUES(`stock_quantity`);

-- Productos del Catálogo
INSERT INTO `products` (`id`, `name`, `category`, `description`, `profit_margin_percentage`, `fixed_overhead_percentage`, `cost_price`, `final_price`, `is_active_in_catalog`, `image_url`) VALUES
(1, 'Pastafrola Tradicional de Membrillo', 'daily', 'Clásica masa dulce artesanal perfumada con vainilla y rellena de abundante dulce de membrillo rubí con enrejado dorado crocante.', 40.00, 15.00, 4845.00, 7509.75, 1, 'assets/images/pastafrola_membrillo.jpg'),
(2, 'Docena de Maicenitas con Dulce de Leche', 'daily', 'Suaves y delicados alfajorcitos de maicena que se deshacen en la boca, rellenos de auténtico dulce de leche repostero y rebozados en coco rallado.', 45.00, 15.00, 5846.00, 9353.60, 1, 'assets/images/maicenitas_dulce_leche.jpg'),
(3, 'Bizcochuelo Casero de Vainilla', 'daily', 'Bizcochuelo alto, esponjoso y aireado con notas sutiles de limón y vainilla pura, terminado con una fina lluvia de azúcar impalpable.', 35.00, 15.00, 2032.50, 3048.75, 1, 'assets/images/bizcochuelo_casero.jpg'),
(4, 'Galletas Artesanales Surtidas (300 gr)', 'daily', 'Selección de cookies horneadas en el día: sablés de vainilla y manteca, y galletas crocantes con chispas de chocolate semiamargo.', 40.00, 15.00, 2873.00, 4453.15, 1, 'assets/images/galletas_artesanales.jpg'),
(5, 'Torta Celebración Especial - Mesa Dulce', 'event', 'Imponente torta temática de dos pisos con drip de chocolate, buttercream de mascarpone, frutos rojos frescos, macarons artesanales y topper decorativo.', 50.00, 20.00, 15285.00, 25984.50, 1, 'assets/images/torta_evento_dulce.jpg')
ON DUPLICATE KEY UPDATE 
    `name` = VALUES(`name`),
    `description` = VALUES(`description`),
    `profit_margin_percentage` = VALUES(`profit_margin_percentage`),
    `fixed_overhead_percentage` = VALUES(`fixed_overhead_percentage`),
    `is_active_in_catalog` = VALUES(`is_active_in_catalog`),
    `image_url` = VALUES(`image_url`);

-- Escandallos / Recetas Base
-- 1. Pastafrola
INSERT INTO `product_recipes` (`product_id`, `ingredient_id`, `quantity_required`) VALUES
(1, 1, 400.00), -- 400g Harina ($520)
(1, 2, 200.00), -- 200g Azúcar ($230)
(1, 4, 200.00), -- 200g Manteca ($1700)
(1, 3, 2.00),   -- 2 Huevos ($380)
(1, 5, 450.00), -- 450g Membrillo ($1890)
(1, 9, 5.00),   -- 5ml Vainilla ($80)
(1, 10, 10.00)  -- 10g Polvo de hornear ($45)
ON DUPLICATE KEY UPDATE `quantity_required` = VALUES(`quantity_required`);

-- 2. Maicenitas (Docena)
INSERT INTO `product_recipes` (`product_id`, `ingredient_id`, `quantity_required`) VALUES
(2, 7, 300.00), -- 300g Maicena ($720)
(2, 1, 150.00), -- 150g Harina ($195)
(2, 4, 150.00), -- 150g Manteca ($1275)
(2, 2, 120.00), -- 120g Azúcar ($138)
(2, 3, 3.00),   -- 3 Huevos ($570)
(2, 6, 400.00), -- 400g Dulce de Leche ($2320)
(2, 8, 80.00),  -- 80g Coco ($496)
(2, 9, 5.00),   -- 5ml Vainilla ($80)
(2, 10, 11.50)  -- 11.5g Polvo hornear ($52)
ON DUPLICATE KEY UPDATE `quantity_required` = VALUES(`quantity_required`);

-- 3. Bizcochuelo
INSERT INTO `product_recipes` (`product_id`, `ingredient_id`, `quantity_required`) VALUES
(3, 1, 300.00), -- 300g Harina ($390)
(3, 2, 220.00), -- 220g Azúcar ($253)
(3, 3, 4.00),   -- 4 Huevos ($760)
(3, 12, 150.00),-- 150ml Leche ($187.50)
(3, 9, 10.00),  -- 10ml Vainilla ($160)
(3, 10, 15.00), -- 15g Polvo hornear ($67.50)
(3, 4, 25.00)   -- 25g Manteca en molde ($212.50)
ON DUPLICATE KEY UPDATE `quantity_required` = VALUES(`quantity_required`);

-- 4. Galletas
INSERT INTO `product_recipes` (`product_id`, `ingredient_id`, `quantity_required`) VALUES
(4, 1, 250.00), -- 250g Harina ($325)
(4, 4, 150.00), -- 150g Manteca ($1275)
(4, 2, 120.00), -- 120g Azúcar ($138)
(4, 3, 1.00),   -- 1 Huevo ($190)
(4, 11, 100.00),-- 100g Gotas chocolate ($920)
(4, 9, 5.00)    -- 5ml Vainilla ($80)
ON DUPLICATE KEY UPDATE `quantity_required` = VALUES(`quantity_required`);

-- 5. Torta Mesa Dulce Eventos
INSERT INTO `product_recipes` (`product_id`, `ingredient_id`, `quantity_required`) VALUES
(5, 1, 600.00), -- 600g Harina ($780)
(5, 2, 500.00), -- 500g Azúcar ($575)
(5, 3, 8.00),   -- 8 Huevos ($1520)
(5, 4, 350.00), -- 350g Manteca ($2975)
(5, 6, 600.00), -- 600g Dulce de Leche ($3480)
(5, 13, 400.00),-- 400ml Crema ($2720)
(5, 14, 200.00),-- 200g Frutos Rojos ($2500)
(5, 11, 80.00)  -- 80g Chocolate drip ($736)
ON DUPLICATE KEY UPDATE `quantity_required` = VALUES(`quantity_required`);

-- Pedidos de Ejemplo para visualizar la agenda de entregas
INSERT INTO `orders` (`id`, `client_name`, `client_phone`, `delivery_date`, `delivery_time_slot`, `status`, `total_price`, `notes`) VALUES
(1, 'María Florencia Gómez', '3804551122', CURDATE(), '17:00 a 20:00 hs', 'confirmed', 7509.75, 'Tocar timbre 3B'),
(2, 'Gonzalo Martínez', '3804889900', CURDATE(), '17:00 a 20:00 hs', 'pending', 9353.60, 'Pago en efectivo contra entrega'),
(3, 'Carla Lucero', '3804123456', DATE_ADD(CURDATE(), INTERVAL 1 DAY), '17:00 a 20:00 hs', 'pending', 12402.35, 'Cumpleaños familiar');

INSERT INTO `order_items` (`order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`) VALUES
(1, 1, 1, 7509.75, 7509.75),
(2, 2, 1, 9353.60, 9353.60),
(3, 1, 1, 7509.75, 7509.75),
(3, 4, 1, 4453.15, 4453.15);
