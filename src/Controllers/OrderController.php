<?php
/**
 * Controlador de Pedidos y Agenda de Producción para Dulce Arte.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/Models/Order.php';

class OrderController extends BaseController {
    private Order $model;

    public function __construct() {
        $this->model = new Order();
    }

    public function index(): void {
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;
        $status = $_GET['status'] ?? null;

        $orders = $this->model->all($startDate, $endDate, $status);
        $this->jsonSuccess(['orders' => $orders]);
    }

    public function show(int $id): void {
        $order = $this->model->find($id);
        if (!$order) {
            $this->jsonError("Pedido no encontrado", 404);
        }
        $this->jsonSuccess(['order' => $order]);
    }

    public function create(): void {
        $body = $this->getJsonBody();
        if (empty($body['client_name']) || empty($body['client_phone']) || empty($body['delivery_date'])) {
            $this->jsonError("Faltan datos obligatorios: client_name, client_phone, delivery_date.");
        }

        try {
            $result = $this->model->create($body);
            $this->jsonSuccess($result, 'Pedido registrado exitosamente en la agenda de producción.', 201);
        } catch (Exception $e) {
            $this->jsonError($e->getMessage(), 400);
        }
    }

    public function updateStatus(int $id): void {
        $body = $this->getJsonBody();
        if (empty($body['status'])) {
            $this->jsonError("Debe especificar el nuevo status.");
        }

        try {
            $this->model->updateStatus($id, $body['status']);
            $this->jsonSuccess(['order_id' => $id, 'status' => $body['status']], 'Estado del pedido actualizado.');
        } catch (Exception $e) {
            $this->jsonError($e->getMessage(), 400);
        }
    }

    public function delete(int $id): void {
        try {
            $this->model->delete($id);
            $this->jsonSuccess([], 'Pedido eliminado con éxito.');
        } catch (Exception $e) {
            $this->jsonError($e->getMessage(), 400);
        }
    }
}
