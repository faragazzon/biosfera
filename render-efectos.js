/* ============================================================
   BIOSFERA — render-efectos.js (BIOS.Efectos)
   Partículas de mundo (polen, esporas, luciérnagas, polvo,
   corazones, ondas, brillos), iluminación día/noche con tinte
   estacional y clima en pantalla (lluvia, nieve, hojas).
   Todo procedural: sin assets externos.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;

  const E = {};
  let particulas = [];

  /* ---------------- Emisión por eventos ----------------------------- */
  E.emitir = function (tipo, x, y) {
    if (particulas.length > C.RENDER.PARTICULAS_CAP) return;
    switch (tipo) {
      case 'polvo':
        particulas.push({ t: 'polvo', x, y, vx: U.rango(-6, 6), vy: U.rango(-8, -2), vida: 0.6, vm: 0.6, r: U.rango(1.5, 3) });
        break;
      case 'hojita':
        particulas.push({ t: 'hojita', x: x + U.rango(-6, 6), y: y - 4, vx: U.rango(-5, 5), vy: U.rango(-8, -3), vida: 0.9, vm: 0.9, r: 2.2, rot: U.rango(0, 6) });
        break;
      case 'brillo':
        particulas.push({ t: 'brillo', x, y, vx: U.rango(-8, 8), vy: U.rango(-16, -5), vida: 0.8, vm: 0.8, r: 2 });
        break;
      case 'miga':   // migas saltan al morder
        particulas.push({ t: 'miga', x: x + U.rango(-3, 3), y: y + U.rango(-2, 2), vx: U.rango(-16, 16), vy: U.rango(-30, -10), vida: 0.55, vm: 0.55, r: U.rango(1, 2), rot: U.rango(0, 6) });
        break;
      case 'gotita': // gota que salta al lamer el agua
        particulas.push({ t: 'gotita', x: x + U.rango(-2, 2), y, vx: U.rango(-7, 7), vy: U.rango(-34, -18), vida: 0.5, vm: 0.5, r: U.rango(1.2, 1.9) });
        break;
      case 'onda':
        particulas.push({ t: 'onda', x, y, vida: 1.0, vm: 1.0, r: 4 });
        break;
      case 'corazon':
        particulas.push({ t: 'corazon', x, y, vx: U.rango(-4, 4), vy: -14, vida: 1.2, vm: 1.2, r: U.rango(3, 4.5) });
        break;
      case 'nacimiento':
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          particulas.push({ t: 'brillo', x, y, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, vida: 0.8, vm: 0.8, r: 2.2 });
        }
        break;
      case 'disolucion':
        for (let i = 0; i < 18; i++) {
          particulas.push({ t: 'esporaN', x: x + U.rango(-8, 8), y: y + U.rango(-6, 6), vx: U.rango(-3, 3), vy: U.rango(-16, -7), vida: 2.2, vm: 2.2, r: U.rango(1.2, 2.4) });
        }
        break;
      case 'sindrome':
        particulas.push({ t: 'aura', x, y, vida: 1.6, vm: 1.6, r: 26 });
        break;
    }
  };

  /* ---------------- Ambiente continuo ------------------------------- */
  let acumAmbiente = 0;
  function ambiente(dt, vista, mundo, info, estacion, zona) {
    acumAmbiente += dt;
    if (acumAmbiente < 0.09) return;
    acumAmbiente = 0;
    if (particulas.length > C.RENDER.PARTICULAS_CAP * 0.8) return;
    // Polen de día (primavera/verano)
    if (info.D > 0.5 && (estacion === 'Primavera' || estacion === 'Verano') && Math.random() < 0.5) {
      particulas.push({
        t: 'polen', x: zona.tx0 * mundo.TILE + Math.random() * (zona.tx1 - zona.tx0) * mundo.TILE,
        y: zona.ty0 * mundo.TILE + Math.random() * (zona.ty1 - zona.ty0) * mundo.TILE,
        vx: U.rango(2, 9), vy: U.rango(-3, 1), vida: 4, vm: 4, r: U.rango(1, 2),
      });
    }
    // Luciérnagas de noche en verano
    if (info.D < 0.3 && estacion === 'Verano' && Math.random() < 0.42) {
      particulas.push({
        t: 'luci', x: zona.tx0 * mundo.TILE + Math.random() * (zona.tx1 - zona.tx0) * mundo.TILE,
        y: zona.ty0 * mundo.TILE + Math.random() * (zona.ty1 - zona.ty0) * mundo.TILE,
        vx: U.rango(-6, 6), vy: U.rango(-5, 3), vida: 5, vm: 5, r: 1.6, fase: Math.random() * 10,
      });
    }
    // Esporas sobre micelio (visibles de noche con brillo)
    if (Math.random() < 0.3) {
      const tx = zona.tx0 + Math.floor(Math.random() * (zona.tx1 - zona.tx0 + 1));
      const ty = zona.ty0 + Math.floor(Math.random() * (zona.ty1 - zona.ty0 + 1));
      if (mundo.dentro(tx, ty) && mundo.hongos[mundo.idx(tx, ty)] > 0.3) {
        const c = mundo.centroTile(tx, ty);
        particulas.push({ t: 'espora', x: c.x, y: c.y, vx: U.rango(-2, 2), vy: U.rango(-4, -1), vida: 3, vm: 3, r: 1.4 });
      }
    }
    // Hojas en otoño
    if (estacion === 'Otoño' && Math.random() < 0.35) {
      particulas.push({
        t: 'hoja', x: zona.tx0 * mundo.TILE + Math.random() * (zona.tx1 - zona.tx0) * mundo.TILE,
        y: zona.ty0 * mundo.TILE - 10, vx: U.rango(-8, 2), vy: U.rango(6, 14), vida: 6, vm: 6, r: U.rango(2.5, 4), rot: Math.random() * 6, vr: U.rango(-2, 2),
      });
    }
  }

  /* ---------------- Paso de partículas de mundo ---------------------- */
  E.pasoMundo = function (ctx, e, mundo, info, tReal, zona) {
    const dt = Math.min(0.05, (tReal - (E._ult || tReal)) / 1000) || 0.016;
    E._ult = tReal;
    ambiente(dt, null, mundo, info, mundo.estacion(e.ciclo), zona);

    // glows aditivos: esporas y luciérnagas
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      const f = p.vida / p.vm;
      switch (p.t) {
        case 'polen':
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx += Math.sin(tReal * 0.001 + p.y * 0.05) * 0.6 * dt * 10;
          ctx.fillStyle = 'rgba(240,235,190,' + (0.35 * f) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          break;
        case 'espora':
        case 'esporaN':
          p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.fillStyle = 'rgba(150,235,190,' + (0.5 * f) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          break;
        case 'luci': {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx += Math.sin(tReal * 0.003 + p.fase) * 8 * dt;
          p.vy += Math.cos(tReal * 0.0024 + p.fase) * 6 * dt;
          const brillo = 0.4 + Math.abs(Math.sin(tReal * 0.0012 + p.fase)) * 0.6;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
          g.addColorStop(0, 'rgba(235,255,170,' + (0.9 * brillo * f) + ')');
          g.addColorStop(1, 'rgba(235,255,170,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'brillo':
          p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
          ctx.fillStyle = 'rgba(255,240,200,' + (0.7 * f) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          break;
      }
    }
    ctx.restore();

    // partículas normales (no aditivas)
    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      if (p.t === 'polen' || p.t === 'espora' || p.t === 'esporaN' || p.t === 'luci' || p.t === 'brillo') continue;
      const f = p.vida / p.vm;
      switch (p.t) {
        case 'polvo':
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 10 * dt;
          ctx.fillStyle = 'rgba(160,150,125,' + (0.4 * f) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + (1 - f)), 0, Math.PI * 2); ctx.fill();
          break;
        case 'hojita':
          p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.fillStyle = 'rgba(140,170,90,' + (0.8 * f) + ')';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, p.rot, 0, Math.PI * 2); ctx.fill();
          break;
        case 'hoja':
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 1) * dt;
          p.vx += Math.sin(tReal * 0.002 + p.rot) * 6 * dt;
          ctx.fillStyle = 'rgba(196,140,72,' + (0.85 * f) + ')';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.rot, 0, Math.PI * 2); ctx.fill();
          break;
        case 'miga':
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 95 * dt; p.rot += 6 * dt;
          ctx.fillStyle = 'rgba(146,178,96,' + (0.9 * f) + ')';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, p.rot, 0, Math.PI * 2); ctx.fill();
          break;
        case 'gotita':
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 170 * dt;
          ctx.fillStyle = 'rgba(148,198,235,' + (0.9 * f) + ')';
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 0.75, p.r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 'onda':
          p.r += 26 * dt;
          ctx.strokeStyle = 'rgba(220,240,250,' + (0.5 * f) + ')';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'corazon':
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 4 * dt;
          ctx.fillStyle = 'rgba(226,120,130,' + (0.9 * f) + ')';
          const s = p.r * f + 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + s * 0.6);
          ctx.bezierCurveTo(p.x - s * 1.4, p.y - s * 0.6, p.x - s * 0.4, p.y - s * 1.4, p.x, p.y - s * 0.4);
          ctx.bezierCurveTo(p.x + s * 0.4, p.y - s * 1.4, p.x + s * 1.4, p.y - s * 0.6, p.x, p.y + s * 0.6);
          ctx.fill();
          break;
        case 'aura':
          p.r += 18 * dt;
          ctx.strokeStyle = 'rgba(157,138,184,' + (0.4 * f) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
          break;
      }
    }
  };

  /* ---------------- Iluminación global ------------------------------- */
  E.iluminacion = function (ctx, vista, info, estacion, tReal) {
    const D = info.D;
    // Multiplicativo: oscurece de noche con matiz azulado
    const osc = 1 - D; // 0 de día, ~0.94 de noche
    const r = Math.round(255 - 150 * Math.pow(osc, 1.2));
    const g = Math.round(252 - 145 * Math.pow(osc, 1.15));
    const b = Math.round(245 - 95 * Math.pow(osc, 1.3));
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, vista.w, vista.h);
    ctx.globalCompositeOperation = 'source-over';
    // Amanecer/atardecer: baño cálido
    const calido = Math.max(0, 1 - Math.abs(D - 0.55) * 3.2) * 0.16;
    if (calido > 0.01) {
      ctx.fillStyle = 'rgba(255,138,60,' + calido + ')';
      ctx.fillRect(0, 0, vista.w, vista.h);
    }
    // Tinte estacional sutil
    const tintes = { Primavera: 'rgba(200,255,205,0.045)', Verano: 'rgba(255,240,190,0.05)', Otoño: 'rgba(255,205,140,0.07)', Invierno: 'rgba(205,222,255,0.09)' };
    ctx.fillStyle = tintes[estacion] || 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, vista.w, vista.h);
    // Mancha de sol que recorre el terrario (luz a través del cristal)
    if (D > 0.25) {
      const fx = (0.3 + 0.4 * info.f) * vista.w;
      const fy = (0.25 + 0.1 * Math.sin(info.f * Math.PI)) * vista.h;
      ctx.globalCompositeOperation = 'lighter';
      const g2 = ctx.createRadialGradient(fx, fy, 0, fx, fy, vista.w * 0.42);
      g2.addColorStop(0, 'rgba(255,244,210,' + (0.10 * D) + ')');
      g2.addColorStop(1, 'rgba(255,244,210,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, vista.w, vista.h);
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  /* ---------------- Clima en pantalla -------------------------------- */
  let gotas = [], copos = [];
  E.climaPantalla = function (ctx, vista, tipo, tReal, estacion, info) {
    const lluvia = tipo === 'lluvia', nieve = tipo === 'nevada';
    if (lluvia) {
      while (gotas.length < 130) gotas.push({ x: Math.random() * vista.w, y: Math.random() * vista.h, v: 620 + Math.random() * 320 });
      ctx.strokeStyle = 'rgba(180,205,225,0.36)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const p of gotas) {
        p.y += p.v * 0.016; p.x += 90 * 0.016;
        if (p.y > vista.h) { p.y = -12; p.x = Math.random() * vista.w; }
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 3, p.y - 13);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,60,80,0.10)';
      ctx.fillRect(0, 0, vista.w, vista.h);
    } else gotas.length = 0;
    if (nieve) {
      while (copos.length < 120) copos.push({ x: Math.random() * vista.w, y: Math.random() * vista.h, v: 26 + Math.random() * 40, f: Math.random() * 10, r: 1 + Math.random() * 2.2 });
      ctx.fillStyle = 'rgba(240,245,250,0.8)';
      for (const p of copos) {
        p.y += p.v * 0.016;
        p.x += Math.sin(tReal * 0.001 + p.f) * 0.5;
        if (p.y > vista.h) { p.y = -6; p.x = Math.random() * vista.w; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(200,220,255,0.07)';
      ctx.fillRect(0, 0, vista.w, vista.h);
    } else copos.length = 0;
    if (tipo === 'nublado') {
      ctx.fillStyle = 'rgba(60,70,80,0.10)';
      ctx.fillRect(0, 0, vista.w, vista.h);
    }
  };

  window.BIOS.Efectos = E;
})();
