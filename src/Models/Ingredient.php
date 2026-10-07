<?php
/**
 * Modelo Ingredient para Dulce Arte.
 */

require_once dirname(__DIR__, 2) . '/database/Database.php';
require_once dirname(__DIR__) . '/Services/CostCalculator.php';

class Ingredient {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function all(): array {
        $stmt = $this->db->query("
            SELECT i.*, 
                   COUNT(pr.id) as products_count
            FROM ingredients i
            LEFT JOIN product_recipes pr ON i.id = pr.ingredient_id
            GROUP BY i.id
            ORDER BY i.name ASC
        ");
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM ingredients WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int {
        $stmt = $this->db->prepare("
            INSERT INTO ingredients (name, unit_of_measure, cost_per_unit, stock_quantity)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            trim($data['name']),
            $data['unit_of_measure'],
            (float)$data['cost_per_unit'],
            (float)($data['stock_quantity'] ?? 0)
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): array {
        $stmt = $this->db->prepare("
            UPDATE ingredients 
            SET name = ?, unit_of_measure = ?, cost_per_unit = ?, stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([
            trim($data['name']),
            $data['unit_of_measure'],
            (float)$data['cost_per_unit'],
            (float)($data['stock_quantity'] ?? 0),
            $id
        ]);

        // RECALCULO AUTOMÁTICO EN CASCADA DE TODOS LOS PRODUCTOS DEPENDIENTES
        $calculator = new CostCalculator($this->db);
        $affectedProducts = $calculator->recalculateProductsByIngredient($id);

        return [
            'ingredient_id' => $id,
            'affected_products' => $affectedProducts
        ];
    }

    public function delete(int $id): bool {
        // Verificar si está en recetas
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM product_recipes WHERE ingredient_id = ?");
        $stmt->execute([$id]);
        if ($stmt->fetchColumn() > 0) {
            throw new Exception("No se puede eliminar el ingrediente porque está asignado al escandallo de uno o más productos.");
        }

        $stmt = $this->db->prepare("DELETE FROM ingredients WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
