/* ============================================================
   BIOSFERA — util.js
   Utilidades: RNG determinista (mulberry32), ruido de valor/fBm,
   matemáticas auxiliares, formateo y bus de eventos.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;

  let _uid = 0;

  /* Generador determinista con semilla (mundo reproducible). */
  function RNG(semilla) {
    let a = (semilla >>> 0) || 1;
    const siguiente = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      siguiente,
      rango(min, max) { return min + siguiente() * (max - min); },
      entero(min, max) { return Math.floor(min + siguiente() * (max - min + 1)); },
      elegir(arr) { return arr[Math.floor(siguiente() * arr.length)]; },
      azar(p) { return siguiente() < p; },
      gauss(mu, sigma) {
        const u = Math.max(1e-9, siguiente()), v = siguiente();
        return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
    };
  }

  function hashEntero(x, y, s) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 974634321)) | 0;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177) | 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  const ruido01 = (x, y, s) => hashEntero(x, y, s) / 4294967295;
  const suavizado = (t) => t * t * (3 - 2 * t);

  function ruido2(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = suavizado(x - ix), fy = suavizado(y - iy);
    const a = ruido01(ix, iy, s), b = ruido01(ix + 1, iy, s);
    const c = ruido01(ix, iy + 1, s), d = ruido01(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function fbm(x, y, s, oct) {
    oct = oct || 4;
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) {
      v += amp * ruido2(x * f, y * f, s + i * 101);
      tot += amp; amp *= 0.5; f *= 2;
    }
    return v / tot;
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rango = (a, b) => a + Math.random() * (b - a);
  const mezcla = (a, b, t) => a + (b - a) * t;
  const interpCos = (a, b, t) => a + (b - a) * (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };

  function copiar(ob) {
    try { return structuredClone(ob); }
    catch (e) { return JSON.parse(JSON.stringify(ob)); }
  }

  /* ---------------- Bus de eventos (desacople módulo a módulo) ------- */
  class EventBus {
    constructor() { this._m = Object.create(null); }
    on(ev, fn) {
      (this._m[ev] || (this._m[ev] = [])).push(fn);
      const off = () => this.apagar(ev, fn);
      return off;
    }
    apagar(ev, fn) {
      const l = this._m[ev];
      if (!l) return;
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    }
    emitir(ev, dato) {
      const l = this._m[ev];
      if (!l) return;
      for (const fn of l.slice()) {
        try { fn(dato); }
        catch (e) { console.error('[bus:' + ev + ']', e); }
      }
    }
  }
  const bus = new EventBus();

  /* ---------------- Formateo ---------------------------------------- */
  const ESTACIONES = ['Primavera', 'Verano', 'Otoño', 'Invierno'];
  const estacionDeCiclo = (ciclo) => ESTACIONES[Math.floor((ciclo % 200) / 50)];
  const textoCiclo = (ciclo) => 'Ciclo ' + ciclo;

  function textoEdad(ciclos) {
    if (ciclos < 1) return 'recién nacida';
    if (ciclos < 16) return 'cría (' + ciclos + ' ciclos)';
    return ciclos + ' ciclos';
  }

  function textoHora(tCicloMs, cicloMs) {
    const f = clamp(tCicloMs / cicloMs, 0, 0.9999);
    const horas = Math.floor(f * 24), mins = Math.floor((f * 24 - horas) * 60);
    return String(horas).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  }

  const uid = (p) => (p || 'e') + '_' + (++_uid).toString(36) + '_' + Math.floor(Math.random() * 46656).toString(36);

  function escapar(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* Colores auxiliares */
  const hsl = (h, s, l, a) => 'hsl(' + Math.round(h) + ' ' + Math.round(s) + '% ' + Math.round(l) + '%' + (a !== undefined ? ' / ' + a : '') + ')';
  const rgba = (r, g, b, a) => 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  B.Util = {
    RNG, hashEntero, ruido01, ruido2, fbm, suavizado,
    clamp, rango, mezcla, interpCos, dist, dist2, copiar,
    bus, uid, escapar,
    ESTACIONES, estacionDeCiclo, textoCiclo, textoEdad, textoHora,
    hsl, rgba,
  };
})();
