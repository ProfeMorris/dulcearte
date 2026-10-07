<?php
/**
 * Servicio de Cálculo de Costos y Escandallos para Dulce Arte.
 * Implementa las fórmulas:
 * Cost Price = SUM(Costo Ingrediente * Cantidad Requerida)
 * Final Sales Price = Cost Price * (1 + (Margen % / 100) + (Costos Fijos % / 100))
 */

require_once dirname(__DIR__, 2) . '/database/Database.php';

class CostCalculator {
    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
    }

    /**
     * Calcula el costo de materia prima y desglose de un producto según su escandallo.
     */
    public function calculateProductCost(int $productId): array {
        // Obtener datos del producto
        $stmt = $this->db->prepare("SELECT id, name, profit_margin_percentage, fixed_overhead_percentage FROM products WHERE id = ?");
        $stmt->execute([$productId]);
        $product = $stmt->fetch();

        if (!$product) {
            throw new InvalidArgumentException("El producto con ID {$productId} no existe.");
        }

        // Obtener ingredientes y cantidades del escandallo
        $stmt = $this->db->prepare("
            SELECT 
                pr.id as recipe_item_id,
                pr.ingredient_id,
                pr.quantity_required,
                i.name as ingredient_name,
                i.unit_of_measure,
                i.cost_per_unit,
                (pr.quantity_required * i.cost_per_unit) as item_cost
            FROM product_recipes pr
            INNER JOIN ingredients i ON pr.ingredient_id = i.id
            WHERE pr.product_id = ?
            ORDER BY i.name ASC
        ");
        $stmt->execute([$productId]);
        $items = $stmt->fetchAll();

        $costPrice = 0.0;
        foreach ($items as $item) {
            $costPrice += (float)$item['item_cost'];
        }

        $marginPct = (float)$product['profit_margin_percentage'];
        $overheadPct = (float)$product['fixed_overhead_percentage'];

        // Fórmula: Cost Price * (1 + Margen% + CostosFijos%)
        $multiplier = 1.0 + ($marginPct / 100.0) + ($overheadPct / 100.0);
        $finalPrice = round($costPrice * $multiplier, 2);
        $costPrice = round($costPrice, 2);

        return [
            'product_id' => $productId,
            'product_name' => $product['name'],
            'profit_margin_percentage' => $marginPct,
            'fixed_overhead_percentage' => $overheadPct,
            'cost_price' => $costPrice,
            'final_price' => $finalPrice,
            'multiplier' => round($multiplier, 4),
            'items' => $items
        ];
    }

    /**
     * Actualiza en la base de datos el cost_price y final_price del producto.
     */
    public function updateProductPricing(int $productId): array {
        $calculation = $this->calculateProductCost($productId);

        $stmt = $this->db->prepare("
            UPDATE products 
            SET cost_price = ?, final_price = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([
            $calculation['cost_price'],
            $calculation['final_price'],
            $productId
        ]);

        return $calculation;
    }

    /**
     * Recalcula en cascada todos los productos afectados al modificarse el costo de un ingrediente.
     */
    public function recalculateProductsByIngredient(int $ingredientId): array {
        // Buscar todos los productos que usan este ingrediente
        $stmt = $this->db->prepare("SELECT DISTINCT product_id FROM product_recipes WHERE ingredient_id = ?");
        $stmt->execute([$ingredientId]);
        $productIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $updated = [];
        foreach ($productIds as $prodId) {
            $updated[] = $this->updateProductPricing((int)$prodId);
        }

        return $updated;
    }

    /**
     * Recalcula todos los productos del sistema.
     */
    public function recalculateAllProducts(): array {
        $stmt = $this->db->query("SELECT id FROM products");
        $productIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $results = [];
        foreach ($productIds as $prodId) {
            $results[] = $this->updateProductPricing((int)$prodId);
        }

        return $results;
    }
}
