@echo off
title Dulce Arte - Servidor Local
chcp 65001 >nul
cls

echo ========================================================
echo         DULCE ARTE - PASTELERIA ARTESANAL
echo       Servidor Local y Sistema de Gestion Web
echo ========================================================
echo.

set PHP_EXE=C:\xampp\php\php.exe
if not exist "%PHP_EXE%" (
    set PHP_EXE=php
)

:: Moverse a la raiz del proyecto (carpeta padre de /scripts) PRIMERO
cd /d "%~dp0\.."

echo [1/2] Verificando base de datos y migraciones...
"%PHP_EXE%" scripts/migrate.php
if errorlevel 1 (
    echo [ADVERTENCIA] Error durante la inicializacion automatica.
)

echo.
echo [2/2] Iniciando servidor web embebido...
echo.
echo   * Catalogo Publico:        http://localhost:8000
echo   * Panel de Administracion: http://localhost:8000/admin
echo   * API REST de Productos:   http://localhost:8000/api/products
echo.
echo Presione CTRL + C para detener el servidor.
echo --------------------------------------------------------
echo.

"%PHP_EXE%" -S localhost:8000 router.php
