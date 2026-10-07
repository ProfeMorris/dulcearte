<?php
/**
 * Front Controller & API Router de Dulce Arte.
 */

// Encabezados CORS globales
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseDir = dirname(__DIR__);
require_once $baseDir . '/database/Database.php';
require_once $baseDir . '/src/Controllers/ApiController.php';
require_once $baseDir . '/src/Controllers/IngredientController.php';
require_once $baseDir . '/src/Controllers/ProductController.php';
require_once $baseDir . '/src/Controllers/RecipeController.php';
require_once $baseDir . '/src/Controllers/OrderController.php';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Normalizar URI quitando prefijo de subcarpeta si se corre bajo Apache (ej: /DulceArte26/public/api/...)
if (preg_match('#/api(/.*)?$#', $uri, $matches)) {
    $apiPath = '/api' . ($matches[1] ?? '');
} else {
    $apiPath = $uri;
}

// Router de Endpoints API
try {
    // 1. Salud y Configuración
    if ($apiPath === '/api/health' && $method === 'GET') {
        (new ApiController())->health();
    }
    if ($apiPath === '/api/config' && $method === 'GET') {
        (new ApiController())->businessConfig();
    }
    if ($apiPath === '/api/stats' && $method === 'GET') {
        (new ApiController())->stats();
    }
    if ($apiPath === '/api/availability' && $method === 'GET') {
        (new ApiController())->availability();
    }

    // 2. Ingredientes
    if ($apiPath === '/api/ingredients' && $method === 'GET') {
        (new IngredientController())->index();
    }
    if (preg_match('#^/api/ingredients/(\d+)$#', $apiPath, $m) && $method === 'GET') {
        (new IngredientController())->show((int)$m[1]);
    }
    if ($apiPath === '/api/ingredients' && $method === 'POST') {
        (new IngredientController())->create();
    }
    if (preg_match('#^/api/ingredients/(\d+)$#', $apiPath, $m) && in_array($method, ['PUT', 'PATCH', 'POST'])) {
        (new IngredientController())->update((int)$m[1]);
    }
    if (preg_match('#^/api/ingredients/(\d+)$#', $apiPath, $m) && $method === 'DELETE') {
        (new IngredientController())->delete((int)$m[1]);
    }

    // 3. Productos
    if ($apiPath === '/api/products' && $method === 'GET') {
        (new ProductController())->index();
    }
    if (preg_match('#^/api/products/(\d+)$#', $apiPath, $m) && $method === 'GET') {
        (new ProductController())->show((int)$m[1]);
    }
    if ($apiPath === '/api/products' && $method === 'POST') {
        (new ProductController())->create();
    }
    if (preg_match('#^/api/products/(\d+)$#', $apiPath, $m) && in_array($method, ['PUT', 'POST'])) {
        (new ProductController())->update((int)$m[1]);
    }
    if (preg_match('#^/api/products/(\d+)/toggle-catalog$#', $apiPath, $m) && in_array($method, ['PATCH', 'POST'])) {
        (new ProductController())->toggleCatalog((int)$m[1]);
    }
    if (preg_match('#^/api/products/(\d+)/recalculate$#', $apiPath, $m) && $method === 'POST') {
        (new ProductController())->recalculate((int)$m[1]);
    }
    if (preg_match('#^/api/products/(\d+)$#', $apiPath, $m) && $method === 'DELETE') {
        (new ProductController())->delete((int)$m[1]);
    }

    // 4. Recetas / Escandallos
    if (preg_match('#^/api/recipes/(\d+)$#', $apiPath, $m) && $method === 'GET') {
        (new RecipeController())->show((int)$m[1]);
    }
    if (preg_match('#^/api/recipes/(\d+)$#', $apiPath, $m) && $method === 'POST') {
        (new RecipeController())->saveItem((int)$m[1]);
    }
    if (preg_match('#^/api/recipes/(\d+)$#', $apiPath, $m) && $method === 'PUT') {
        (new RecipeController())->sync((int)$m[1]);
    }
    if (preg_match('#^/api/recipes/items/(\d+)$#', $apiPath, $m) && $method === 'DELETE') {
        (new RecipeController())->deleteItem((int)$m[1]);
    }

    // 5. Pedidos y Agenda
    if ($apiPath === '/api/orders' && $method === 'GET') {
        (new OrderController())->index();
    }
    if (preg_match('#^/api/orders/(\d+)$#', $apiPath, $m) && $method === 'GET') {
        (new OrderController())->show((int)$m[1]);
    }
    if ($apiPath === '/api/orders' && $method === 'POST') {
        (new OrderController())->create();
    }
    if (preg_match('#^/api/orders/(\d+)/status$#', $apiPath, $m) && in_array($method, ['PATCH', 'POST'])) {
        (new OrderController())->updateStatus((int)$m[1]);
    }
    if (preg_match('#^/api/orders/(\d+)$#', $apiPath, $m) && $method === 'DELETE') {
        (new OrderController())->delete((int)$m[1]);
    }

    // Si no coincide con ninguna ruta API
    if (str_starts_with($apiPath, '/api')) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error' => "Endpoint no encontrado: [{$method}] {$apiPath}"
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Si no es API, servir el catálogo
    require __DIR__ . '/index.html';

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => 'Error interno en el servidor: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
