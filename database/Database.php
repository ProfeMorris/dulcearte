<?php
/**
 * Capa de Conexión a Base de Datos (PDO) para Dulce Arte.
 * Soporta MySQL (MariaDB XAMPP) con fallback automático transparente a SQLite.
 */

class Database {
    private static ?PDO $instance = null;
    private static string $driver = 'mysql';

    public static function getConnection(): PDO {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $config = require dirname(__DIR__) . '/config/config.php';
        $dbConfig = $config['db'];
        $preferredDriver = $dbConfig['driver'] ?? 'mysql';

        // Intentar conectar a MySQL si fue seleccionado
        if ($preferredDriver === 'mysql') {
            try {
                $dsn = sprintf(
                    "mysql:host=%s;port=%s;charset=utf8mb4",
                    $dbConfig['host'],
                    $dbConfig['port']
                );
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ];

                $pdo = new PDO($dsn, $dbConfig['user'], $dbConfig['pass'], $options);
                
                // Asegurar que la base de datos exista
                $dbName = $dbConfig['dbname'];
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                $pdo->exec("USE `{$dbName}`;");

                self::$instance = $pdo;
                self::$driver = 'mysql';
                return self::$instance;
            } catch (PDOException $e) {
                // Si MySQL no está disponible, en desarrollo usamos SQLite para que el sistema funcione de inmediato
                error_log("Aviso: No se pudo conectar a MySQL (" . $e->getMessage() . "). Usando SQLite como alternativa.");
                return self::connectSqlite($dbConfig['sqlite_path']);
            }
        }

