<?php
/**
 * Controlador de API de Disponibilidad, Configuración y Estadísticas para Dulce Arte.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/Services/AvailabilityService.php';
require_once dirname(__DIR__, 2) . '/database/Database.php';

class ApiController extends BaseController {
    public function availability(): void {
        $date = $_GET['date'] ?? date('Y-m-d');
        $service = new AvailabilityService();
        $result = $service->checkAvailability($date);
        $this->json($result);
    }

    public function businessConfig(): void {
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $service = new AvailabilityService();
        $dbConfig = $service->getConfig();

        $this->jsonSuccess([
            'business' => [
                'name' => $config['app_name'],
                'whatsapp_number' => $dbConfig['whatsapp_number'] ?? $config['business']['whatsapp_number'],
                'max_daily_orders' => (int)($dbConfig['max_orders_per_day'] ?? $config['business']['max_daily_orders']),
                'delivery_hours' => $dbConfig['delivery_hours'] ?? $config['business']['delivery_hours'],
                'delivery_days' => $dbConfig['delivery_days'] ?? '1,2,3,4,5,6',
                'instagram' => $config['business']['instagram'],
                'facebook' => $config['business']['facebook'],
            ]
        ]);
    }

    public function stats(): void {
        $db = Database::getConnection();

        $totalIngredients = (int)$db->query("SELECT COUNT(*) FROM ingredients")->fetchColumn();
        $totalProducts = (int)$db->query("SELECT COUNT(*) FROM products")->fetchColumn();
        $activeProducts = (int)$db->query("SELECT COUNT(*) FROM products WHERE is_active_in_catalog = 1")->fetchColumn();
        $pendingOrders = (int)$db->query("SELECT COUNT(*) FROM orders WHERE status = 'pending'")->fetchColumn();
        $confirmedOrders = (int)$db->query("SELECT COUNT(*) FROM orders WHERE status = 'confirmed'")->fetchColumn();
        $todayOrders = (int)$db->query("SELECT COUNT(*) FROM orders WHERE delivery_date = CURRENT_DATE AND status != 'cancelled'")->fetchColumn();

        $this->jsonSuccess([
            'stats' => [
                'total_ingredients' => $totalIngredients,
                'total_products' => $totalProducts,
                'active_products' => $activeProducts,
                'pending_orders' => $pendingOrders,
                'confirmed_orders' => $confirmedOrders,
                'today_orders' => $todayOrders,
                'max_daily_orders' => 8
            ]
        ]);
    }

    public function health(): void {
        $driver = Database::getDriver();
        $this->jsonSuccess([
            'status' => 'online',
            'app' => 'Dulce Arte API',
            'timestamp' => date('c'),
            'database' => $driver
        ]);
    }
}
