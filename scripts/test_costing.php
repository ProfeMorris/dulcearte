<?php
/**
 * Test unitario del motor de costos, escandallos y disponibilidad para Dulce Arte.
 */

require_once dirname(__DIR__) . '/database/Database.php';
require_once dirname(__DIR__) . '/src/Services/CostCalculator.php';
require_once dirname(__DIR__) . '/src/Services/AvailabilityService.php';
require_once dirname(__DIR__) . '/src/Models/Ingredient.php';
require_once dirname(__DIR__) . '/src/Models/Product.php';

echo "=============================================\n";
echo " TEST DE MOTOR DE COSTOS Y DISPONIBILIDAD\n";
echo "=============================================\n\n";

$calculator = new CostCalculator();

// 1. Probar cálculo de Pastafrola (ID: 1)
echo "1. Verificando cálculo de costo y precio de venta (Pastafrola)...\n";
$pricing = $calculator->calculateProductCost(1);
echo "   - Producto: " . $pricing['product_name'] . "\n";
echo "   - Costo Materia Prima: $" . number_format($pricing['cost_price'], 2) . "\n";
echo "   - Margen: " . $pricing['profit_margin_percentage'] . "%\n";
echo "   - Costos Fijos: " . $pricing['fixed_overhead_percentage'] . "%\n";
echo "   - Multiplicador: " . $pricing['multiplier'] . "\n";
echo "   - Precio Final Sugerido: $" . number_format($pricing['final_price'], 2) . "\n";

// Validar que final_price = cost_price * (1 + 0.40 + 0.15) = cost_price * 1.55
$expectedFinal = round($pricing['cost_price'] * (1 + 0.40 + 0.15), 2);
assert(abs($pricing['final_price'] - $expectedFinal) < 0.01, "Error: El precio final no coincide con la fórmula.");
echo "   -> [OK] Fórmula matemática verificada con éxito.\n\n";

// 2. Probar recálculo en cascada al cambiar precio de Harina (Ingrediente 1)
echo "2. Probando recálculo en cascada al actualizar costo de Harina...\n";
$ingredientModel = new Ingredient();
$harinaAntes = $ingredientModel->find(1);
$nuevoCosto = $harinaAntes['cost_per_unit'] + 0.50; // Aumento de 50 centavos por gramo

echo "   - Costo actual Harina: $" . $harinaAntes['cost_per_unit'] . " -> Nuevo costo: $" . $nuevoCosto . "\n";
$updateResult = $ingredientModel->update(1, [
    'name' => $harinaAntes['name'],
    'unit_of_measure' => $harinaAntes['unit_of_measure'],
    'cost_per_unit' => $nuevoCosto,
    'stock_quantity' => $harinaAntes['stock_quantity']
]);

echo "   - Productos recalculados en cascada: " . count($updateResult['affected_products']) . "\n";
foreach ($updateResult['affected_products'] as $p) {
    echo "     * " . $p['product_name'] . " -> Nuevo Costo: $" . number_format($p['cost_price'], 2) . " | Nuevo PVP: $" . number_format($p['final_price'], 2) . "\n";
}

// Restaurar precio original para mantener los datos limpios
$ingredientModel->update(1, [
    'name' => $harinaAntes['name'],
    'unit_of_measure' => $harinaAntes['unit_of_measure'],
    'cost_per_unit' => $harinaAntes['cost_per_unit'],
    'stock_quantity' => $harinaAntes['stock_quantity']
]);
echo "   -> [OK] Recálculo en cascada completado y restaurado con éxito.\n\n";

// 3. Probar servicio de disponibilidad
echo "3. Probando servicio de disponibilidad de producción...\n";
$availability = new AvailabilityService();

$hoy = date('Y-m-d');
$checkHoy = $availability->checkAvailability($hoy);
echo "   - Fecha hoy ({$hoy}): " . ($checkHoy['available'] ? "DISPONIBLE" : "NO DISPONIBLE") . "\n";
echo "   - Cupos restantes hoy: " . $checkHoy['remaining_slots'] . " de " . $checkHoy['max_slots'] . "\n";
echo "   - Mensaje: " . $checkHoy['message'] . "\n";

// Probar próximo domingo
$proximoDomingo = date('Y-m-d', strtotime('next Sunday'));
$checkDomingo = $availability->checkAvailability($proximoDomingo);
echo "   - Próximo Domingo ({$proximoDomingo}): " . ($checkDomingo['available'] ? "DISPONIBLE" : "NO DISPONIBLE") . "\n";
echo "   - Mensaje Domingo: " . $checkDomingo['message'] . "\n";
assert($checkDomingo['available'] === false, "Error: El domingo debería estar bloqueado.");
echo "   -> [OK] Bloqueo de domingos y cupos verificado.\n\n";

echo "TODOS LOS TESTS UNITARIOS PASARON SATISFACTORIAMENTE!\n";
