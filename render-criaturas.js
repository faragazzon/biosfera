/* ============================================================
   BIOSFERA — render-criaturas.js (BIOS.Dibujante)
   Dibujo procedural y animado de las criaturas: cuerpo con
   proporciones del genoma, patrón, patas con ciclo de marcha,
   cabeza orientada, ojos que miran la meta, parpadeo, estados
   (comer, beber, dormir, cortejo, caza, congelarse) y retratos
   para las fichas del cuaderno.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;

  const D = {};

  function colorBase(c, l) { const col = c.fen.color; return U.hsl(col.h, col.s, l !== undefined ? l : col.l); }
  function colorOscuro(c) { const col = c.fen.color; return U.hsl(col.h, col.s + 8, Math.max(18, col.l - 18)); }
  function colorClaro(c) { const col = c.fen.color; return U.hsl(col.h, Math.max(10, col.s - 14), Math.min(94, col.l + 16)); }

  /* ---------------- Cuerpo principal -------------------------------- */
  D.criatura = function (ctx, c, op) {
    const t = op.tReal;
    const tam = c.tamVisual ? c.tamVisual() : c.tamActual(); // tamaño visual: crece de cría a adulto
    const R = (c.fen.dieta === 'carnivoro' ? 11 : 10) * tam;
    const col = c.fen.color;

    // sombra
    ctx.fillStyle = 'rgba(10,14,10,0.28)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + R * 0.55, R * 1.05, R * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(c.x, c.y);

    // selección: anillo pulsante
    if (op.seleccionada) {
      const pulso = 1 + Math.sin(t * 0.005) * 0.08;
      ctx.strokeStyle = 'rgba(232,195,122,0.95)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, R * 0.55, R * 1.5 * pulso, R * 0.62 * pulso, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // línea tenue al objetivo (modo investigación)
    if (op.objetivo && c.objetivo) {
      const d = c.objetivo;
      const dx = (d.ref && d.ref.vivo ? d.ref.x : d.x) - c.x;
      const dy = (d.ref && d.ref.vivo ? d.ref.y : d.y) - c.y;
      const len = Math.hypot(dx, dy);
      if (len > 18) {
        ctx.strokeStyle = 'rgba(232,195,122,0.28)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, dy); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // herida / integridad
    if (c.I < 0.7) {
      ctx.strokeStyle = 'rgba(190,90,70,' + (0.5 * (1 - c.I)) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.2, R * 0.22, 0, Math.PI * 2); ctx.stroke();
    }

    const moviendo = c.debeMoverse();
    const fase = c.anim.fase;
    const respiracion = 1 + Math.sin(t * 0.0026 + c.anim.fase) * 0.02;
    const bob = moviendo ? Math.abs(Math.sin(fase)) * R * 0.12 : 0;
    const accion = c.accion ? c.accion.tipo : null;
    const comiendo = accion === 'comer' || accion === 'carroñar';
    const bebiendo = accion === 'beber';
    const durmiendo = accion === 'dormir' || accion === 'descansar';
    const quieta = !!ACCION(c, accion);

    // Ciclo de bocado/lengüetazo (0..1), con fase propia de cada criatura [P]
    let fB = null;
    if (comiendo || bebiendo) {
      fB = ((t * (bebiendo ? 0.00135 : 0.00098)) + c.anim.fase * 0.37) % 1;
      if (c.anim.ultAccion !== accion) { c.anim.ultAccion = accion; c.anim.fB = undefined; }
    }
    const mordida = fB !== null ? curvaBocado(fB) : 0; // 0..1: cabeza hundida en la hierba/agua
    const masticar = comiendo && mordida > 0.2 ? Math.abs(Math.sin(fB * Math.PI * 4)) : 0;

    ctx.rotate(c.dir);
    ctx.translate(0, -bob + (durmiendo ? R * 0.16 : 0));
    if (comiendo) ctx.rotate(0.10 + mordida * 0.18); // se inclina hacia el pasto
    if (bebiendo) ctx.rotate(0.08 + mordida * 0.22 + Math.sin(fB * Math.PI * 2) * 0.025);

    const estirar = accion === 'cazar' || c.huyendo ? 1.14 : 1;
    const squash = respiracion * (comiendo ? 1 + masticar * 0.05 : 1);
    ctx.scale(estirar / squash, squash);

    // patas (4): ciclo de marcha
    dibujarPatas(ctx, c, R, moviendo, fase, durmiendo, t);

    // cola
    dibujarCola(ctx, c, R, t, moviendo);

    // cuerpo
    const grad = ctx.createLinearGradient(0, -R, 0, R);
    grad.addColorStop(0, colorClaro(c));
    grad.addColorStop(0.62, colorBase(c));
    grad.addColorStop(1, colorOscuro(c));
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (c.fen.dieta === 'carnivoro') {
      // silueta angular
      ctx.moveTo(-R * 1.05, 0);
      ctx.quadraticCurveTo(-R * 0.8, -R * 0.78, R * 0.15, -R * 0.6);
      ctx.quadraticCurveTo(R * 0.95, -R * 0.4, R * 1.02, 0);
      ctx.quadraticCurveTo(R * 0.95, R * 0.4, R * 0.15, R * 0.6);
      ctx.quadraticCurveTo(-R * 0.8, R * 0.78, -R * 1.05, 0);
    } else {
      ctx.ellipse(0, 0, R * 1.06, R * 0.78, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,26,18,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // patrón (manchas / franjas)
    dibujarPatron(ctx, c, R);

    ctx.restore();

    // cabeza (se dibuja sin rotación de squash, mirando a la meta; al comer/beber baja al suelo)
    dibujarCabeza(ctx, c, R, op, t, moviendo, durmiendo, { comiendo, bebiendo, mordida, masticar });

    // partículas de boca: migas al morder, ondas y gotas al lamer [P]
    if ((comiendo || bebiendo) && op.enVista && B.Efectos && c.anim.fB !== undefined && fB < c.anim.fB) {
      const px = c.x + Math.cos(c.dir) * R * 1.35;
      const py = c.y + Math.sin(c.dir) * R * 0.55 + R * 0.6;
      if (comiendo) {
        B.Efectos.emitir('miga', px, py);
        if (Math.random() < 0.6) B.Efectos.emitir('miga', px, py);
      } else {
        B.Efectos.emitir('onda', px, py);
        B.Efectos.emitir('gotita', px, py - R * 0.25);
      }
    }
    if (fB !== null) c.anim.fB = fB;

    // iconos de estado (modo investigación)
    if (op.investigacion) dibujarIconosInvestigacion(ctx, c, R, t);
    // zzz flotante al dormir
    if (durmiendo && accion === 'dormir') dibujarZzz(ctx, c, R, t);
    // corazoncitos de cortejo
    if (accion === 'ritual') dibujarCorazon(ctx, c, R, t);
    // nombre si seleccionada o zoom alto
    if (op.seleccionada || (op.zoom && op.zoom > 1.7)) {
      ctx.font = '600 ' + Math.max(10, 11 * Math.min(1.4, tam)) + 'px "Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(240,245,238,0.92)';
      ctx.strokeStyle = 'rgba(10,14,10,0.65)';
      ctx.lineWidth = 2.6;
      ctx.strokeText(c.nombre, c.x, c.y - R - 12);
      ctx.fillText(c.nombre, c.x, c.y - R - 12);
    }
  };

  function ACCION(c, a) { return a === 'congelarse' || a === 'esconder' || a === 'ritual' ? 1 : 0; }

  /* Ciclo de bocado: baja y muerde (0→0.62), mastica, sube y traga (0.62→1). */
  function curvaBocado(f) {
    return f < 0.62 ? Math.sin((f / 0.62) * Math.PI) : 0;
  }

  function dibujarPatas(ctx, c, R, moviendo, fase, durmiendo, t) {
    const n = c.fen.dieta === 'carnivoro' ? 2 : 4;
    ctx.strokeStyle = colorOscuro(c);
    ctx.lineWidth = Math.max(1.6, R * 0.16);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const off = n === 4 ? (i < 2 ? -R * 0.45 : R * 0.35) : -R * 0.3;
      const lado = n === 4 ? (i % 2 === 0 ? -1 : 1) : (i === 0 ? -1 : 1);
      const swing = moviendo ? Math.sin(fase + i * Math.PI / 2) * R * 0.34 : 0;
      const temblor = c.accion && c.accion.tipo === 'congelarse' ? Math.sin(t * 0.03 + i) * 0.7 : 0;
      const py = durmiendo ? R * 0.4 : R * 0.72;
      ctx.beginPath();
      ctx.moveTo(off + swing * 0.3, lado * R * 0.4);
      ctx.lineTo(off + swing + temblor, py * (lado === -1 ? 0.9 : 1));
      ctx.stroke();
    }
  }

  function dibujarCola(ctx, c, R, t, moviendo) {
    const wag = moviendo ? Math.sin(t * 0.02) * 0.35 : Math.sin(t * 0.003) * 0.12;
    ctx.save();
    ctx.translate(-R * 1.02, 0);
    ctx.rotate(wag);
    if (c.fen.dieta === 'carnivoro') {
      ctx.strokeStyle = colorOscuro(c);
      ctx.lineWidth = Math.max(1.4, R * 0.14);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-R * 0.4, -R * 0.25, -R * 0.55, -R * 0.05);
      ctx.stroke();
    } else {
      ctx.fillStyle = colorClaro(c);
      ctx.beginPath(); ctx.arc(-R * 0.22, 0, R * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function dibujarPatron(ctx, c, R) {
    if (c.fen.patron === 'manchas') {
      ctx.fillStyle = 'rgba(30,34,24,0.22)';
      const pts = [[-R * 0.4, -R * 0.22, R * 0.2], [R * 0.15, R * 0.18, R * 0.16], [-R * 0.05, R * 0.02, R * 0.13]];
      for (const [px, py, pr] of pts) {
        ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 0.8, 0.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (c.fen.patron === 'franjas') {
      ctx.strokeStyle = 'rgba(30,34,24,0.20)';
      ctx.lineWidth = Math.max(1.2, R * 0.1);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * R * 0.4, -R * 0.6);
        ctx.quadraticCurveTo(i * R * 0.4 + R * 0.12, 0, i * R * 0.4, R * 0.6);
        ctx.stroke();
      }
    }
  }

  function dibujarCabeza(ctx, c, R, op, t, moviendo, durmiendo, est) {
    est = est || {};
    const ang0 = anguloMirada(c);
    // cabeza proporcionalmente mayor en las crías, menguando al crecer [P]
    const fr = c.fracCrecimiento ? c.fracCrecimiento() : 1;
    const hr = R * (0.52 - 0.10 * Math.sqrt(fr));
    const dip = est.mordida || 0; // 0..1: inmersión de la cabeza al comer/beber

    let hx = c.x + Math.cos(ang0) * R * 0.95;
    let hy = c.y + Math.sin(ang0) * R * 0.95 - R * 0.18;
    let ang = ang0;
    if (dip > 0.001) {
      // punto de contacto (mata de pasto o lámina de agua) delante, a ras del suelo
      const px = c.x + Math.cos(c.dir) * R * 1.30;
      const py = c.y + Math.sin(c.dir) * R * 0.55 + R * 0.58;
      hx = U.mezcla(hx, px, dip * 0.85);
      hy = U.mezcla(hy, py, dip * 0.85);
      ang = Math.atan2(py - hy, px - hx);
    }

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);

    // orejas / cuernos
    if (c.fen.dieta === 'carnivoro') {
      ctx.fillStyle = colorOscuro(c);
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hr * 0.2, lado * hr * 0.75);
        ctx.lineTo(hr * 0.75, lado * hr * 1.5);
        ctx.lineTo(hr * 0.72, lado * hr * 0.5);
        ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = colorOscuro(c);
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(-hr * 0.35, lado * hr * 0.85, hr * 0.28, hr * 0.62, lado * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // cabeza
    const grad = ctx.createLinearGradient(0, -hr, 0, hr);
    grad.addColorStop(0, colorClaro(c));
    grad.addColorStop(1, colorBase(c));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, hr * 1.12, hr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,26,18,0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // hocico
    ctx.fillStyle = colorOscuro(c);
    ctx.beginPath();
    ctx.ellipse(hr * 0.85, 0, hr * 0.34, hr * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // mandíbula al masticar: abre y cierra con cada bocado [P]
    if (est.comiendo && dip > 0.25) {
      const abre = 0.12 + (est.masticar || 0) * 0.5;
      ctx.fillStyle = colorOscuro(c);
      ctx.save();
      ctx.translate(hr * 0.60, hr * 0.12);
      ctx.rotate(abre);
      ctx.beginPath();
      ctx.ellipse(hr * 0.28, 0, hr * 0.26, hr * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // lengüetazo al beber: lengua rosa que lamo la lámina de agua [P]
    if (est.bebiendo && dip > 0.30) {
      ctx.fillStyle = 'rgba(224,142,146,' + (0.55 + dip * 0.4) + ')';
      ctx.beginPath();
      ctx.ellipse(hr * 1.04 + dip * hr * 0.08, hr * 0.05, hr * 0.20 + dip * hr * 0.05, hr * 0.10, 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // ojos
    const parpadeo = (t * 0.001 + c.anim.parpadeo) % 4.2 < 0.14;
    if (durmiendo || parpadeo) {
      ctx.strokeStyle = 'rgba(25,30,22,0.85)';
      ctx.lineWidth = 1.4;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hr * 0.32, lado * hr * 0.42);
        ctx.lineTo(hr * 0.62, lado * hr * 0.4);
        ctx.stroke();
      }
    } else if (est.comiendo && dip > 0.45) {
      // ojos entornados de gusto mientras mastica
      ctx.strokeStyle = 'rgba(25,30,22,0.8)';
      ctx.lineWidth = 1.5;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(hr * 0.47, lado * hr * 0.40, hr * 0.15, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
      }
    } else {
      const ex = hr * 0.45;
      for (const lado of [-1, 1]) {
        ctx.fillStyle = '#f2f0e8';
        ctx.beginPath();
        ctx.ellipse(ex, lado * hr * 0.4, hr * 0.2, hr * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // pupila: mira levemente hacia delante
        ctx.fillStyle = '#1c211a';
        ctx.beginPath();
        ctx.arc(ex + hr * 0.07, lado * hr * 0.4, hr * 0.1, 0, Math.PI * 2);
        ctx.fill();
        // brillo
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(ex + hr * 0.03, lado * hr * 0.4 - hr * 0.05, hr * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function anguloMirada(c) {
    if (c.objetivo) {
      const d = c.objetivo;
      const tx = d.ref && d.ref.vivo ? d.ref.x : d.x;
      const ty = d.ref && d.ref.vivo ? d.ref.y : d.y;
      return Math.atan2(ty - c.y, tx - c.x);
    }
    return c.dir;
  }

  function dibujarIconosInvestigacion(ctx, c, R, t) {
    const y0 = c.y - R - 24;
    let x0 = c.x - 18;
    const iconos = [];
    if (c.fracB() < 0.35) iconos.push('#d98a7a');       // hambre: gota roja
    if (c.H < 0.35) iconos.push('#7ab8c9');              // sed: gota azul
    if (c.I < 0.5) iconos.push('#c9b45a');               // daño
    const sin = c.sindromeDominante();
    if (sin) iconos.push('#9d8ab8');
    for (let i = 0; i < iconos.length && i < 4; i++) {
      ctx.fillStyle = iconos[i];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      const bx = x0 + i * 11;
      const by = y0 + Math.sin(t * 0.004 + i) * 1.5;
      ctx.moveTo(bx, by - 4);
      ctx.quadraticCurveTo(bx + 4, by + 1, bx, by + 4);
      ctx.quadraticCurveTo(bx - 4, by + 1, bx, by - 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function dibujarZzz(ctx, c, R, t) {
    const f = (t * 0.0009) % 1;
    ctx.fillStyle = 'rgba(235,240,232,' + (0.8 * (1 - f)) + ')';
    ctx.font = '600 ' + (7 + f * 6) + 'px Georgia,serif';
    ctx.textAlign = 'center';
    ctx.fillText('z', c.x + R * 0.7 + f * 10, c.y - R - 8 - f * 16);
    ctx.fillText('z', c.x + R * 0.7 + f * 16 + 4, c.y - R - 18 - f * 20);
  }

  function dibujarCorazon(ctx, c, R, t) {
    const f = (t * 0.0014) % 1;
    ctx.fillStyle = 'rgba(226,120,130,' + (0.9 * (1 - f)) + ')';
    const x = c.x + Math.sin(t * 0.004) * 6;
    const y = c.y - R - 6 - f * 20;
    const s = 3.5 + f * 3;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.6);
    ctx.bezierCurveTo(x - s * 1.4, y - s * 0.6, x - s * 0.4, y - s * 1.4, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.4, y - s * 1.4, x + s * 1.4, y - s * 0.6, x, y + s * 0.6);
    ctx.fill();
  }

  /* ---------------- Retrato para la ficha --------------------------- */
  D.retrato = function (canvas, c, t) {
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    // fondo: degradado suave
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(38,48,38,0.9)');
    grad.addColorStop(1, 'rgba(22,28,22,0.9)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, h * i / 4); g.lineTo(w, h * i / 4); g.stroke(); }
    // sombra de suelo
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(w / 2, h * 0.78, w * 0.3, h * 0.08, 0, 0, Math.PI * 2); g.fill();
    // criatura en pose quieta, mirando al frente-izquierda
    const falsa = c;
    const dirOrig = falsa.dir;
    const xOrig = falsa.x, yOrig = falsa.y, objetivoOrig = falsa.objetivo, accionOrig = falsa.accion;
    falsa.dir = -0.3; falsa.x = 0; falsa.y = 0; falsa.objetivo = null; falsa.accion = null;
    g.save();
    g.translate(w / 2, h * 0.55);
    g.scale(w / 96 * 1.05, w / 96 * 1.05);
    D.criatura(g, falsa, { tReal: t || performance.now(), seleccionada: false, investigacion: false, zoom: 1 });
    g.restore();
    falsa.dir = dirOrig; falsa.x = xOrig; falsa.y = yOrig; falsa.objetivo = objetivoOrig; falsa.accion = accionOrig;
    // marco
    g.strokeStyle = 'rgba(232,195,122,0.35)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  };

  window.BIOS.Dibujante = D;
})();
