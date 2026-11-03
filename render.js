/* ============================================================
   BIOSFERA — render.js
   Orquestador de dibujo: cache de tiles del mundo, cámara,
   agua animada, pasto mecido, comederos, restos, criaturas
   (delegado a Dibujante), iluminación y clima (delegado a
   Efectos) y minimapa.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;

  const R = {};
  let lienzo = null, ctx = null, miniLienzo = null, miniCtx = null;
  let cache = null, cacheCtx = null;
  let sucias = [];
  const vista = { w: 1280, h: 720, dpr: 1 };

  /* Paleta estacional del terreno */
  function paletaEstacion(estacion) {
    switch (estacion) {
      case 'Primavera': return { suelo: [104, 116, 74], sueloOsc: [78, 92, 56], pasto: [116, 158, 82], pastoClaro: [146, 188, 96], tinte: null };
      case 'Verano': return { suelo: [116, 118, 66], sueloOsc: [92, 94, 52], pasto: [128, 158, 62], pastoClaro: [168, 186, 84], tinte: 'rgba(255,240,190,0.05)' };
      case 'Otoño': return { suelo: [110, 98, 62], sueloOsc: [86, 76, 50], pasto: [150, 138, 62], pastoClaro: [176, 150, 74], tinte: 'rgba(255,214,150,0.07)' };
      default: return { suelo: [96, 100, 88], sueloOsc: [74, 78, 70], pasto: [128, 140, 108], pastoClaro: [158, 170, 130], tinte: 'rgba(205,220,255,0.08)' };
    }
  }

  /* ---------------- Inicialización --------------------------------- */
  R.init = function (lienzoEl, miniEl) {
    lienzo = lienzoEl; ctx = lienzo.getContext('2d');
    miniLienzo = miniEl; miniCtx = miniEl.getContext('2d');
    R.redimensionar();
    window.addEventListener('resize', R.redimensionar);
  };
  R.redimensionar = function () {
    if (!lienzo) return;
    vista.w = window.innerWidth; vista.h = window.innerHeight;
    vista.dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = Math.floor(vista.w * vista.dpr);
    lienzo.height = Math.floor(vista.h * vista.dpr);
    lienzo.style.width = vista.w + 'px';
    lienzo.style.height = vista.h + 'px';
  };

  /* ---------------- Cache de tiles ---------------------------------- */
  function crearCache(mundo) {
    cache = document.createElement('canvas');
    cache.width = mundo.Wpx; cache.height = mundo.Hpx;
    cacheCtx = cache.getContext('2d');
    sucias = [];
    for (let ty = 0; ty < mundo.H; ty++) for (let tx = 0; tx < mundo.W; tx++) dibujarTile(mundo, tx, ty, 'Primavera');
  }
  R.prepararMundo = function (mundo) { crearCache(mundo); R.dibujarMinimapaBase(mundo); };

  function dibujarTile(mundo, tx, ty, estacion) {
    const g = cacheCtx;
    const T = mundo.TILE;
    const i = mundo.idx(tx, ty);
    const x = tx * T, y = ty * T;
    const pal = paletaEstacion(estacion);
    const tipo = mundo.tipo[i];

    if (tipo === 1) { // agua
      const prof = U.clamp(1 - mundo.distAgua[i] / 2, 0.15, 1);
      g.fillStyle = 'rgb(' + Math.round(44 - 18 * prof) + ',' + Math.round(96 - 30 * prof) + ',' + Math.round(126 - 26 * prof) + ')';
      g.fillRect(x, y, T, T);
      // orilla suave
      if (mundo.distAgua[i] === 0) {
        g.fillStyle = 'rgba(190,225,235,0.18)';
        if (!mundo.esAgua(tx, ty - 1)) g.fillRect(x, y, T, 4);
        if (!mundo.esAgua(tx, ty + 1)) g.fillRect(x, y + T - 4, T, 4);
        if (!mundo.esAgua(tx - 1, ty)) g.fillRect(x, y, 4, T);
        if (!mundo.esAgua(tx + 1, ty)) g.fillRect(x + T - 4, y, 4, T);
      }
      return;
    }
    if (tipo === 2) { // roca
      const j = U.ruido01(tx, ty, 77) * 0.5 + 0.5;
      g.fillStyle = 'rgb(' + Math.round(112 + 30 * j) + ',' + Math.round(112 + 28 * j) + ',' + Math.round(118 + 26 * j) + ')';
      g.fillRect(x, y, T, T);
      g.fillStyle = 'rgba(60,62,68,0.35)';
      g.beginPath();
      g.moveTo(x + 4, y + T - 5); g.lineTo(x + T * 0.5, y + 6 + 8 * j); g.lineTo(x + T - 4, y + T - 5);
      g.closePath(); g.fill();
      return;
    }
    // suelo: variación por fertilidad y humedad
    const hum = mundo.humedad[i];
    const j = U.ruido01(tx, ty, 55);
    const base = pal.suelo.map((v, k) => Math.round(v * (0.88 + 0.18 * j) - 14 * hum * (k === 0 ? 0 : 1)));
    g.fillStyle = 'rgb(' + base[0] + ',' + base[1] + ',' + base[2] + ')';
    g.fillRect(x, y, T, T);
    // textura de puntitos
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (let p = 0; p < 3; p++) {
      const px = x + U.ruido01(tx * 3 + p, ty, 11) * (T - 4) + 2;
      const py = y + U.ruido01(tx, ty * 3 + p, 13) * (T - 4) + 2;
      g.fillRect(px, py, 2, 2);
    }
    // biomasa: base de pasto
    const bio = mundo.bio[i];
    if (bio > 0.03) {
      const alpha = U.clamp(bio * 1.05, 0, 0.92);
      g.fillStyle = U.rgba(pal.pasto[0], pal.pasto[1], pal.pasto[2], alpha);
      g.fillRect(x + 1, y + 1, T - 2, T - 2);
      if (bio > 0.45) { // matas estáticas de detalle
        g.strokeStyle = U.rgba(pal.pastoClaro[0], pal.pastoClaro[1], pal.pastoClaro[2], 0.5);
        g.lineWidth = 1.4;
        const n = bio > 0.75 ? 3 : 2;
        for (let m = 0; m < n; m++) {
          const bx = x + 5 + U.ruido01(tx * 7 + m, ty, 21) * (T - 10);
          const by = y + 5 + U.ruido01(tx, ty * 7 + m, 23) * (T - 10);
          g.beginPath(); g.moveTo(bx, by + 4); g.quadraticCurveTo(bx + 1.5, by, bx + 3, by + 4); g.stroke();
        }
      }
    }
    // residuo: mancha oscura de desorden
    const res = mundo.residuo[i];
    if (res > 0.03) {
      g.fillStyle = 'rgba(66,50,38,' + U.clamp(res * 0.75, 0, 0.8) + ')';
      g.beginPath();
      g.ellipse(x + T / 2, y + T / 2, T * 0.42 * U.clamp(res + 0.25, 0, 1), T * 0.34 * U.clamp(res + 0.25, 0, 1), 0, 0, Math.PI * 2);
      g.fill();
    }
    // micelio: puntos claros
    const hon = mundo.hongos[i];
    if (hon > 0.08) {
      g.fillStyle = 'rgba(225,220,200,' + U.clamp(hon * 0.8, 0, 0.85) + ')';
      const n = hon > 0.5 ? 4 : 2;
      for (let m = 0; m < n; m++) {
        const bx = x + 6 + U.ruido01(tx * 5 + m + 60, ty, 31) * (T - 12);
        const by = y + 6 + U.ruido01(tx, ty * 5 + m + 60, 33) * (T - 12);
        g.beginPath(); g.arc(bx, by, 1.6 + hon, 0, Math.PI * 2); g.fill();
      }
    }
  }

  R.marcaSucia = function (tx, ty) { if (sucias.length < 4000) sucias.push([tx, ty]); };
  R.marcaSuciaPx = function (xpx, ypx) {
    const m = B.Juego && B.Juego.mundo;
    if (!m) return;
    const tx = Math.floor(xpx / m.TILE), ty = Math.floor(ypx / m.TILE);
    if (m.dentro(tx, ty)) R.marcaSucia(tx, ty);
  };

  function procesarSucias(mundo, estacion, ciclo) {
    let n = 0;
    while (sucias.length && n < C.RENDER.MAX_TILES_SUCIOS) {
      const [tx, ty] = sucias.shift();
      dibujarTile(mundo, tx, ty, estacion);
      n++;
    }
    // Refresco lento de la estación: 12 tiles aleatorios por frame
    if (ciclo % 1 === 0) {
      for (let k = 0; k < 12; k++) {
        const tx = (Math.random() * mundo.W) | 0, ty = (Math.random() * mundo.H) | 0;
        dibujarTile(mundo, tx, ty, estacion);
      }
    }
  }

  /* ---------------- Cámara ------------------------------------------ */
  function limitesCamara(cam) {
    const m = B.Juego.mundo;
    const hw = vista.w / 2 / cam.zoom, hh = vista.h / 2 / cam.zoom;
    cam.x = m.Wpx < hw * 2 ? m.Wpx / 2 : U.clamp(cam.x, hw, m.Wpx - hw);
    cam.y = m.Hpx < hh * 2 ? m.Hpx / 2 : U.clamp(cam.y, hh, m.Hpx - hh);
  }
  R.aPantalla = function (x, y) {
    const e = B.Juego.estado;
    return { x: (x - e.camara.x) * e.camara.zoom + vista.w / 2, y: (y - e.camara.y) * e.camara.zoom + vista.h / 2 };
  };
  R.aMundo = function (sx, sy) {
    const e = B.Juego.estado;
    return { x: (sx - vista.w / 2) / e.camara.zoom + e.camara.x, y: (sy - vista.h / 2) / e.camara.zoom + e.camara.y };
  };

  /* ---------------- Cuadro principal -------------------------------- */
  R.cuadro = function (tReal) {
    const J = B.Juego;
    if (!J || !J.mundo) return;
    const e = J.estado, mundo = J.mundo, pob = J.poblacion;
    const info = mundo.luzTotal(e.ciclo, e.tCiclo);
    const estacion = mundo.estacion(e.ciclo);
    limitesCamara(e.camara);

    procesarSucias(mundo, estacion, e.ciclo);

    // Fondo fuera del mundo (el escritorio del naturalista)
    ctx.setTransform(vista.dpr, 0, 0, vista.dpr, 0, 0);
    ctx.fillStyle = '#141a14';
    ctx.fillRect(0, 0, vista.w, vista.h);

    // Transformación de cámara
    const z = e.camara.zoom * vista.dpr;
    ctx.setTransform(z, 0, 0, z, vista.dpr * (vista.w / 2 - e.camara.x * e.camara.zoom), vista.dpr * (vista.h / 2 - e.camara.y * e.camara.zoom));

    // Suelo desde cache
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cache, 0, 0);

    // Tiles visibles
    const T = mundo.TILE;
    const esq = R.aMundo(0, 0);
    const esq2 = R.aMundo(vista.w, vista.h);
    const tx0 = Math.max(0, Math.floor(esq.x / T) - 1), ty0 = Math.max(0, Math.floor(esq.y / T) - 1);
    const tx1 = Math.min(mundo.W - 1, Math.ceil(esq2.x / T) + 1), ty1 = Math.min(mundo.H - 1, Math.ceil(esq2.y / T) + 1);

    dibujarAguaAnimada(mundo, tx0, ty0, tx1, ty1, tReal, info);
    dibujarPastoMecido(mundo, tx0, ty0, tx1, ty1, tReal, estacion);
    dibujarRestos(mundo, e, tReal);
    dibujarComederos(mundo, tReal);

    // Criaturas ordenadas por y (profundidad)
    const vivas = pob.lista.filter((c) => c.vivo);
    vivas.sort((a, b) => a.y - b.y);
    const sel = e.seleccion ? pob.porId(e.seleccion) : null;
    const margen = 70; // margen para no cortar animaciones que asoman
    const enVista = (x, y) => x > esq.x - margen && x < esq2.x + margen && y > esq.y - margen && y < esq2.y + margen;
    for (const c of vivas) {
      B.Dibujante.criatura(ctx, c, {
        tReal, seleccionada: !!sel && sel.id === c.id, investigacion: e.ajustes.investigacion,
        objetivo: e.ajustes.trayectorias ? c : null, zoom: e.camara.zoom,
        enVista: enVista(c.x, c.y),
      });
    }

    // Partículas de mundo
    B.Efectos.pasoMundo(ctx, e, mundo, info, tReal, { tx0, ty0, tx1, ty1 });

    // Iluminación y clima (espacio de pantalla)
    ctx.setTransform(vista.dpr, 0, 0, vista.dpr, 0, 0);
    B.Efectos.iluminacion(ctx, vista, info, estacion, tReal);
    B.Efectos.climaPantalla(ctx, vista, mundo.clima.tipo, tReal, estacion, info);

    dibujarMinimapa(mundo, pob, e);
  };

  /* ---------------- Agua animada ------------------------------------ */
  function dibujarAguaAnimada(mundo, tx0, ty0, tx1, ty1, tReal, info) {
    const T = mundo.TILE;
    ctx.fillStyle = 'rgba(220,240,250,0.10)';
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!mundo.esAgua(tx, ty)) continue;
        const i = mundo.idx(tx, ty);
        if (mundo.distAgua[i] !== 0) continue;
        const x = tx * T, y = ty * T;
        const f = Math.sin(tReal * 0.0011 + tx * 0.9 + ty * 1.7);
        const f2 = Math.sin(tReal * 0.0007 - tx * 1.3 + ty * 0.6);
        ctx.fillRect(x + 4 + f * 3, y + T * 0.3 + f2 * 2, T * 0.35, 1.6);
        ctx.fillRect(x + T * 0.5 - f2 * 3, y + T * 0.7 + f * 2, T * 0.28, 1.4);
      }
    }
    // Luna/reflejo nocturno: brillo suave
    if (info.D < 0.3) {
      ctx.fillStyle = 'rgba(200,220,255,0.05)';
      for (let ty = ty0; ty <= ty1; ty += 2) {
        for (let tx = tx0; tx <= tx1; tx += 2) {
          if (!mundo.esAgua(tx, ty)) continue;
          ctx.fillRect(tx * T, ty * T + Math.sin(tReal * 0.0009 + tx) * 2, T * 2, T);
        }
      }
    }
  }

  /* ---------------- Pasto mecido ------------------------------------ */
  function dibujarPastoMecido(mundo, tx0, ty0, tx1, ty1, tReal, estacion) {
    const T = mundo.TILE;
    let dibujadas = 0;
    const cap = C.RENDER.PASTO_MEcido_CAP;
    const pal = paletaEstacion(estacion);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = U.rgba(pal.pastoClaro[0], pal.pastoClaro[1], pal.pastoClaro[2], 0.55);
    for (let ty = ty1; ty >= ty0 && dibujadas < cap; ty--) {
      for (let tx = tx0; tx <= tx1 && dibujadas < cap; tx++) {
        const i = mundo.idx(tx, ty);
        if (mundo.tipo[i] !== 0 || mundo.bio[i] < 0.5) continue;
        const h = U.ruido01(tx, ty, 91);
        if (h < 0.55) continue;
        const bx = tx * T + 5 + h * (T - 10);
        const by = ty * T + 6 + U.ruido01(tx, ty, 93) * (T - 10);
        const sway = Math.sin(tReal * 0.0016 + tx * 0.7 + ty * 0.4) * 2.4;
        ctx.beginPath();
        ctx.moveTo(bx, by + 5);
        ctx.quadraticCurveTo(bx + sway * 0.4, by + 1, bx + sway, by - 3);
        ctx.stroke();
        dibujadas++;
      }
    }
  }

  /* ---------------- Restos y comederos ------------------------------ */
  function dibujarRestos(mundo, e, tReal) {
    for (const r of mundo.restos) {
      const edad = e.ciclo - r.ciclo;
      if (edad > 3) continue;
      const alpha = 1 - edad / 3;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = '#d8d2c2';
      // pequeño esqueleto estilizado
      ctx.beginPath(); ctx.ellipse(0, 0, 6 + r.tam * 3, 3 + r.tam * 1.5, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b9b2a0'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(5, -2); ctx.moveTo(-4, -2); ctx.lineTo(4, 3); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function dibujarComederos(mundo, tReal) {
    for (const com of mundo.comederos) {
      ctx.save();
      ctx.translate(com.x, com.y);
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 8, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      // recipiente de madera
      ctx.fillStyle = '#8a6a48';
      ctx.beginPath();
      ctx.moveTo(-14, -4); ctx.lineTo(14, -4); ctx.lineTo(10, 7); ctx.lineTo(-10, 7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6d5236';
      ctx.fillRect(-14, -7, 28, 3.5);
      // raciones restantes
      const frac = U.clamp(com.raciones / C.BANCOS.COMEDERO_RACIONES, 0, 1);
      if (frac > 0) {
        ctx.fillStyle = '#c9a45a';
        const n = Math.max(1, Math.round(frac * 6));
        for (let k = 0; k < n; k++) {
          const a = k * 2.4;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 6 * frac, -8 + Math.sin(a) * 2, 2.2, 0, Math.PI * 2); ctx.fill();
        }
      }
      // letrero oscilante
      ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(19, -12 + Math.sin(tReal * 0.002) * 1.5); ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- Minimapa ---------------------------------------- */
  let miniBase = null;
  R.dibujarMinimapaBase = function (mundo) {
    if (!miniLienzo) return;
    miniBase = document.createElement('canvas');
    miniBase.width = mundo.W; miniBase.height = mundo.H;
    const g = miniBase.getContext('2d');
    for (let ty = 0; ty < mundo.H; ty++) for (let tx = 0; tx < mundo.W; tx++) {
      const i = mundo.idx(tx, ty);
      if (mundo.tipo[i] === 1) g.fillStyle = '#3d6f8a';
      else if (mundo.tipo[i] === 2) g.fillStyle = '#6f7378';
      else {
        const b = mundo.bio[i];
        g.fillStyle = b > 0.5 ? '#5d8a4a' : b > 0.2 ? '#77905a' : '#6d6a4e';
      }
      g.fillRect(tx, ty, 1, 1);
    }
  };
  function dibujarMinimapa(mundo, pob, e) {
    if (!miniCtx || !miniBase) return;
    const g = miniCtx;
    const w = miniLienzo.width, h = miniLienzo.height;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.drawImage(miniBase, 0, 0, w, h);
    const sx = w / mundo.Wpx, sy = h / mundo.Hpx;
    // criaturas
    for (const c of pob.lista) {
      if (!c.vivo) continue;
      g.fillStyle = c.fen.dieta === 'carnivoro' ? '#e8c37a' : '#d5ecd0';
      g.fillRect(c.x * sx - 1, c.y * sy - 1, 2.4, 2.4);
    }
    // cámara
    const vw = vista.w / e.camara.zoom * sx, vh = vista.h / e.camara.zoom * sy;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1.2;
    g.strokeRect(e.camara.x * sx - vw / 2, e.camara.y * sy - vh / 2, vw, vh);
  }

  /* ---------------- Fotografía -------------------------------------- */
  R.capturaFoto = function () {
    R.cuadro(performance.now());
    const temp = document.createElement('canvas');
    temp.width = C.FOTO.ANCHO; temp.height = C.FOTO.ANCHO * vista.h / vista.w;
    const g = temp.getContext('2d');
    g.drawImage(lienzo, 0, 0, temp.width, temp.height);
    return temp.toDataURL('image/jpeg', 0.72);
  };

  window.BIOS.Render = R;
})();
