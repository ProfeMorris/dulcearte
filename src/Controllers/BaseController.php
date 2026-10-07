<?php
/**
 * Controlador Base con utilidades JSON y manejo de peticiones HTTP para Dulce Arte.
 */

abstract class BaseController {
    protected function json(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    protected function jsonError(string $message, int $statusCode = 400, $details = null): void {
        $response = [
            'success' => false,
            'error' => $message
        ];
        if ($details !== null) {
            $response['details'] = $details;
        }
        $this->json($response, $statusCode);
    }

    protected function jsonSuccess(array $data = [], string $message = 'Operación exitosa', int $statusCode = 200): void {
        $response = array_merge([
            'success' => true,
            'message' => $message
        ], $data);
        $this->json($response, $statusCode);
    }

    protected function getJsonBody(): array {
        $raw = file_get_contents('php://input');
        if (empty($raw)) {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}
