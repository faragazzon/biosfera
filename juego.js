/* ============================================================
   BIOSFERA — juego.js
   El bucle principal y el estado global: cámara, entrada (ratón,
   rueda, teclado), herramientas del naturalista, paso lógico con
   acumulador, fin de ciclo (bancos, hitos, autoguardado), eventos
   memorables con cámara lenta, colapso y re-siembra, y guardado
   en localStorage con exportación/importación a archivo.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;

  const J = {};
  J.estado = null;
  J.mundo = null;
  J.poblacion = null;
  J.registro = null;
  J.corriendo = false;

  /* ================================================================
     Inicialización y arranque
     ================================================================ */
  J.init = function () {
    J.estado = {
      fase: 'intro',
      ciclo: 0, tCiclo: 0,
      velocidad: 1, pausado: false,
      camara: { x: 0, y: 0, zoom: 1 },
      herramienta: 'lupa',
      bancos: { semillas: 0, aguaHoy: 0, micelio: 0, comederos: 0 },
      seleccion: null, seguirId: null,
      fotoCooldown: 0,
      lentoHasta: 0,
      pistasVistas: new Set(),
      ajustes: { volumen: C.AUDIO.VOL_DEF, musica: C.AUDIO.MUSICA_DEF, investigacion: false, trayectorias: false, autoguardado: true },
      acumulado: 0, ultimoTs: 0,
      extincionOfrecida: false,
    };
    J.cargarAjustes();
    J.instalarEntrada();
    J.enlazarBus();
    requestAnimationFrame(J.bucle);
  };

  J.arrancar = function () {
    J.estado.fase = 'jugando';
    J.corriendo = true;
    J.estado.ultimoTs = performance.now();
  };
  J.pausar = function () { J.estado.pausado = true; };
  J.reanudar = function () { J.estado.pausado = false; };

  J.nuevaPartida = function (semilla) {
    semilla = (semilla === undefined || semilla === null) ? ((Math.random() * 4294967295) >>> 0) : (semilla >>> 0);
    J.mundo = new B.Mundo(semilla);
    B.Criatura.fijarMundo(J.mundo);
    J.poblacion = new B.Poblacion(J.mundo, semilla);
    J.poblacion.crearInicial();
    J.registro = new B.Registro();
    for (const c of J.poblacion.lista) J.registro.crearFicha(c);
    const e = J.estado;
    e.fase = 'jugando'; e.ciclo = 0; e.tCiclo = 0;
    e.velocidad = 1; e.pausado = false;
    e.camara = { x: J.mundo.Wpx / 2, y: J.mundo.Hpx / 2, zoom: Math.max(0.8, Math.min(1.25, window.innerWidth / J.mundo.Wpx)) };
    e.herramienta = 'lupa';
    e.bancos = {
      semillas: C.BANCOS.SEMILLAS_INI, aguaHoy: C.BANCOS.AGUA_CICLO,
      micelio: C.BANCOS.MICELIO_INI, comederos: C.BANCOS.COMEDEROS_INI,
    };
    e.seleccion = null; e.seguirId = null; e.fotoCooldown = 0;
    e.extincionOfrecida = false;
    e.pistasVistas = new Set();
    B.Render.prepararMundo(J.mundo);
    J.corriendo = true;
    e.ultimoTs = performance.now();
    B.UI.refrescarBancos();
    J.registro.cronicaAdd('nota', 'La reserva se siembra. Semilla ' + semilla + '.', 0);
    B.UI.toast('La reserva está viva. Arrastra para recorrerla; selecciona a alguien con la lupa.', 'info', 6000);
    setTimeout(() => {
      if (!e.pistasVistas.has('mover')) {
        B.UI.pista('Arrastra para mover la cámara, rueda para acercar. Pulsa <strong>R</strong> para el cuaderno y <strong>K</strong> para el códice.', 'mover');
      }
    }, 1400);
    return semilla;
  };

  /* ================================================================
     Bucle principal
     ================================================================ */
  J.bucle = function (ts) {
    requestAnimationFrame(J.bucle);
    if (!J.estado) return;
    const e = J.estado;
    const dtReal = Math.min(60, ts - (e.ultimoTs || ts));
    e.ultimoTs = ts;

    if (J.corriendo && !e.pausado && J.mundo) {
      let factor = e.velocidad;
      if (ts < e.lentoHasta) factor = Math.max(0.25, factor * 0.3); // momento memorable
      e.acumulado += dtReal * factor;
      let pasos = 0;
      while (e.acumulado >= C.TIEMPO.PASO && pasos < C.TIEMPO.MAX_PASOS_FRAME) {
        J.paso(C.TIEMPO.PASO / 1000);
        e.acumulado -= C.TIEMPO.PASO;
        pasos++;
      }
      if (pasos >= C.TIEMPO.MAX_PASOS_FRAME) e.acumulado = 0;
      // seguimiento de cámara
      if (e.seguirId) {
        const c = J.poblacion.porId(e.seguirId);
        if (c) {
          e.camara.x = U.mezcla(e.camara.x, c.x, 0.12);
          e.camara.y = U.mezcla(e.camara.y, c.y, 0.12);
        } else e.seguirId = null;
      }
    }

    B.Render.cuadro(ts);
    if (ts - (J._ultUi || 0) > 240) {
      J._ultUi = ts;
      if (J.mundo) {
        const info = J.mundo.luzTotal(e.ciclo, e.tCiclo);
        B.UI.refrescarBarra(info);
      }
    }
  };

  J.paso = function (dtS) {
    const e = J.estado;
    e.tCiclo += dtS * 1000;
    const info = J.mundo.paso(dtS, e.ciclo, e.tCiclo);
    J.poblacion.paso(dtS, e.ciclo, e.tCiclo);
    if (e.tCiclo >= C.TIEMPO.CICLO_MS) {
      e.tCiclo -= C.TIEMPO.CICLO_MS;
      J.finDeCiclo(info);
    }
  };

  J.finDeCiclo = function (info) {
    const e = J.estado;
    e.ciclo++;
    J.poblacion.finDeCiclo();
    if (e.fotoCooldown > 0) e.fotoCooldown--;
    // bancos del naturalista
    e.bancos.semillas = Math.min(C.BANCOS.SEMILLAS_MAX, e.bancos.semillas + C.BANCOS.SEMILLAS_CICLO);
    e.bancos.aguaHoy = C.BANCOS.AGUA_CICLO;
    if (e.ciclo % C.BANCOS.MICELIO_CICLO === 0) e.bancos.micelio = Math.min(C.BANCOS.MICELIO_MAX, e.bancos.micelio + 1);
    if (e.ciclo % C.BANCOS.COMEDEROS_CICLO === 0) e.bancos.comederos += 1;
    B.UI.refrescarBancos();
    // contadores ecológicos para hitos
    const residuoAntes = J.mundo.residuoTotal();
    const cont = J.poblacion.contar();
    let edadMax = 0, generacion = 1, albino = false, sindromes = 0, cazas = 0;
    for (const c of J.poblacion.lista) {
      edadMax = Math.max(edadMax, c.edadCiclos);
      if (c.genoma.albino) albino = true;
      if (c.sindromeDominante()) sindromes++;
      cazas += c.cazas;
      let gen = 1, p = c;
      const visitados = new Set();
      while (p && p.padres && p.padres.length && !visitados.has(p.id)) {
        visitados.add(p.id);
        gen++; p = p.padres[0] || p.padres[1];
      }
      generacion = Math.max(generacion, gen);
    }
    const snap = {
      ciclo: e.ciclo, ...cont, bio: J.mundo.biomasaMedia(), luz: info.estacional,
      nacimientos: J.poblacion.nacimientos, muertes: (J.poblacion.muertes.total || 0),
      edadMax, generacion, albino, sindromes, cazas,
    };
    J.registro.finDeCiclo(snap);
    U.bus.emitir('ciclo:fin', { ciclo: e.ciclo, info });
    // pistas contextuales
    if (e.ciclo === 2 && !e.pistasVistas.has('herram')) {
      B.UI.pista('Las herramientas del naturalista están abajo: <strong>sembrar</strong>, <strong>regar</strong>, <strong>micelio</strong>, <strong>comedero</strong>. Nunca mandas: cultivas.', 'herram');
    }
    // extinción: ofrecer re-siembra (P-B4)
    if (cont.total === 0 && !e.extincionOfrecida) {
      e.extincionOfrecida = true;
      J.registro.cronicaAdd('ciclo', 'La reserva queda en silencio: extinción total.', e.ciclo);
      B.UI.modal({
        titulo: 'El silencio de la reserva',
        html: '<p class="texto-serifo">No queda nadie vivo. El colapso también es dato: la curva del cuaderno enseña (P-B4). Puedes re-sembrar la reserva con linajes nuevos y comparar las curvas, o quedarte a leer las fichas congeladas.</p>',
        botones: [
          { texto: 'Quedarme en el silencio' },
          { texto: 'Re-sembrar la reserva', clase: 'principal', onClick: () => J.resembrar() },
        ],
      });
    }
    if (cont.total > 0) e.extincionOfrecida = false;
    // autoguardado
    if (e.ajustes.autoguardado && e.ciclo % 5 === 0) J.guardar(true);
  };

  J.resembrar = function () {
    const e = J.estado;
    const p = J.poblacion.puntoNacimiento(0.65, 1.35);
    const rng = U.RNG((Math.random() * 2147483647) | 0);
    let n = 0;
    for (let i = 0; i < 6; i++) {
      const pt = J.poblacion.puntoNacimiento(0.65, 1.35) || p;
      if (!pt) continue;
      const g = B.Genoma.aleatorio(rng);
      g.tam = U.clamp(g.tam, 0.6, 1.3);
      const c = new B.Criatura({ genoma: g, x: pt.x, y: pt.y, rng, ciclo: e.ciclo });
      J.poblacion.agregar(c);
      J.registro.crearFicha(c);
      n++;
    }
    if (n) {
      J.registro.hitos.add('reunion');
      J.registro.cronicaAdd('nota', 'Re-siembra de emergencia: ' + n + ' vidas nuevas.', e.ciclo);
      B.UI.toast('La reserva late de nuevo: ' + n + ' vidas sembradas.', 'hito');
      B.Audio.evento('nace');
    }
  };

  /* ================================================================
     Velocidad, herramientas, seguimiento
     ================================================================ */
  J.fijarVelocidad = function (v) {
    if (v === 0) { J.estado.pausado = !J.estado.pausado; }
    else { J.estado.velocidad = v; J.estado.pausado = false; }
  };
  J.fijarHerramienta = function (id) {
    J.estado.herramienta = id;
    B.UI.fijarHerramientaVisual(id);
  };
  J.seguir = function (id) { J.estado.seguirId = id; };
  J.seleccionar = function (id) {
    J.estado.seleccion = id;
    if (id) B.Paneles.inspector.mostrar(id);
    else B.Paneles.inspector.ocultar();
  };

  J.hacerFoto = function () {
    const e = J.estado;
    if (e.fotoCooldown > 0) {
      B.UI.toast('La cámara descarga sus placas: podrás fotografiar en el ciclo ' + (e.ciclo + e.fotoCooldown) + '.', 'aviso', 2600);
      B.Audio.evento('error');
      return;
    }
    const url = B.Render.capturaFoto();
    J.registro.foto(url, e.ciclo);
    e.fotoCooldown = C.FOTO.COOLDOWN_CICLOS;
    B.Audio.evento('foto');
    B.UI.toast('Fotografía añadida al cuaderno.', 'info', 2600);
    U.bus.emitir('fx', { tipo: 'brillo', x: 0, y: 0 });
  };

  /* ================================================================
     Aplicación de herramientas al mundo
     ================================================================ */
  J.aplicarHerramienta = function (wx, wy) {
    const e = J.estado;
    const m = J.mundo;
    const t = m.tileEn(wx, wy);
    switch (e.herramienta) {
      case 'lupa': {
        // ¿criatura bajo el puntero?
        const c = J.poblacion.vecinoMasCercano(wx, wy, 34, (x) => x.vivo);
        if (c) { J.seleccionar(c.id); B.Audio.evento('clic'); return; }
        J.seleccionar(null);
        if (t) {
          const i = t.i;
          const region = m.tipo[i] === 1 ? 'Región 2/4 · agua (materia y energía en flujo)'
            : 'Región 4 · materia y energía sin metas [D]';
          B.UI.tooltip(
            '<strong>Tile ' + t.tx + ',' + t.ty + '</strong><br>'
            + region + '<br>'
            + 'Biomasa: ' + (m.bio[i] * 100).toFixed(0) + '% · Fertilidad: ' + (m.fertil[i] * 100).toFixed(0) + '%<br>'
            + 'Humedad: ' + (m.humedad[i] * 100).toFixed(0) + '% · Residuo: ' + (m.residuo[i] * 100).toFixed(0) + '%'
            + (m.hongos[i] > 0.1 ? '<br>Micelio activo: recicla residuo en fertilidad.' : ''),
            J._ultPuntero.x, J._ultPuntero.y, 3400);
        }
        return;
      }
      case 'sembrar': {
        if (!t) return;
        if (e.bancos.semillas <= 0) { B.UI.toast('Sin semillas: se reponen con los ciclos.', 'aviso'); B.Audio.evento('error'); return; }
        if (m.sembrar(t.tx, t.ty)) {
          e.bancos.semillas--;
          B.Render.marcaSucia(t.tx, t.ty);
          U.bus.emitir('fx', { tipo: 'brillo', x: wx, y: wy });
          B.Audio.evento('clic');
          B.UI.refrescarBancos();
        } else B.UI.toast('Ahí no prende el pasto (agua o roca).', 'aviso', 2200);
        return;
      }
      case 'regar': {
        if (!t) return;
        if (e.bancos.aguaHoy <= 0) { B.UI.toast('El cantimplora está vacía: se llena cada ciclo.', 'aviso'); B.Audio.evento('error'); return; }
        if (m.regar(t.tx, t.ty)) {
          e.bancos.aguaHoy--;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) B.Render.marcaSucia(t.tx + dx, t.ty + dy);
          U.bus.emitir('fx', { tipo: 'onda', x: wx, y: wy });
          B.Audio.evento('clic');
          B.UI.refrescarBancos();
        }
        return;
      }
      case 'micelio': {
        if (!t) return;
        if (e.bancos.micelio <= 0) { B.UI.toast('Sin cultivos de micelio.', 'aviso'); B.Audio.evento('error'); return; }
        if (m.inocular(t.tx, t.ty)) {
          e.bancos.micelio--;
          B.Render.marcaSucia(t.tx, t.ty);
          U.bus.emitir('fx', { tipo: 'espora', x: wx, y: wy });
          B.Audio.evento('clic');
          B.UI.refrescarBancos();
          J.registro.hongosReciclados += 8;
        } else B.UI.toast('El micelio necesita residuo sobre el que crecer.', 'aviso', 2600);
        return;
      }
      case 'comedero': {
        if (e.bancos.comederos <= 0) { B.UI.toast('Sin comederos nuevos.', 'aviso'); B.Audio.evento('error'); return; }
        if (m.colocarComedero(wx, wy)) {
          e.bancos.comederos--;
          B.Audio.evento('clic');
          B.UI.refrescarBancos();
          B.UI.toast('Comedero colocado. Las curiosas lo encontrarán.', 'info', 2800);
        }
        return;
      }
      case 'etiqueta': {
        const c = J.poblacion.vecinoMasCercano(wx, wy, 34, (x) => x.vivo);
        if (c) { J.seleccionar(c.id); setTimeout(() => { const inp = document.getElementById('input-nombre'); if (inp) { inp.focus(); inp.select(); } }, 300); }
        else B.UI.toast('Señala a una criatura para bautizarla.', 'aviso', 2400);
        return;
      }
      case 'foto': {
        J.hacerFoto();
        return;
      }
    }
  };

  /* ================================================================
     Entrada: ratón, rueda y teclado
     ================================================================ */
  J._ultPuntero = { x: 0, y: 0 };
  J.instalarEntrada = function () {
    const lienzo = document.getElementById('lienzo');
    let arrastre = null;

    lienzo.addEventListener('pointerdown', (ev) => {
      arrastre = { x: ev.clientX, y: ev.clientY, camX: J.estado.camara.x, camY: J.estado.camara.y, movido: false };
      lienzo.setPointerCapture(ev.pointerId);
    });
    lienzo.addEventListener('pointermove', (ev) => {
      J._ultPuntero.x = ev.clientX; J._ultPuntero.y = ev.clientY;
      if (!arrastre) return;
      const dx = ev.clientX - arrastre.x, dy = ev.clientY - arrastre.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) arrastre.movido = true;
      if (arrastre.movido) {
        J.estado.seguirId = null;
        J.estado.camara.x = arrastre.camX - dx / J.estado.camara.zoom;
        J.estado.camara.y = arrastre.camY - dy / J.estado.camara.zoom;
      }
    });
    lienzo.addEventListener('pointerup', (ev) => {
      if (arrastre && !arrastre.movido && J.corriendo) {
        const w = B.Render.aMundo(ev.clientX, ev.clientY);
        J.aplicarHerramienta(w.x, w.y);
      }
      arrastre = null;
    });
    lienzo.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const e = J.estado;
      const antes = B.Render.aMundo(ev.clientX, ev.clientY);
      const factor = Math.exp(-ev.deltaY * 0.0011);
      e.camara.zoom = U.clamp(e.camara.zoom * factor, 0.55, 3.4);
      const despues = B.Render.aMundo(ev.clientX, ev.clientY);
      e.camara.x += antes.x - despues.x;
      e.camara.y += antes.y - despues.y;
    }, { passive: false });

    // teclado
    const teclas = {};
    window.addEventListener('keydown', (ev) => {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
      const k = ev.key.toLowerCase();
      teclas[k] = true;
      if (B.UI.hayModal()) return;
      switch (k) {
        case ' ': ev.preventDefault(); J.fijarVelocidad(0); break;
        case '1': J.fijarVelocidad(1); break;
        case '3': J.fijarVelocidad(3); break;
        case '8': J.fijarVelocidad(8); break;
        case 'z': J.fijarHerramienta('lupa'); break;
        case 'x': J.fijarHerramienta('sembrar'); break;
        case 'c': J.fijarHerramienta('regar'); break;
        case 'v': J.fijarHerramienta('micelio'); break;
        case 'b': J.fijarHerramienta('comedero'); break;
        case 'n': J.fijarHerramienta('etiqueta'); break;
        case 'p': J.hacerFoto(); break;
        case 'f': if (J.estado.seleccion) J.seguir(J.estado.seleccion); break;
        case 'r': B.Paneles.cajon.alternar('registro'); break;
        case 'k': B.Paneles.cajon.alternar('codice'); break;
        case 'h': B.UI.cartaHonestidad(); break;
      }
    });
    window.addEventListener('keyup', (ev) => { teclas[ev.key.toLowerCase()] = false; });
    // paneo continuo con WASD / flechas
    setInterval(() => {
      if (!J.corriendo || B.UI.hayModal()) return;
      const e = J.estado;
      let dx = 0, dy = 0;
      if (teclas['w'] || teclas['arrowup']) dy -= 1;
      if (teclas['s'] || teclas['arrowdown']) dy += 1;
      if (teclas['a'] || teclas['arrowleft']) dx -= 1;
      if (teclas['d'] || teclas['arrowright']) dx += 1;
      if (dx || dy) {
        e.seguirId = null;
        const v = 14 / e.camara.zoom;
        e.camara.x += dx * v; e.camara.y += dy * v;
      }
    }, 16);

    // minimapa: clic para saltar
    const mini = document.getElementById('minimapa');
    if (mini) {
      mini.addEventListener('pointerdown', (ev) => {
        const r = mini.getBoundingClientRect();
        const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
        J.estado.camara.x = fx * J.mundo.Wpx;
        J.estado.camara.y = fy * J.mundo.Hpx;
        J.estado.seguirId = null;
      });
    }
  };

  /* ================================================================
     Bus: eventos del mundo de la simulación
     ================================================================ */
  J.enlazarBus = function () {
    U.bus.on('fx', (d) => B.Efectos.emitir(d.tipo, d.x, d.y));
    U.bus.on('memorable', (d) => {
      J.estado.lentoHasta = performance.now() + 2400; // cámara lenta breve
      // foto candidata si la criatura está en pantalla
      const p = B.Render.aPantalla(d.x, d.y);
      if (p.x > 0 && p.x < window.innerWidth && p.y > 0 && p.y < window.innerHeight && J.estado.fotoCooldown === 0) {
        // no automática: el naturalista decide. Solo avisamos.
      }
    });
    U.bus.on('criatura:muere', (d) => {
      J.poblacion.registrarMuerte(d.causa);
      J.registro.congelarFicha(d.c, d.causa);
      B.Render.marcaSuciaPx(d.c.x, d.c.y);
    });
    U.bus.on('criatura:nace', (d) => { J.registro.crearFicha(d.c); });
    U.bus.on('criatura:bio', (d) => { /* la biografía vive en la criatura; la ficha la lee en vivo */ });
    U.bus.on('triadico:transicion', (d) => {
      J.registro.cronicaAdd(d.tipo === 'emergencia' ? 'nace' : d.tipo === 'disolucion' ? 'muere' : 'veto', d.texto);
    });
  };

  /* ================================================================
     Guardado, carga, exportación e importación
     ================================================================ */
  J.serializar = function () {
    return {
      v: 1,
      estado: {
        ciclo: J.estado.ciclo, tCiclo: Math.round(J.estado.tCiclo),
        velocidad: J.estado.velocidad, camara: { ...J.estado.camara },
        herramienta: J.estado.herramienta, bancos: { ...J.estado.bancos },
        fotoCooldown: J.estado.fotoCooldown,
        pistasVistas: Array.from(J.estado.pistasVistas),
        ajustes: { ...J.estado.ajustes },
      },
      mundo: J.mundo.serializar(),
      poblacion: J.poblacion.serializar(),
      registro: J.registro.serializar(),
      guardadoEn: new Date().toISOString(),
    };
  };

  J.guardar = function (silencioso) {
    if (!J.mundo || !J.corriendo) return;
    try {
      localStorage.setItem(C.GUARDADO_CLAVE, JSON.stringify(J.serializar()));
      if (!silencioso) B.UI.toast('Partida guardada.', 'info', 2000);
    } catch (e) {
      if (!silencioso) B.UI.toast('No se pudo guardar en este navegador (¿almacenamiento lleno?). Usa Exportar a archivo.', 'aviso', 5200);
    }
  };
  J.hayGuardado = function () {
    try { return !!localStorage.getItem(C.GUARDADO_CLAVE); } catch (e) { return false; }
  };

  J.cargar = function () {
    let datos = null;
    try { datos = JSON.parse(localStorage.getItem(C.GUARDADO_CLAVE) || 'null'); } catch (e) { datos = null; }
    if (!datos) { B.UI.toast('No hay partida guardada.', 'aviso'); return false; }
    return J.cargarDatos(datos);
  };

  J.cargarDatos = function (datos) {
    try {
      const e = J.estado;
      J.mundo = B.Mundo.deserializar(datos.mundo);
      B.Criatura.fijarMundo(J.mundo);
      J.poblacion = B.Poblacion.deserializar(datos.poblacion, J.mundo, J.mundo.semilla);
      J.registro = B.Registro.deserializar(datos.registro);
      const s = datos.estado;
      e.ciclo = s.ciclo; e.tCiclo = s.tCiclo; e.velocidad = s.velocidad || 1;
      e.camara = s.camara || { x: J.mundo.Wpx / 2, y: J.mundo.Hpx / 2, zoom: 1 };
      e.herramienta = s.herramienta || 'lupa';
      e.bancos = Object.assign({ semillas: 6, aguaHoy: 3, micelio: 3, comederos: 2 }, s.bancos);
      e.fotoCooldown = s.fotoCooldown || 0;
      e.pistasVistas = new Set(s.pistasVistas || []);
      e.ajustes = Object.assign(e.ajustes, s.ajustes || {});
      e.seleccion = null; e.seguirId = null; e.pausado = false;
      e.extincionOfrecida = false;
      B.Render.prepararMundo(J.mundo);
      B.Audio.ajustar({ volumen: e.ajustes.volumen, musica: e.ajustes.musica });
      J.corriendo = true;
      e.ultimoTs = performance.now();
      B.UI.refrescarBancos();
      B.UI.fijarHerramientaVisual(e.herramienta);
      B.UI.toast('Cuaderno recuperado: ciclo ' + e.ciclo + '.', 'info', 3400);
      return true;
    } catch (err) {
      console.error('Error al cargar', err);
      B.UI.toast('La partida guardada está dañada y no se pudo abrir.', 'aviso', 5000);
      return false;
    }
  };

  J.exportar = function () {
    try {
      const blob = new Blob([JSON.stringify(J.serializar())], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'biosfera-ciclo' + J.estado.ciclo + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      B.UI.toast('Partida exportada como archivo.', 'info');
    } catch (e) {
      B.UI.toast('La exportación falló en este navegador.', 'aviso');
    }
  };

  J.importar = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const lector = new FileReader();
      lector.onload = () => {
        try {
          const datos = JSON.parse(lector.result);
          if (!datos.mundo || !datos.poblacion) throw new Error('formato');
          if (J.cargarDatos(datos)) B.UI.cerrarModalPorDefecto();
        } catch (e) {
          B.UI.toast('Ese archivo no es una partida de BIOSFERA válida.', 'aviso', 4200);
        }
      };
      lector.readAsText(f);
    });
    input.click();
  };

  J.guardarAjustes = function () {
    try { localStorage.setItem(C.AJUSTES_CLAVE, JSON.stringify(J.estado.ajustes)); } catch (e) { /* sin almacenamiento: seguir */ }
  };
  J.cargarAjustes = function () {
    try {
      const a = JSON.parse(localStorage.getItem(C.AJUSTES_CLAVE) || 'null');
      if (a) J.estado.ajustes = Object.assign(J.estado.ajustes, a);
    } catch (e) { /* nada */ }
    B.Audio.ajustar({ volumen: J.estado.ajustes.volumen, musica: J.estado.ajustes.musica });
  };

  window.BIOS.Juego = J;
})();