        return self::connectSqlite($dbConfig['sqlite_path']);
    }

    private static function connectSqlite(string $sqlitePath): PDO {
        $dir = dirname($sqlitePath);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $dsn = "sqlite:" . $sqlitePath;
        $pdo = new PDO($dsn, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        // Habilitar claves foráneas en SQLite
        $pdo->exec("PRAGMA foreign_keys = ON;");

        self::$instance = $pdo;
        self::$driver = 'sqlite';
        return self::$instance;
    }

    public static function getDriver(): string {
        if (self::$instance === null) {
            self::getConnection();
        }
        return self::$driver;
    }

    /**
     * Inicializa las tablas y datos si están vacíos.
     */
    public static function migrateAndSeed(): array {
        $pdo = self::getConnection();
        $driver = self::getDriver();

        if ($driver === 'mysql') {
            $schemaFile = dirname(__DIR__) . '/database/schema.sql';
            $seedFile = dirname(__DIR__) . '/database/seed.sql';

            $pdo->exec(file_get_contents($schemaFile));
            $pdo->exec(file_get_contents($seedFile));
            return ['driver' => 'mysql', 'status' => 'success', 'message' => 'Esquema y semillas cargadas en MySQL.'];
        } else {
            // Esquema SQLite compatible
            self::migrateSqlite($pdo);
            return ['driver' => 'sqlite', 'status' => 'success', 'message' => 'Esquema y semillas cargadas en SQLite.'];
        }
    }

    private static function migrateSqlite(PDO $pdo): void {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                unit_of_measure TEXT NOT NULL,
                cost_per_unit REAL NOT NULL DEFAULT 0.0,
                stock_quantity REAL NOT NULL DEFAULT 0.0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT,
                profit_margin_percentage REAL NOT NULL DEFAULT 35.0,
                fixed_overhead_percentage REAL NOT NULL DEFAULT 15.0,
                cost_price REAL NOT NULL DEFAULT 0.0,
                final_price REAL NOT NULL DEFAULT 0.0,
                is_active_in_catalog INTEGER NOT NULL DEFAULT 1,
                image_url TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS product_recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                ingredient_id INTEGER NOT NULL,
                quantity_required REAL NOT NULL DEFAULT 0.0,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT,
                UNIQUE (product_id, ingredient_id)
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_name TEXT NOT NULL,
                client_phone TEXT NOT NULL,
                delivery_date TEXT NOT NULL,
                delivery_time_slot TEXT NOT NULL DEFAULT '17:00 a 20:00 hs',
                status TEXT NOT NULL DEFAULT 'pending',
                total_price REAL NOT NULL DEFAULT 0.0,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price REAL NOT NULL DEFAULT 0.0,
                subtotal REAL NOT NULL DEFAULT 0.0,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS production_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                max_orders_per_day INTEGER NOT NULL DEFAULT 8,
                delivery_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
                delivery_hours TEXT NOT NULL DEFAULT '17:00 a 20:00 hs',
                whatsapp_number TEXT NOT NULL DEFAULT '5493804232210'
            );
        ");

        // Verificar si ya hay datos
        $count = $pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
        if ($count == 0) {
            $pdo->exec("
                INSERT OR IGNORE INTO production_config (id, max_orders_per_day, delivery_days, delivery_hours, whatsapp_number)
                VALUES (1, 8, '1,2,3,4,5,6', '17:00 a 20:00 hs', '5493804232210');

                INSERT OR IGNORE INTO ingredients (id, name, unit_of_measure, cost_per_unit, stock_quantity) VALUES
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
                (14, 'Frutos Rojos Frescos Seleccionados', 'gr', 12.50, 3000);

                INSERT OR IGNORE INTO products (id, name, category, description, profit_margin_percentage, fixed_overhead_percentage, cost_price, final_price, is_active_in_catalog, image_url) VALUES
                (1, 'Pastafrola Tradicional de Membrillo', 'daily', 'Clásica masa dulce artesanal perfumada con vainilla y rellena de abundante dulce de membrillo rubí con enrejado dorado crocante.', 40.00, 15.00, 4845.00, 7509.75, 1, 'assets/images/pastafrola_membrillo.jpg'),
                (2, 'Docena de Maicenitas con Dulce de Leche', 'daily', 'Suaves y delicados alfajorcitos de maicena que se deshacen en la boca, rellenos de auténtico dulce de leche repostero y rebozados en coco rallado.', 45.00, 15.00, 5846.00, 9353.60, 1, 'assets/images/maicenitas_dulce_leche.jpg'),
                (3, 'Bizcochuelo Casero de Vainilla', 'daily', 'Bizcochuelo alto, esponjoso y aireado con notas sutiles de limón y vainilla pura, terminado con una fina lluvia de azúcar impalpable.', 35.00, 15.00, 2032.50, 3048.75, 1, 'assets/images/bizcochuelo_casero.jpg'),
                (4, 'Galletas Artesanales Surtidas (300 gr)', 'daily', 'Selección de cookies horneadas en el día: sablés de vainilla y manteca, y galletas crocantes con chispas de chocolate semiamargo.', 40.00, 15.00, 2873.00, 4453.15, 1, 'assets/images/galletas_artesanales.jpg'),
                (5, 'Torta Celebración Especial - Mesa Dulce', 'event', 'Imponente torta temática de dos pisos con drip de chocolate, buttercream de mascarpone, frutos rojos frescos, macarons artesanales y topper decorativo.', 50.00, 20.00, 15285.00, 25984.50, 1, 'assets/images/torta_evento_dulce.jpg');

                INSERT OR IGNORE INTO product_recipes (product_id, ingredient_id, quantity_required) VALUES
                (1, 1, 400.00), (1, 2, 200.00), (1, 4, 200.00), (1, 3, 2.00), (1, 5, 450.00), (1, 9, 5.00), (1, 10, 10.00),
                (2, 7, 300.00), (2, 1, 150.00), (2, 4, 150.00), (2, 2, 120.00), (2, 3, 3.00), (2, 6, 400.00), (2, 8, 80.00), (2, 9, 5.00), (2, 10, 11.50),
                (3, 1, 300.00), (3, 2, 220.00), (3, 3, 4.00), (3, 12, 150.00), (3, 9, 10.00), (3, 10, 15.00), (3, 4, 25.00),
                (4, 1, 250.00), (4, 4, 150.00), (4, 2, 120.00), (4, 3, 1.00), (4, 11, 100.00), (4, 9, 5.00),
                (5, 1, 600.00), (5, 2, 500.00), (5, 3, 8.00), (5, 4, 350.00), (5, 6, 600.00), (5, 13, 400.00), (5, 14, 200.00), (5, 11, 80.00);

                INSERT OR IGNORE INTO orders (id, client_name, client_phone, delivery_date, delivery_time_slot, status, total_price, notes) VALUES
                (1, 'María Florencia Gómez', '3804551122', date('now'), '17:00 a 20:00 hs', 'confirmed', 7509.75, 'Tocar timbre 3B'),
                (2, 'Gonzalo Martínez', '3804889900', date('now'), '17:00 a 20:00 hs', 'pending', 9353.60, 'Pago en efectivo contra entrega'),
                (3, 'Carla Lucero', '3804123456', date('now', '+1 day'), '17:00 a 20:00 hs', 'pending', 12402.35, 'Cumpleaños familiar');

                INSERT OR IGNORE INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES
                (1, 1, 1, 7509.75, 7509.75),
                (2, 2, 1, 9353.60, 9353.60),
                (3, 1, 1, 7509.75, 7509.75),
                (3, 4, 1, 4453.15, 4453.15);
            ");
        }
    }
}
