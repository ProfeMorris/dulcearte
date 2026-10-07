<?php
/**
 * Modelo Product para Dulce Arte.
 */

require_once dirname(__DIR__, 2) . '/database/Database.php';
require_once dirname(__DIR__) . '/Services/CostCalculator.php';

class Product {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function all(bool $onlyActive = false, ?string $category = null): array {
        $sql = "
            SELECT p.*,
                   (SELECT COUNT(*) FROM product_recipes pr WHERE pr.product_id = p.id) as ingredients_count
            FROM products p
            WHERE 1=1
        ";
        $params = [];

        if ($onlyActive) {
            $sql .= " AND p.is_active_in_catalog = 1";
        }

        if ($category !== null && $category !== 'all') {
            $sql .= " AND p.category = ?";
            $params[] = $category;
        }

        $sql .= " ORDER BY p.category ASC, p.name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM products WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(array $data): int {
        $stmt = $this->db->prepare("
            INSERT INTO products (
                name, category, description, profit_margin_percentage, 
                fixed_overhead_percentage, cost_price, final_price, 
                is_active_in_catalog, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            trim($data['name']),
            $data['category'] ?? 'daily',
            trim($data['description'] ?? ''),
            (float)($data['profit_margin_percentage'] ?? 35.0),
            (float)($data['fixed_overhead_percentage'] ?? 15.0),
            (float)($data['cost_price'] ?? 0.0),
            (float)($data['final_price'] ?? 0.0),
            isset($data['is_active_in_catalog']) ? (int)$data['is_active_in_catalog'] : 1,
            $data['image_url'] ?? null
        ]);

        $productId = (int)$this->db->lastInsertId();

        // Si se enviaron ingredientes en la creación, agregarlos
        if (!empty($data['recipes']) && is_array($data['recipes'])) {
            require_once __DIR__ . '/Recipe.php';
            $recipeModel = new Recipe();
            $recipeModel->syncForProduct($productId, $data['recipes']);
        }

        return $productId;
    }

    public function update(int $id, array $data): bool {
        $stmt = $this->db->prepare("
            UPDATE products SET
                name = ?,
                category = ?,
                description = ?,
                profit_margin_percentage = ?,
                fixed_overhead_percentage = ?,
                is_active_in_catalog = ?,
                image_url = COALESCE(?, image_url),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([
            trim($data['name']),
            $data['category'],
            trim($data['description'] ?? ''),
            (float)$data['profit_margin_percentage'],
            (float)$data['fixed_overhead_percentage'],
            isset($data['is_active_in_catalog']) ? (int)$data['is_active_in_catalog'] : 1,
            $data['image_url'] ?? null,
            $id
        ]);

        // Recalcular precios con los nuevos márgenes
        $calculator = new CostCalculator($this->db);
        $calculator->updateProductPricing($id);

        return true;
    }

    public function toggleCatalog(int $id, ?int $forceStatus = null): int {
        if ($forceStatus !== null) {
            $newStatus = $forceStatus;
        } else {
            $current = $this->find($id);
            if (!$current) {
                throw new InvalidArgumentException("Producto no encontrado");
            }
            $newStatus = ((int)$current['is_active_in_catalog'] === 1) ? 0 : 1;
        }

        $stmt = $this->db->prepare("UPDATE products SET is_active_in_catalog = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$newStatus, $id]);
        return $newStatus;
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM products WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
