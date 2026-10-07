<?php
/**
 * Modelo Order para Dulce Arte.
 */

require_once dirname(__DIR__, 2) . '/database/Database.php';
require_once dirname(__DIR__) . '/Services/AvailabilityService.php';

class Order {
    private PDO $db;

    public function __construct() {
        $this->db = Database::getConnection();
    }

    public function all(?string $startDate = null, ?string $endDate = null, ?string $status = null): array {
        $sql = "
            SELECT o.*,
                   (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as total_items,
                   (SELECT GROUP_CONCAT(CONCAT(oi.quantity, 'x ', p.name), ', ') 
                    FROM order_items oi 
                    JOIN products p ON oi.product_id = p.id 
                    WHERE oi.order_id = o.id) as items_summary
            FROM orders o
            WHERE 1=1
        ";
        $params = [];

        if ($startDate) {
            $sql .= " AND o.delivery_date >= ?";
            $params[] = $startDate;
        }

        if ($endDate) {
            $sql .= " AND o.delivery_date <= ?";
            $params[] = $endDate;
        }

        if ($status && $status !== 'all') {
            $sql .= " AND o.status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY o.delivery_date ASC, o.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$id]);
        $order = $stmt->fetch();

        if (!$order) {
            return null;
        }

        $itemsStmt = $this->db->prepare("
            SELECT oi.*, p.name as product_name, p.image_url, p.category
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ");
        $itemsStmt->execute([$id]);
        $order['items'] = $itemsStmt->fetchAll();

        return $order;
    }

    public function create(array $data): array {
        $deliveryDate = $data['delivery_date'] ?? date('Y-m-d');
        
        // Verificar cupo disponible antes de asentar
        $availabilityService = new AvailabilityService($this->db);
        $check = $availabilityService->checkAvailability($deliveryDate);
        if (!$check['available']) {
            throw new Exception($check['message']);
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO orders (client_name, client_phone, delivery_date, delivery_time_slot, status, total_price, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            
            $status = $data['status'] ?? 'pending';
            $timeSlot = $data['delivery_time_slot'] ?? '17:00 a 20:00 hs';
            $totalPrice = (float)($data['total_price'] ?? 0.0);
            $notes = trim($data['notes'] ?? '');

            $stmt->execute([
                trim($data['client_name']),
                trim($data['client_phone']),
                $deliveryDate,
                $timeSlot,
                $status,
                $totalPrice,
                $notes
            ]);

            $orderId = (int)$this->db->lastInsertId();

            // Insertar items si se proveyeron
            $calculatedTotal = 0.0;
            if (!empty($data['items']) && is_array($data['items'])) {
                $itemStmt = $this->db->prepare("
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
                    VALUES (?, ?, ?, ?, ?)
                ");

                foreach ($data['items'] as $item) {
                    $prodId = (int)$item['product_id'];
                    $qty = max(1, (int)$item['quantity']);
                    $unitPrice = (float)$item['unit_price'];
                    $subtotal = round($qty * $unitPrice, 2);
                    $calculatedTotal += $subtotal;

                    $itemStmt->execute([$orderId, $prodId, $qty, $unitPrice, $subtotal]);
                }

                // Si no venía total o difiere, actualizar con la suma real
                if ($totalPrice <= 0 || abs($totalPrice - $calculatedTotal) > 0.05) {
                    $updateTotalStmt = $this->db->prepare("UPDATE orders SET total_price = ? WHERE id = ?");
                    $updateTotalStmt->execute([$calculatedTotal, $orderId]);
                    $totalPrice = $calculatedTotal;
                }
            }

            $this->db->commit();

            return [
                'order_id' => $orderId,
                'status' => 'created',
                'delivery_date' => $deliveryDate,
                'total_price' => $totalPrice
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function updateStatus(int $id, string $status): bool {
        $allowed = ['pending', 'confirmed', 'delivered', 'cancelled'];
        if (!in_array($status, $allowed)) {
            throw new InvalidArgumentException("Estado no permitido.");
        }

        $stmt = $this->db->prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        return $stmt->execute([$status, $id]);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM orders WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
