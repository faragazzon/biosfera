/* ============================================================
   BIOSFERA — ui.js
   Interfaz raíz: iconografía SVG, barra superior (ciclo, clima,
   población, brújula, velocidades), barra de herramientas del
   naturalista con bancos, avisos (toasts), modales, menú,
   pantalla de introducción y pistas del tutorial.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;

  const UI = {};
  const $ = (sel) => document.querySelector(sel);

  /* ================================================================
     Iconografía SVG (sin dependencias externas)
     ================================================================ */
  const svg = (d, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + (extra || '') + '</svg>';
  const Iconos = {
    lupa: svg('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20"/>'),
    brote: svg('<path d="M12 21v-8"/><path d="M12 13c-4 0-6-3-6-6 4 0 6 2 6 6z"/><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z"/>'),
    gota: svg('<path d="M12 3c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>'),
    hongo: svg('<path d="M4 11a8 8 0 0 1 16 0v1H4z"/><path d="M10 12v3a2 2 0 0 0 4 0v-3"/><circle cx="9" cy="8.3" r=".8"/><circle cx="14.2" cy="7.8" r=".8"/>'),
    comedero: svg('<path d="M4 13h16l-2.5 6h-11z"/><path d="M8 10c0-1.6 1-2 1-3.6"/><path d="M12 10c0-1.6 1-2 1-3.6"/><path d="M16 10c0-1.6 1-2 1-3.6"/>'),
    etiqueta: svg('<path d="M3 12l9-9h9v9l-9 9z"/><circle cx="16.5" cy="7.5" r="1.6"/>'),
    camara: svg('<rect x="3" y="7" width="18" height="13" rx="2.5"/><circle cx="12" cy="13.5" r="4"/><path d="M8.5 7l1.5-3h4l1.5 3"/>'),
    libro: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
    doc: svg('<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>'),
    pausa: svg('<path d="M9 5v14M15 5v14"/>'),
    play: svg('<path d="M7 4l13 8-13 8z"/>'),
    rapid: svg('<path d="M4 5l7 7-7 7M13 5l7 7-7 7"/>'),
    ajustes: svg('<path d="M4 7h9M17.5 7H20M4 17h2.5M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
    cerrar: svg('<path d="M5 5l14 14M19 5L5 19"/>'),
    sol: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>'),
    luna: svg('<path d="M20 14A8.5 8.5 0 1 1 10 4a7 7 0 0 0 10 10z"/>'),
    nube: svg('<path d="M6.5 18h11a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.6 3.7 3.7 0 0 0 6.5 18z"/>'),
    lluvia: svg('<path d="M6.5 14h11a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 5.6 3.7 3.7 0 0 0 6.5 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>'),
    copo: svg('<path d="M12 3v18M5 7.5l14 9M19 7.5l-14 9"/>'),
    hoja: svg('<path d="M20 4C10 4 4 10 4 20c10 0 16-6 16-16z"/><path d="M4 20C9 15 14 10 20 4"/>'),
    garra: svg('<circle cx="12" cy="14" r="3.4"/><circle cx="6.5" cy="9" r="1.7"/><circle cx="12" cy="7.5" r="1.7"/><circle cx="17.5" cy="9" r="1.7"/>'),
    brujula: svg('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.4v.4"/>'),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    guardar: svg('<path d="M5 3h11l4 4v14H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>'),
    exportar: svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M4 15v6h16v-6"/>'),
    importar: svg('<path d="M12 15V3M8 11l4 4 4-4"/><path d="M4 15v6h16v-6"/>'),
    seguir: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    campana: svg('<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>'),
  };
  UI.Iconos = Iconos;
  const ico = (nombre, clase) => '<span class="ico' + (clase ? ' ' + clase : '') + '">' + Iconos[nombre] + '</span>';

  /* ================================================================
     Inicialización
     ================================================================ */
  UI.init = function () {
    construirBarraSup();
    construirBarraInf();
    enlazarBus();
    document.addEventListener('pointerdown', () => B.Audio.desbloquear(), { once: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.teclaEscape(); });
  };

  /* ================================================================
     Barra superior
     ================================================================ */
  function construirBarraSup() {
    const el = $('#barra-sup');
    el.innerHTML =
      '<div class="bs-grupo bs-izq">'
      + '<span class="logo">BIOSFERA</span>'
      + '<span class="chip" id="chip-ciclo">' + ico('sol') + '<span id="txt-ciclo">Ciclo 0</span></span>'
      + '<span class="chip" id="chip-clima">' + ico('sol') + '<span id="txt-clima">Soleado</span></span>'
      + '</div>'
      + '<div class="bs-grupo bs-centro">'
      + '<span class="chip" id="chip-herb" title="Forrajeros vivos">' + ico('hoja') + '<span id="txt-herb">0</span></span>'
      + '<span class="chip" id="chip-carn" title="Cazadores vivos">' + ico('garra') + '<span id="txt-carn">0</span></span>'
      + '<span class="chip" id="chip-brujula" title="Brújula triádica de la reserva">' + ico('brujula') + '<span id="txt-brujula">—</span></span>'
      + '</div>'
      + '<div class="bs-grupo bs-der">'
      + '<button class="btn-vel" data-vel="0" title="Pausa (Espacio)">' + ico('pausa') + '</button>'
      + '<button class="btn-vel" data-vel="1" title="Velocidad 1×">' + ico('play') + '<small>1×</small></button>'
      + '<button class="btn-vel" data-vel="3" title="Velocidad 3×">' + ico('rapid') + '<small>3×</small></button>'
      + '<button class="btn-vel" data-vel="8" title="Velocidad 8×">' + ico('rapid') + '<small>8×</small></button>'
      + '<button class="btn-vel" id="btn-menu" title="Menú (Esc)">' + ico('menu') + '</button>'
      + '</div>';
    el.querySelectorAll('.btn-vel[data-vel]').forEach((b) => {
      b.addEventListener('click', () => { B.Juego.fijarVelocidad(parseInt(b.dataset.vel, 10)); B.Audio.evento('clic'); });
    });
    $('#btn-menu').addEventListener('click', () => { B.Audio.evento('clic'); UI.menu(); });
  }

  UI.refrescarBarra = function (info) {
    const J = B.Juego; if (!J || !J.mundo) return;
    const e = J.estado;
    const mundo = J.mundo;
    $('#txt-ciclo').textContent = 'Ciclo ' + e.ciclo + ' · ' + mundo.estacion(e.ciclo) + ' · ' + U.textoHora(e.tCiclo, C.TIEMPO.CICLO_MS);
    const iconosDia = { Amanecer: 'sol', Día: 'sol', Atardecer: 'sol', Noche: 'luna' };
    $('#chip-ciclo .ico').innerHTML = Iconos[iconosDia[info.faseDia] || 'sol'];
    const iconosClima = { soleado: 'sol', nublado: 'nube', lluvia: 'lluvia', nevada: 'copo' };
    $('#chip-clima .ico').innerHTML = Iconos[iconosClima[mundo.clima.tipo] || 'sol'];
    $('#txt-clima').textContent = mundo.clima.tipo.charAt(0).toUpperCase() + mundo.clima.tipo.slice(1);
    const pob = J.poblacion.contar();
    $('#txt-herb').textContent = pob.herb;
    $('#txt-carn').textContent = pob.carn;
    const br = J.poblacion.brujulaReserva(mundo);
    const txt = $('#txt-brujula');
    txt.textContent = br.estado;
    txt.parentElement.style.color = br.equilibrio <= 2 ? '#8fd694' : br.equilibrio <= 5 ? '#e8c37a' : '#d98a7a';
    document.querySelectorAll('.btn-vel[data-vel]').forEach((b) => {
      b.classList.toggle('activa', parseInt(b.dataset.vel, 10) === e.velocidad && !e.pausado);
      if (b.dataset.vel === '0') b.classList.toggle('activa', e.pausado);
    });
  };

  /* ================================================================
     Barra de herramientas (rol de naturalista: observar y cultivar)
     ================================================================ */
  const HERRAMIENTAS = [
    { id: 'lupa', nombre: 'Observar', icono: 'lupa', tecla: 'Z', desc: 'Selecciona criaturas y examina el terreno. No interviene: solo lee.' },
    { id: 'sembrar', nombre: 'Sembrar', icono: 'brote', tecla: 'X', banco: 'semillas', desc: 'Siembra pasto en un tile de suelo. Las semillas se recargan con los ciclos.' },
    { id: 'regar', nombre: 'Regar', icono: 'gota', tecla: 'C', banco: 'agua', desc: 'Riega una zona: sube la humedad y el crecimiento. Cargas por ciclo.' },
    { id: 'micelio', nombre: 'Micelio', icono: 'hongo', tecla: 'V', banco: 'micelio', desc: 'Inocula hongos sobre residuo: reciclan el desorden en fertilidad.' },
    { id: 'comedero', nombre: 'Comedero', icono: 'comedero', tecla: 'B', banco: 'comederos', desc: 'Coloca un comedero. Las criaturas lo descubren por curiosidad y su expectativa sube.' },
    { id: 'etiqueta', nombre: 'Bautizar', icono: 'etiqueta', tecla: 'N', desc: 'Renombra a una criatura para tu cuaderno de campo.' },
    { id: 'foto', nombre: 'Fotografiar', icono: 'camara', tecla: 'P', desc: 'Toma una fotografía del encuadre actual para el registro. Sin flash: no las molesta.' },
  ];

  function construirBarraInf() {
    const el = $('#barra-inf');
    let html = '<div class="herramientas">';
    for (const h of HERRAMIENTAS) {
      html += '<button class="btn-herr" data-herr="' + h.id + '" title="' + h.desc + ' [' + h.tecla + ']">'
        + ico(h.icono) + '<span class="herr-nombre">' + h.nombre + '</span>'
        + (h.banco ? '<span class="banco" data-banco="' + h.banco + '"></span>' : '')
        + '<span class="herr-tecla">' + h.tecla + '</span>'
        + '</button>';
    }
    html += '</div><div class="sep"></div><div class="accesos">'
      + '<button class="btn-herr" id="btn-registro" title="Registro de campo (R)">' + ico('libro') + '<span class="herr-nombre">Cuaderno</span></button>'
      + '<button class="btn-herr" id="btn-codice" title="Códice del naturalista (K)">' + ico('doc') + '<span class="herr-nombre">Códice</span></button>'
      + '</div>';
    el.innerHTML = html;
    el.querySelectorAll('.btn-herr[data-herr]').forEach((b) => {
      b.addEventListener('click', () => { B.Juego.fijarHerramienta(b.dataset.herr); B.Audio.evento('clic'); });
    });
    $('#btn-registro').addEventListener('click', () => { B.Paneles.cajon.alternar('registro'); B.Audio.evento('clic'); });
    $('#btn-codice').addEventListener('click', () => { B.Paneles.cajon.alternar('codice'); B.Audio.evento('clic'); });
    UI.refrescarBancos();
  }

  UI.HERRAMIENTAS = HERRAMIENTAS;

  UI.refrescarBancos = function () {
    const J = B.Juego; if (!J || !J.estado) return;
    const bancos = J.estado.bancos;
    const mapa = {
      semillas: [bancos.semillas + '/' + C.BANCOS.SEMILLAS_MAX, 'semillas'],
      agua: [bancos.aguaHoy + ' hoy', 'cargas de riego'],
      micelio: [bancos.micelio + '/' + C.BANCOS.MICELIO_MAX, 'cultivos'],
      comederos: [bancos.comederos, 'comederos'],
    };
    document.querySelectorAll('.banco[data-banco]').forEach((el) => {
      const m = mapa[el.dataset.banco];
      if (m) { el.textContent = m[0]; el.parentElement.title = (HERRAMIENTAS.find((h) => h.banco === el.dataset.banco) || {}).desc + ' — ' + m[1] + ' disponibles'; }
    });
    document.querySelectorAll('.btn-herr[data-herr]').forEach((b) => {
      b.classList.toggle('activa', b.dataset.herr === J.estado.herramienta);
      const h = HERRAMIENTAS.find((x) => x.id === b.dataset.herr);
      if (h && h.banco) {
        const vacio = (h.banco === 'semillas' && bancos.semillas <= 0)
          || (h.banco === 'agua' && bancos.aguaHoy <= 0)
          || (h.banco === 'micelio' && bancos.micelio <= 0)
          || (h.banco === 'comederos' && bancos.comederos <= 0);
        b.classList.toggle('vacia', vacio);
      }
    });
  };

  UI.fijarHerramientaVisual = function (id) {
    document.querySelectorAll('.btn-herr[data-herr]').forEach((b) => b.classList.toggle('activa', b.dataset.herr === id));
  };

  /* ================================================================
     Toasts y avisos
     ================================================================ */
  UI.toast = function (texto, tipo, durMs) {
    const cont = $('#toasts');
    if (!cont) return;
    while (cont.children.length >= 3) cont.removeChild(cont.firstChild);
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || 'info');
    const icono = tipo === 'hito' ? 'campana' : tipo === 'memoria' ? 'brujula' : tipo === 'aviso' ? 'info' : 'hoja';
    el.innerHTML = ico(icono) + '<span>' + U.escapar(texto) + '</span>';
    cont.appendChild(el);
    setTimeout(() => { el.classList.add('sale'); setTimeout(() => el.remove(), 420); }, durMs || 3800);
  };

  /* ================================================================
     Modales
     ================================================================ */
  let modalAbierto = false;
  let alCerrarActual = null;
  UI.modal = function (op) {
    const raiz = $('#modal-raiz');
    raiz.innerHTML = '';
    alCerrarActual = op.alCerrar || null;
    modalAbierto = true;
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    const caja = document.createElement('div');
    caja.className = 'modal-caja' + (op.ancho ? ' ' + op.ancho : '');
    let html = '';
    if (op.titulo) html += '<h3 class="modal-titulo">' + op.titulo + '</h3>';
    html += '<div class="modal-cuerpo">' + op.html + '</div>';
    if (op.botones && op.botones.length) {
      html += '<div class="modal-botones">';
      for (const b of op.botones) html += '<button class="btn ' + (b.clase || '') + '" data-modal="' + b.texto + '">' + U.escapar(b.texto) + '</button>';
      html += '</div>';
    }
    caja.innerHTML = html;
    raiz.appendChild(fondo); raiz.appendChild(caja);
    raiz.classList.remove('oculto');
    const cerrar = () => {
      raiz.classList.add('oculto'); raiz.innerHTML = '';
      modalAbierto = false;
      const f = alCerrarActual; alCerrarActual = null;
      if (f) f();
    };
    caja.querySelectorAll('[data-modal]').forEach((b) => {
      b.addEventListener('click', () => {
        const def = (op.botones || []).find((x) => x.texto === b.dataset.modal);
        B.Audio.evento('clic');
        if (!def || def.mantener !== true) cerrar();
        if (def && def.onClick) def.onClick();
      });
    });
    fondo.addEventListener('click', () => { if (op.cerrable !== false) cerrar(); });
    return cerrar;
  };
  UI.hayModal = () => modalAbierto;

  UI.confirmar = function (titulo, texto, alSí, alNo) {
    UI.modal({
      titulo,
      html: '<p class="texto-serifo">' + texto + '</p>',
      botones: [
        { texto: 'Cancelar', onClick: alNo },
        { texto: 'Confirmar', clase: 'principal', onClick: alSí },
      ],
    });
  };

  UI.hitoModal = function (def) {
    const el = document.createElement('div');
    el.className = 'hito-tarjeta';
    el.innerHTML = '<div class="hito-ico">' + ico('campana') + '</div>'
      + '<div class="hito-titulo">Hito del cuaderno</div>'
      + '<div class="hito-nombre">' + U.escapar(def.titulo) + '</div>'
      + '<div class="hito-texto texto-serifo">' + U.escapar(def.texto) + '</div>';
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 30);
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 600); }, 5200);
  };

  UI.cartaHonestidad = function () {
    const T = B.Triadico;
    UI.modal({
      titulo: 'Carta de honestidad',
      ancho: 'mediana',
      html: '<div class="texto-serifo carta">' + T.CARTA_HONESTIDAD.split('\n\n').map((p) => '<p>' + U.escapar(p) + '</p>').join('') + '</div>'
        + '<p class="nota-doc">' + T.ETIQUETAS.D.sigla + ' Requisito del GDD de BIOSFERA (doc. de aplicaciones, §7.2.6): el juego nunca debe fingir que sus criaturas sienten.</p>',
      botones: [{ texto: 'Entendido', clase: 'principal' }],
      alCerrar: () => { if (B.Juego && B.Juego.registro) { B.Juego.registro.hitos.add('carta'); } },
    });
  };

  /* ================================================================
     Menú principal (pausa)
     ================================================================ */
  UI.menu = function () {
    const J = B.Juego;
    if (J && J.corriendo) J.pausar();
    UI.modal({
      titulo: 'El escritorio del naturalista',
      ancho: 'mediana',
      html:
        '<div class="menu-lista">'
        + '<button class="btn menu-btn" id="m-reanudar">' + ico('play') + 'Reanudar la observación</button>'
        + '<button class="btn menu-btn" id="m-guardar">' + ico('guardar') + 'Guardar partida</button>'
        + '<button class="btn menu-btn" id="m-exportar">' + ico('exportar') + 'Exportar partida (archivo)</button>'
        + '<button class="btn menu-btn" id="m-importar">' + ico('importar') + 'Importar partida</button>'
        + '<button class="btn menu-btn" id="m-ajustes">' + ico('ajustes') + 'Ajustes</button>'
        + '<button class="btn menu-btn" id="m-codice">' + ico('doc') + 'Códice del naturalista</button>'
        + '<button class="btn menu-btn" id="m-carta">' + ico('info') + 'Carta de honestidad</button>'
        + '<button class="btn menu-btn" id="m-nueva">' + ico('brote') + 'Nueva reserva (semilla nueva)</button>'
        + '</div>'
        + '<p class="menu-nota texto-serifo">BIOSFERA v' + C.VERSION + ' · Implementación local del proyecto BIOSFERA del modelo triádico (Ragazzon Gallo, 2026). Todo se ejecuta en tu navegador: sin servidor, sin conexión, sin datos que salgan de aquí.</p>',
      botones: [],
      alCerrar: () => { if (J) J.reanudar(); },
    });
    $('#m-reanudar').addEventListener('click', () => { UI.cerrarModalPorDefecto(); });
    $('#m-guardar').addEventListener('click', () => { J.guardar(); UI.toast('Partida guardada en este navegador.', 'info'); });
    $('#m-exportar').addEventListener('click', () => { J.exportar(); });
    $('#m-importar').addEventListener('click', () => { J.importar(); });
    $('#m-ajustes').addEventListener('click', () => { UI.cerrarModalPorDefecto(); B.Paneles.cajon.alternar('ajustes'); });
    $('#m-codice').addEventListener('click', () => { UI.cerrarModalPorDefecto(); B.Paneles.cajon.alternar('codice'); });
    $('#m-carta').addEventListener('click', () => { UI.cerrarModalPorDefecto(); UI.cartaHonestidad(); });
    $('#m-nueva').addEventListener('click', () => {
      UI.confirmar('Nueva reserva', 'Se abandonará la reserva actual (puedes exportarla antes). ¿Sembrar un mundo nuevo?', () => J.nuevaPartida());
    });
  };
  UI.cerrarModalPorDefecto = function () {
    const raiz = $('#modal-raiz');
    raiz.classList.add('oculto'); raiz.innerHTML = '';
    modalAbierto = false;
    const f = alCerrarActual; alCerrarActual = null;
    if (f) f();
  };

  UI.teclaEscape = function () {
    if (UI.hayModal()) { UI.cerrarModalPorDefecto(); return; }
    const cajon = $('#cajon');
    if (cajon && !cajon.classList.contains('oculto')) { cajon.classList.add('oculto'); return; }
    const inspector = $('#inspector');
    if (inspector && !inspector.classList.contains('oculto')) { inspector.classList.add('oculto'); return; }
    UI.menu();
  };

  /* ================================================================
     Pantalla de introducción
     ================================================================ */
  UI.intro = function (op) {
    const el = $('#intro');
    const hayGuardado = op && op.hayGuardado;
    el.innerHTML =
      '<div class="intro-velo"></div>'
      + '<div class="intro-caja">'
      + '<div class="intro-marca">'
      + '<span class="intro-titulo">BIOSFERA</span>'
      + '<span class="intro-sub">El cuaderno del naturalista</span>'
      + '</div>'
      + '<div class="intro-carta texto-serifo">'
      + '<p>Recibes la custodia de una reserva viva. Te la confía quien la cuidó antes:</p>'
      + '<p class="firma">«No la dominarás: la leerás. Las criaturas seguirán sus propias metas —sus urgencias, sus vetos, su pequeño ingenio— y tú documentarás. Siembra cuando toque, riega cuando seque, y no confundas jamás tu cariño con su interior: no tienen. Lo que tendrás de verdad es el cuaderno: biografías, linajes, inviernos. Que la reserva te encuentre digna.»</p>'
      + '<p class="firma-nombre">— I. Vega, naturalista saliente</p>'
      + '</div>'
      + '<div class="intro-acciones">'
      + '<button class="btn principal" id="btn-nueva">' + ico('brote') + 'Recibir la reserva</button>'
      + (hayGuardado ? '<button class="btn" id="btn-continuar">' + ico('importar') + 'Continuar cuaderno guardado</button>' : '')
      + '<button class="btn" id="btn-guia">' + ico('doc') + 'Cómo se observa</button>'
      + '</div>'
      + '<div class="intro-pie">Basado en el modelo triádico «Materia, Energía y Voluntad» (F. A. Ragazzon Gallo, 2026) · Proyecto BIOSFERA · v' + C.VERSION + '<br>'
      + '<span class="intro-semilla">Semilla: <input id="input-semilla" type="text" placeholder="aleatoria" maxlength="12"></span></div>'
      + '</div>';
    el.classList.remove('oculto');
    $('#btn-nueva').addEventListener('click', () => {
      B.Audio.desbloquear(); B.Audio.evento('hito');
      const semillaTxt = $('#input-semilla').value.trim();
      let semilla = null;
      if (semillaTxt) { semilla = 0; for (const ch of semillaTxt) semilla = (semilla * 31 + ch.charCodeAt(0)) >>> 0; }
      el.classList.add('oculto');
      op.alNueva(semilla);
    });
    if (hayGuardado) {
      $('#btn-continuar').addEventListener('click', () => {
        B.Audio.desbloquear(); B.Audio.evento('clic');
        el.classList.add('oculto');
        op.alContinuar();
      });
    }
    $('#btn-guia').addEventListener('click', () => { B.Paneles.cajon.alternar('codice'); });
  };
  UI.ocultarIntro = function () { const el = $('#intro'); if (el) el.classList.add('oculto'); };

  /* ================================================================
     Pistas del tutorial
     ================================================================ */
  UI.pista = function (texto, clave, alCerrar) {
    const cont = $('#pistas');
    if (!cont || cont.children.length) return;
    const el = document.createElement('div');
    el.className = 'pista';
    el.innerHTML = '<span class="pista-ico">' + Iconos.info + '</span><span>' + texto + '</span><button class="btn mini">Entendido</button>';
    cont.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 60);
    el.querySelector('button').addEventListener('click', () => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 350);
      if (alCerrar) alCerrar();
    });
    if (clave && B.Juego && B.Juego.estado) B.Juego.estado.pistasVistas.add(clave);
  };

  /* ================================================================
     Tooltip flotante
     ================================================================ */
  let tooltipTimer = null;
  UI.tooltip = function (html, x, y, durMs) {
    const el = $('#tooltip');
    el.innerHTML = html;
    el.classList.remove('oculto');
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = U.clamp(x + 16, 8, window.innerWidth - w - 8) + 'px';
    el.style.top = U.clamp(y - h - 12, 8, window.innerHeight - h - 8) + 'px';
    clearTimeout(tooltipTimer);
    if (durMs) tooltipTimer = setTimeout(() => el.classList.add('oculto'), durMs);
  };
  UI.ocultarTooltip = () => { const el = $('#tooltip'); if (el) el.classList.add('oculto'); };

  /* ================================================================
     Eventos del bus
     ================================================================ */
  function enlazarBus() {
    U.bus.on('toast', (d) => UI.toast(d.texto, d.tipo, d.dur));
    U.bus.on('hito', (def) => { UI.hitoModal(def); B.Audio.evento('hito'); });
    U.bus.on('memorable', (d) => {
      UI.toast(d.texto, 'memoria', 6200);
      B.Audio.evento('memorable');
      if (B.Juego && B.Juego.registro) B.Juego.registro.predicciones.vetos++;
    });
    U.bus.on('criatura:nace', () => B.Audio.evento('nace'));
    U.bus.on('criatura:muere', (d) => {
      B.Audio.evento('muere');
      UI.toast(d.c.nombre + ' ha muerto (' + d.causa + ').', 'aviso', 4200);
    });
    U.bus.on('mundo:clima', (d) => {
      const nombres = { soleado: 'El cielo se despeja.', nublado: 'Nubes sobre la reserva.', lluvia: 'Empieza a llover.', nevada: 'Empieza a nevar.' };
      UI.toast(nombres[d.tipo] || d.tipo, 'info', 2600);
    });
  }

  window.BIOS.UI = UI;
})();
