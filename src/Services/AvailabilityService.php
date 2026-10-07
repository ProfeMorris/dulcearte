<?php
/**
 * Servicio de Validación de Capacidad de Producción y Disponibilidad de Entregas.
 * Reglas de Dulce Arte:
 * - Entregas de Lunes a Sábado, franja horaria de 17:00 a 20:00 hs.
 * - Domingos cerrado para entregas.
 * - Cupo máximo diario de 8 pedidos.
 */

require_once dirname(__DIR__, 2) . '/database/Database.php';

class AvailabilityService {
    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
    }

    /**
     * Obtiene la configuración actual del taller.
     */
    public function getConfig(): array {
        $stmt = $this->db->query("SELECT * FROM production_config LIMIT 1");
        $config = $stmt->fetch();
        if (!$config) {
            return [
                'max_orders_per_day' => 8,
                'delivery_days' => '1,2,3,4,5,6',
                'delivery_hours' => '17:00 a 20:00 hs',
                'whatsapp_number' => '5493804232210'
            ];
        }
        return $config;
    }

    /**
     * Verifica la disponibilidad para una fecha de entrega específica (YYYY-MM-DD).
     */
    public function checkAvailability(string $dateString): array {
        $config = $this->getConfig();
        $maxDaily = (int)$config['max_orders_per_day'];
        $deliveryDays = explode(',', (string)$config['delivery_days']);

        $timestamp = strtotime($dateString);
        if ($timestamp === false) {
            return [
                'available' => false,
                'message' => 'Formato de fecha inválido. Utilice YYYY-MM-DD.',
                'date' => $dateString
            ];
        }

        // Validar que no sea fecha pasada
        $today = date('Y-m-d');
        if ($dateString < $today) {
            return [
                'available' => false,
                'message' => 'No es posible seleccionar una fecha anterior al día de hoy.',
                'date' => $dateString,
                'remaining_slots' => 0
            ];
        }

        // Día de la semana en formato ISO-8601 (1 = Lunes, 7 = Domingo)
        $dayOfWeek = (int)date('N', $timestamp);
        $diasEspanol = [
            1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles',
            4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado', 7 => 'Domingo'
        ];
        $dayName = $diasEspanol[$dayOfWeek] ?? '';

        // Validar días habilitados (Lunes a Sábado = 1..6)
        if (!in_array((string)$dayOfWeek, $deliveryDays)) {
            return [
                'available' => false,
                'message' => "Los días {$dayName} no realizamos entregas. Nuestro horario de entrega es de Lunes a Sábado de 17:00 a 20:00 hs.",
                'date' => $dateString,
                'day_name' => $dayName,
                'remaining_slots' => 0,
                'max_slots' => $maxDaily
            ];
        }

        // Contar pedidos existentes que no estén cancelados
        $stmt = $this->db->prepare("
            SELECT COUNT(*) FROM orders 
            WHERE delivery_date = ? AND status != 'cancelled'
        ");
        $stmt->execute([$dateString]);
        $currentOrders = (int)$stmt->fetchColumn();

        $remainingSlots = max(0, $maxDaily - $currentOrders);
        $isAvailable = $remainingSlots > 0;

        return [
            'available' => $isAvailable,
            'date' => $dateString,
            'day_name' => $dayName,
            'current_orders' => $currentOrders,
            'max_slots' => $maxDaily,
            'remaining_slots' => $remainingSlots,
            'delivery_hours' => $config['delivery_hours'],
            'whatsapp_number' => $config['whatsapp_number'],
            'message' => $isAvailable 
                ? "¡Hay disponibilidad para el {$dayName} {$dateString}! Quedan {$remainingSlots} de {$maxDaily} cupos para la franja de {$config['delivery_hours']}."
                : "Cupo de producción completo para el {$dayName} {$dateString}. Por favor elija otra fecha de entrega."
        ];
    }
}
