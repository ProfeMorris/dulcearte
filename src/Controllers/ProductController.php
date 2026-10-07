<?php
/**
 * Controlador de Productos y Precios de Venta para Dulce Arte.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/Models/Product.php';
require_once dirname(__DIR__) . '/Services/CostCalculator.php';

class ProductController extends BaseController {
    private Product $model;

    public function __construct() {
        $this->model = new Product();
    }

    public function index(): void {
        $onlyActive = isset($_GET['active']) && $_GET['active'] === '1';
        $category = $_GET['category'] ?? null;

        $products = $this->model->all($onlyActive, $category);
        $this->jsonSuccess(['products' => $products]);
    }

    public function show(int $id): void {
        $product = $this->model->find($id);
        if (!$product) {
            $this->jsonError("Producto no encontrado", 404);
        }

        // Obtener cálculo y desglose de receta
        $calculator = new CostCalculator();
        try {
            $pricing = $calculator->calculateProductCost($id);
            $product['pricing_breakdown'] = $pricing;
        } catch (Exception $e) {
            $product['pricing_breakdown'] = null;
        }

        $this->jsonSuccess(['product' => $product]);
    }

    public function create(): void {
        $body = $this->getJsonBody();
        if (empty($body['name']) || empty($body['category'])) {
            $this->jsonError("Faltan campos obligatorios: name, category.");
        }

        try {
            $id = $this->model->create($body);
            // Recalcular si tiene ingredientes
            $calculator = new CostCalculator();
            $calculator->updateProductPricing($id);

            $newProduct = $this->model->find($id);
            $this->jsonSuccess(['product' => $newProduct], 'Producto creado con éxito', 201);
        } catch (Exception $e) {
            $this->jsonError("Error al crear producto: " . $e->getMessage(), 500);
        }
    }

    public function update(int $id): void {
        $body = $this->getJsonBody();
        if (empty($body['name']) || empty($body['category'])) {
            $this->jsonError("Faltan campos obligatorios: name, category.");
        }

        try {
            $this->model->update($id, $body);
            $updated = $this->model->find($id);
            $this->jsonSuccess(['product' => $updated], 'Producto y precios actualizados con éxito.');
        } catch (Exception $e) {
            $this->jsonError("Error al actualizar producto: " . $e->getMessage(), 500);
        }
    }

    public function toggleCatalog(int $id): void {
        $body = $this->getJsonBody();
        $force = isset($body['is_active_in_catalog']) ? (int)$body['is_active_in_catalog'] : null;

        try {
            $newStatus = $this->model->toggleCatalog($id, $force);
            $this->jsonSuccess([
                'product_id' => $id,
                'is_active_in_catalog' => $newStatus,
                'status_label' => $newStatus === 1 ? 'Activo en Catálogo' : 'Pausado'
            ], 'Estado de catálogo actualizado correctamente.');
        } catch (Exception $e) {
            $this->jsonError("Error al cambiar estado: " . $e->getMessage(), 400);
        }
    }

    public function recalculate(int $id): void {
        try {
            $calculator = new CostCalculator();
            $result = $calculator->updateProductPricing($id);
            $this->jsonSuccess(['pricing' => $result], 'Costos y precio de venta recalculados.');
        } catch (Exception $e) {
            $this->jsonError("Error al recalcular: " . $e->getMessage(), 500);
        }
    }

    public function delete(int $id): void {
        try {
            $this->model->delete($id);
            $this->jsonSuccess([], 'Producto eliminado con éxito.');
        } catch (Exception $e) {
            $this->jsonError("Error al eliminar producto: " . $e->getMessage(), 500);
        }
    }
}
