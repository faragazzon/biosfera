/* ============================================================
   BIOSFERA — main.js
   Arranque: inicializa audio perezoso, interfaz, render y juego;
   muestra la introducción y captura errores globales con un
   mensaje legible (sin dependencias, sin servidor).
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;

  function mostrarErrorFatal(err) {
    const el = document.getElementById('error-fatal');
    if (!el) { console.error(err); return; }
    el.classList.remove('oculto');
    el.innerHTML = '<div class="error-caja"><h3>BIOSFERA no pudo arrancar</h3>'
      + '<p>Algo falló al inicializar. Detalle técnico:</p>'
      + '<pre>' + String(err && err.stack ? err.stack : err).slice(0, 600) + '</pre>'
      + '<p>Prueba a recargar la página. Si persiste, abre la consola del navegador (F12) para más detalle.</p></div>';
  }

  window.addEventListener('error', (ev) => {
    if (window.__biosArrancado) console.error('[BIOSFERA]', ev.error || ev.message);
    else mostrarErrorFatal(ev.error || ev.message);
  });

  function iniciar() {
    try {
      B.UI.init();
      B.Render.init(document.getElementById('lienzo'), document.getElementById('minimapa'));
      B.Juego.init();
      window.__biosArrancado = true;
      B.UI.intro({
        hayGuardado: B.Juego.hayGuardado(),
        alNueva: (semilla) => { B.Juego.nuevaPartida(semilla); },
        alContinuar: () => { B.Juego.cargar(); },
      });
      document.getElementById('cargando').classList.add('oculto');
    } catch (e) {
      mostrarErrorFatal(e);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
