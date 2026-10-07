<?php
/**
 * Controlador de Escandallos y Recetas para Dulce Arte.
 */

require_once __DIR__ . '/BaseController.php';
require_once dirname(__DIR__) . '/Models/Recipe.php';

class RecipeController extends BaseController {
    private Recipe $model;

    public function __construct() {
        $this->model = new Recipe();
    }

    public function show(int $productId): void {
        try {
            $recipe = $this->model->getByProduct($productId);
            $this->jsonSuccess(['recipe' => $recipe]);
        } catch (Exception $e) {
            $this->jsonError($e->getMessage(), 404);
        }
    }

    public function saveItem(int $productId): void {
        $body = $this->getJsonBody();
        if (empty($body['ingredient_id']) || !isset($body['quantity_required'])) {
            $this->jsonError("Se requiere ingredient_id y quantity_required.");
        }

        try {
            $result = $this->model->saveItem(
                $productId, 
                (int)$body['ingredient_id'], 
                (float)$body['quantity_required']
            );
            $this->jsonSuccess(['pricing' => $result], 'Ingrediente guardado en escandallo y costos actualizados.');
        } catch (Exception $e) {
            $this->jsonError("Error al guardar ingrediente en receta: " . $e->getMessage(), 500);
        }
    }

    public function sync(int $productId): void {
        $body = $this->getJsonBody();
        $items = $body['items'] ?? [];

        try {
            $result = $this->model->syncForProduct($productId, $items);
            $this->jsonSuccess(['pricing' => $result], 'Receta completa sincronizada y precios recalculados.');
        } catch (Exception $e) {
            $this->jsonError("Error al sincronizar receta: " . $e->getMessage(), 500);
        }
    }

    public function deleteItem(int $recipeItemId): void {
        try {
            $result = $this->model->removeItem($recipeItemId);
            $this->jsonSuccess(['pricing' => $result], 'Ingrediente quitado de la receta.');
        } catch (Exception $e) {
            $this->jsonError("Error al eliminar item de receta: " . $e->getMessage(), 500);
        }
    }
}
