<?php
/**
 * Router para el servidor integrado de PHP (php -S localhost:8000 router.php).
 * Redirige rutas de API a public/index.php y sirve archivos estáticos directamente.
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Si es ruta de API, procesar con el front controller
if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/public/index.php';
    return;
}

// Ruta para el panel de administración
if ($uri === '/admin' || $uri === '/admin/') {
    require __DIR__ . '/public/admin/index.html';
    return;
}

// Comprobar si el archivo existe dentro de public/
$publicFile = __DIR__ . '/public' . $uri;

if (is_file($publicFile)) {
    // Servir con el tipo MIME correcto
    $ext = pathinfo($publicFile, PATHINFO_EXTENSION);
    $mimes = [
        'css'  => 'text/css',
        'js'   => 'application/javascript',
        'json' => 'application/json',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'gif'  => 'image/gif',
        'svg'  => 'image/svg+xml',
        'ico'  => 'image/x-icon',
        'woff2'=> 'font/woff2',
        'html' => 'text/html; charset=utf-8'
    ];
    if (isset($mimes[$ext])) {
        header("Content-Type: {$mimes[$ext]}");
    }
    readfile($publicFile);
    return;
}

// Por defecto, servir el catálogo público si la ruta no tiene extensión
if (!str_contains($uri, '.')) {
    require __DIR__ . '/public/index.html';
    return;
}

return false;
