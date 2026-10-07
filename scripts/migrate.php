<?php
/**
 * Script de inicialización y migración para Dulce Arte.
 * Ejecución: php scripts/migrate.php
 */

require_once dirname(__DIR__) . '/database/Database.php';

echo "=== Dulce Arte - Ejecución de Migraciones ===\n";

try {
    $result = Database::migrateAndSeed();
    echo "Controlador de Base de Datos: " . strtoupper($result['driver']) . "\n";
    echo "Estado: " . $result['status'] . "\n";
    echo "Detalle: " . $result['message'] . "\n";
    echo "Migración completada con éxito.\n";
} catch (Exception $e) {
    echo "ERROR en la migración: " . $e->getMessage() . "\n";
    exit(1);
}
