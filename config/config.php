<?php
/**
 * Configuración central y cargador de variables de entorno para Dulce Arte.
 */

// Cargar archivo .env de forma ligera sin dependencias externas
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        if (str_contains($line, '=')) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            // Quitar comillas si las hay
            if ((str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))) {
                $value = substr($value, 1, -1);
            }
            if (!array_key_exists($key, $_SERVER) && !array_key_exists($key, $_ENV)) {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

$rootPath = dirname(__DIR__);
loadEnv($rootPath . '/.env');

function env($key, $default = null) {
    $val = getenv($key);
    if ($val === false) {
        return $_ENV[$key] ?? $default;
    }
    return $val;
}

return [
    'app_name' => env('APP_NAME', 'Dulce Arte'),
    'app_env' => env('APP_ENV', 'development'),
    'app_url' => env('APP_URL', 'http://localhost:8000'),
    'db' => [
        'driver' => env('DB_DRIVER', 'mysql'),
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '3306'),
        'dbname' => env('DB_NAME', 'dulce_arte_db'),
        'user' => env('DB_USER', 'root'),
        'pass' => env('DB_PASS', ''),
        'sqlite_path' => $rootPath . '/' . env('DB_SQLITE_PATH', 'database/dulce_arte.sqlite'),
    ],
    'business' => [
        'whatsapp_number' => env('WHATSAPP_NUMBER', '5493804232210'),
        'max_daily_orders' => (int)env('MAX_DAILY_ORDERS', 8),
        'delivery_hours' => env('DELIVERY_HOURS', '17:00 a 20:00 hs'),
        'delivery_days' => explode(',', env('DELIVERY_DAYS', '1,2,3,4,5,6')),
        'instagram' => env('INSTAGRAM_USER', 'dulceartelr'),
        'facebook' => env('FACEBOOK_USER', 'dulceartedulce'),
    ]
];
