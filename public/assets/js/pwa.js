/**
 * Dulce Arte - Lógica PWA e Instalador Universal
 * Soporte para Android, iOS, Windows, macOS y navegadores Chromium
 */

let deferredInstallPrompt = null;

// Registro del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then((registration) => {
                console.log('✅ Service Worker de Dulce Arte registrado con alcance:', registration.scope);

                // Detectar si hay una actualización pendiente
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('🔄 Nueva versión disponible de Dulce Arte');
                            }
                        });
                    }
                });
            })
            .catch((error) => {
                console.error('❌ Error al registrar el Service Worker:', error);
            });
    });
}

// Comprobar si ya se ejecuta en modo standalone (instalada)
function isRunningStandalone() {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://')
    );
}

// Manejador del evento de instalación en navegadores modernos (Chrome, Edge, Opera, Samsung)
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir el prompt por defecto para mostrar el botón estilizado
    e.preventDefault();
    deferredInstallPrompt = e;

    // Mostrar botones de instalación si no está ya instalada
    if (!isRunningStandalone()) {
        const installBtns = document.querySelectorAll('.pwa-install-btn, #navInstallBtn, #heroInstallBtn');
        installBtns.forEach(btn => {
            btn.style.display = 'inline-flex';
        });

        const installBanner = document.getElementById('pwaInstallBanner');
        if (installBanner && !sessionStorage.getItem('pwa_banner_dismissed')) {
            installBanner.classList.add('visible');
        }
    }
});

// Función para disparar la instalación
window.triggerPWAInstall = async function () {
    // Si estamos en iOS Safari, mostrar modal con instrucciones
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS && !isRunningStandalone()) {
        const iosModal = document.getElementById('pwaIosModal');
        if (iosModal) {
            iosModal.classList.add('active');
        } else {
            alert("Para instalar Dulce Arte en tu iPhone o iPad:\n1. Toca el botón Compartir (icono cuadrado con flecha hacia arriba).\n2. Selecciona 'Agregar a Inicio'.");
        }
        return;
    }

    if (!deferredInstallPrompt) {
        // En desktop si ya se procesó o no soporta el evento directo
        if (!isRunningStandalone()) {
            alert("Puedes instalar la aplicación desde el menú de tu navegador o desde el icono de instalación en la barra de direcciones.");
        }
        return;
    }

    // Mostrar el prompt nativo
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`Elección del usuario: ${outcome}`);

    if (outcome === 'accepted') {
        const installBanner = document.getElementById('pwaInstallBanner');
        if (installBanner) installBanner.classList.remove('visible');
        document.querySelectorAll('.pwa-install-btn').forEach(b => b.style.display = 'none');
    }

    deferredInstallPrompt = null;
};

// Cerrar banner PWA
window.dismissPWABanner = function () {
    const installBanner = document.getElementById('pwaInstallBanner');
    if (installBanner) {
        installBanner.classList.remove('visible');
        sessionStorage.setItem('pwa_banner_dismissed', '1');
    }
};

// Cerrar modal iOS
window.closeIosModal = function () {
    const iosModal = document.getElementById('pwaIosModal');
    if (iosModal) iosModal.classList.remove('active');
};

// Escuchar cuando la app ha sido instalada exitosamente
window.addEventListener('appinstalled', () => {
    console.log('🎉 ¡Dulce Arte fue instalada exitosamente!');
    const installBanner = document.getElementById('pwaInstallBanner');
    if (installBanner) installBanner.classList.remove('visible');
    document.querySelectorAll('.pwa-install-btn').forEach(b => b.style.display = 'none');
    deferredInstallPrompt = null;
});

// Inicialización de UI al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    if (isRunningStandalone()) {
        document.querySelectorAll('.pwa-install-btn').forEach(b => b.style.display = 'none');
    } else {
        // En iOS Safari, siempre ofrecer el botón de instalación
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            document.querySelectorAll('.pwa-install-btn, #navInstallBtn').forEach(b => {
                b.style.display = 'inline-flex';
            });
        }
    }
});
