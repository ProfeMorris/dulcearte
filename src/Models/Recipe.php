<?php
/**
 * Modelo Recipe (Escandallos de Producto) para Dulce Arte.
 */

require_once dirname(__DIR__, 2) . '/database/Database.php';
require_once dirname(__DIR__) . '/Services/CostCalculator.php';

class Recipe {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function getByProduct(int $productId): array {
        $calculator = new CostCalculator($this->db);
        return $calculator->calculateProductCost($productId);
    }

    public function saveItem(int $productId, int $ingredientId, float $quantity): array {
        // Upsert en la tabla product_recipes
        $driver = Database::getDriver();
        if ($driver === 'mysql') {
            $sql = "
                INSERT INTO product_recipes (product_id, ingredient_id, quantity_required)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE quantity_required = VALUES(quantity_required)
            ";
        } else {
            $sql = "
                INSERT INTO product_recipes (product_id, ingredient_id, quantity_required)
                VALUES (?, ?, ?)
                ON CONFLICT(product_id, ingredient_id) DO UPDATE SET quantity_required = excluded.quantity_required
            ";
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$productId, $ingredientId, $quantity]);

        $calculator = new CostCalculator($this->db);
        return $calculator->updateProductPricing($productId);
    }

    public function removeItem(int $recipeItemId): array {
        // Buscar el producto antes de borrar
        $stmt = $this->db->prepare("SELECT product_id FROM product_recipes WHERE id = ?");
        $stmt->execute([$recipeItemId]);
        $productId = (int)$stmt->fetchColumn();

        if ($productId > 0) {
            $stmt = $this->db->prepare("DELETE FROM product_recipes WHERE id = ?");
            $stmt->execute([$recipeItemId]);

            $calculator = new CostCalculator($this->db);
            return $calculator->updateProductPricing($productId);
        }

        return ['status' => 'not_found'];
    }

    public function syncForProduct(int $productId, array $items): array {
        $this->db->beginTransaction();
        try {
            // Eliminar anteriores
            $stmt = $this->db->prepare("DELETE FROM product_recipes WHERE product_id = ?");
            $stmt->execute([$productId]);

            // Insertar nuevos
            $insertStmt = $this->db->prepare("
                INSERT INTO product_recipes (product_id, ingredient_id, quantity_required)
                VALUES (?, ?, ?)
            ");

            foreach ($items as $item) {
                if (isset($item['ingredient_id'], $item['quantity_required']) && (float)$item['quantity_required'] > 0) {
                    $insertStmt->execute([
                        $productId,
                        (int)$item['ingredient_id'],
                        (float)$item['quantity_required']
                    ]);
                }
            }

            $this->db->commit();

            $calculator = new CostCalculator($this->db);
            return $calculator->updateProductPricing($productId);
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
