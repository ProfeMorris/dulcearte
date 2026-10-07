<?php
/**
 * Controlador de Ingredientes e Insumos para Dulce Arte.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/Models/Ingredient.php';

class IngredientController extends BaseController {
    private Ingredient $model;

    public function __construct() {
        $this->model = new Ingredient();
    }

    public function index(): void {
        $ingredients = $this->model->all();
        $this->jsonSuccess(['ingredients' => $ingredients]);
    }

    public function show(int $id): void {
        $ingredient = $this->model->find($id);
        if (!$ingredient) {
            $this->jsonError("Ingrediente no encontrado", 404);
        }
        $this->jsonSuccess(['ingredient' => $ingredient]);
    }

    public function create(): void {
        $body = $this->getJsonBody();
        if (empty($body['name']) || !isset($body['cost_per_unit']) || empty($body['unit_of_measure'])) {
            $this->jsonError("Faltan campos obligatorios: name, cost_per_unit, unit_of_measure.");
        }

        try {
            $id = $this->model->create($body);
            $newIngredient = $this->model->find($id);
            $this->jsonSuccess(['ingredient' => $newIngredient], 'Ingrediente creado con éxito', 201);
        } catch (Exception $e) {
            $this->jsonError("Error al crear ingrediente: " . $e->getMessage(), 500);
        }
    }

    public function update(int $id): void {
        $body = $this->getJsonBody();
        if (empty($body['name']) || !isset($body['cost_per_unit']) || empty($body['unit_of_measure'])) {
            $this->jsonError("Faltan campos obligatorios: name, cost_per_unit, unit_of_measure.");
        }

        try {
            $result = $this->model->update($id, $body);
            $updatedIngredient = $this->model->find($id);
            $this->jsonSuccess([
                'ingredient' => $updatedIngredient,
                'affected_products' => $result['affected_products'],
                'recalculated_count' => count($result['affected_products'])
            ], 'Ingrediente y costos de productos dependientes actualizados en cascada.');
        } catch (Exception $e) {
            $this->jsonError("Error al actualizar ingrediente: " . $e->getMessage(), 500);
        }
    }

    public function delete(int $id): void {
        try {
            $this->model->delete($id);
            $this->jsonSuccess([], 'Ingrediente eliminado con éxito');
        } catch (Exception $e) {
            $this->jsonError($e->getMessage(), 400);
        }
    }
}
