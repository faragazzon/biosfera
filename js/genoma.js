/* ============================================================
   BIOSFERA — genoma.js
   Genoma heredable con mutación y trade-offs, doctrina (memoria
   de zonas aprendida y heredable) y nombres procedurales.

   [D] Génes del GDD de BIOSFERA (doc. §6.2): metabolismo,
   eficiencia, apetito, velocidad, curiosidad, sentido, tamaño
   (≥ 1.4 = carnívoro) con trade-offs documentados.
   [D] Doctrina heredada por las crías (doc. §6.2: «genoma +
   doctrina en crías»).
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;

  const GENES = [
    { clave: 'metabolismo', min: 0.30, max: 0.90, etiqueta: 'Metabolismo', desc: 'Quema más presupuesto pero sostiene esfuerzos más intensos.' },
    { clave: 'eficiencia', min: 0.45, max: 0.95, etiqueta: 'Eficiencia', desc: 'Convierte alimento en energía útil con menos pérdidas.' },
    { clave: 'apetito', min: 0.20, max: 0.90, etiqueta: 'Apetito', desc: 'Empuja a comer antes de que la necesidad sea crítica.' },
    { clave: 'velocidad', min: 0.30, max: 0.95, etiqueta: 'Velocidad', desc: 'Rapidez de desplazamiento; coste de acción más alto.' },
    { clave: 'curiosidad', min: 0.10, max: 0.90, etiqueta: 'Curiosidad', desc: 'Impulso a explorar: descubre recursos, gasta energía.' },
    { clave: 'sentido', min: 0.30, max: 0.95, etiqueta: 'Sentido', desc: 'Radio de percepción de pasto, agua, presas y peligros.' },
    { clave: 'tam', min: 0.60, max: 1.80, etiqueta: 'Tamaño', desc: 'Cuerpo mayor: más reservas y fuerza; más coste existir. ≥ 1.4: carnívoro.' },
    { clave: 'robustez', min: 0.20, max: 0.90, etiqueta: 'Robustez', desc: 'Regeneración de integridad y tolerancia al daño.' },
  ];

  function aleatorio(rng) {
    const g = {};
    for (const ge of GENES) g[ge.clave] = +rng.rango(ge.min, ge.max).toFixed(3);
    g.albino = rng.azar(0.02);
    return g;
  }

  /* Mezcla sexual + mutación gaussiana (σ pequeño) + mutación rara. */
  function mezclar(a, b, rng) {
    const g = {};
    for (const ge of GENES) {
      const t = rng.siguiente();
      let v = a[ge.clave] + (b[ge.clave] - a[ge.clave]) * t;
      v += rng.gauss(0, 0.055);
      if (rng.azar(0.06)) v += rng.rango(-0.18, 0.18); // mutación saltacional
      g[ge.clave] = +U.clamp(v, ge.min, ge.max).toFixed(3);
    }
    g.albino = rng.azar(0.02);
    return g;
  }

  function distancia(a, b) {
    let s = 0;
    for (const ge of GENES) s += Math.abs(a[ge.clave] - b[ge.clave]);
    return s / GENES.length;
  }
  const compatibles = (a, b) => distancia(a, b) < 0.45;

  /* ---------------- Fenotipo ---------------------------------------- */
  function fenotipo(g) {
    const dieta = g.tam >= 1.4 ? 'carnivoro' : 'herbivoro';
    const vida = Math.round(C.CUERPO.VIDA_BASE * (1.7 - 0.9 * g.metabolismo));
    const velBase = 26 + 34 * g.velocidad; // px/s
    const h = U.hashEntero(Math.round(g.metabolismo * 1000), Math.round(g.curiosidad * 1000), Math.round(g.tam * 100)) % 1000;
    let hue, sat, luz;
    if (g.albino) { hue = 45; sat = 12; luz = 88; }
    else if (dieta === 'carnivoro') { hue = 14 + (h % 30); sat = 46 + (h % 18); luz = 46 + (h % 12); }
    else { hue = 76 + (h % 52); sat = 38 + (h % 24); luz = 44 + (h % 16); }
    const patron = (h % 3 === 0) ? 'manchas' : (h % 3 === 1) ? 'franjas' : 'liso';
    let adj;
    if (dieta === 'carnivoro') {
      adj = g.sentido > 0.75 ? 'sigiloso' : g.robustez > 0.7 ? 'tenaz' : g.velocidad > 0.72 ? 'impetuoso' : 'errante';
    } else {
      adj = g.velocidad > 0.75 ? 'veloz' : g.curiosidad > 0.7 ? 'curioso' : g.robustez > 0.7 ? 'resistente' : 'apacible';
    }
    const especie = (dieta === 'carnivoro' ? 'Cazador ' : 'Forrajero ') + adj;
    return { dieta, vida, velBase, color: { h: hue, s: sat, l: luz }, patron, especie };
  }

  /* ---------------- Nombres procedurales --------------------------- */
  const SILABAS = ['ba', 'la', 'mo', 'ri', 'ta', 'nu', 'se', 'vi', 'ko', 'pa', 'lu', 'fen', 'dra', 'mir', 'tol', 'yen', 'osa', 'cal', 'bri', 'nen', 'dor', 'sil', 'mar', 'pel'];
  function nombreAleatorio(rng, usados) {
    usados = usados || null;
    for (let intento = 0; intento < 30; intento++) {
      const n = rng.entero(2, 3);
      let s = '';
      for (let i = 0; i < n; i++) s += rng.elegir(SILABAS);
      s = s.charAt(0).toUpperCase() + s.slice(1);
      if (!usados || !usados.has(s)) return s;
    }
    return 'Nau' + Math.floor(rng.siguiente() * 900 + 100);
  }

  /* ================================================================
     DOCTRINA — memoria de zonas aprendida, heredable.
     [D] Doc. §6.2: las crías heredan «genoma + doctrina».
     [P] Implementación como mapa de valores por zona (pasto, agua,
     seguridad) sobre una rejilla gruesa de 6×6 tiles por zona.
     ================================================================ */
  class Doctrina {
    constructor(zw, zh, rng) {
      this.zw = zw; this.zh = zh;
      const n = zw * zh;
      this.pasto = new Float32Array(n);
      this.agua = new Float32Array(n);
      this.seguridad = new Float32Array(n);
      this.visitas = new Float32Array(n);
      if (rng) { // semilla inicial mínima: ignorancia casi total
        for (let i = 0; i < n; i++) this.visitas[i] = rng.azar(0.12) ? 1 : 0;
      }
    }
    static paraMundo() {
      return new Doctrina(Math.ceil(C.MUNDO.W / 6), Math.ceil(C.MUNDO.H / 6), null);
    }
    idx(zx, zy) { return U.clamp(zy, 0, this.zh - 1) * this.zw + U.clamp(zx, 0, this.zw - 1); }
    deTile(tx, ty) { return this.idx(Math.floor(tx / 6), Math.floor(ty / 6)); }
    valor(clave, tx, ty) { return this[clave][this.deTile(tx, ty)] || 0; }
    aprender(clave, tx, ty, valor, alfa) {
      const i = this.deTile(tx, ty);
      const v = this[clave];
      v[i] = U.clamp(v[i] + (valor - v[i]) * alfa, 0, 1);
      this.visitas[i] = Math.min(1, this.visitas[i] + 0.15);
    }
    marcarVisita(tx, ty) {
      const i = this.deTile(tx, ty);
      this.visitas[i] = Math.min(1, this.visitas[i] + 0.12);
    }
    /* Mejor zona conocida para una clave, ponderada por distancia. */
    mejorZona(clave, tx, ty) {
      const arr = this[clave];
      let mejor = -1, mejorP = -1, mzx = 0, mzy = 0;
      const zx = Math.floor(tx / 6), zy = Math.floor(ty / 6);
      for (let zy2 = 0; zy2 < this.zh; zy2++) {
        for (let zx2 = 0; zx2 < this.zw; zx2++) {
          const i = zy2 * this.zw + zx2;
          const d = Math.hypot(zx2 - zx, zy2 - zy);
          const p = arr[i] / (1 + d * 0.55);
          if (p > mejorP) { mejorP = p; mejor = i; mzx = zx2; mzy = zy2; }
        }
      }
      if (mejor < 0 || mejorP <= 0.02) return null;
      return { zx: mzx, zy: mzy, valor: arr[mejor], tx: Math.min(C.MUNDO.W - 1, mzx * 6 + 2), ty: Math.min(C.MUNDO.H - 1, mzy * 6 + 2) };
    }
    cobertura() {
      let v = 0;
      for (let i = 0; i < this.visitas.length; i++) v += this.visitas[i] > 0.2 ? 1 : 0;
      return v / this.visitas.length;
    }
    static mezclar(d1, d2, rng) {
      const d = new Doctrina(d1.zw, d1.zh, null);
      const ruido = 0.10;
      for (const clave of ['pasto', 'agua', 'seguridad', 'visitas']) {
        for (let i = 0; i < d[clave].length; i++) {
          const t = 0.5 + (rng.siguiente() - 0.5) * 0.4;
          let v = d1[clave][i] * t + d2[clave][i] * (1 - t);
          v += rng.gauss(0, ruido);
          d[clave][i] = U.clamp(v, 0, 1);
        }
      }
      return d;
    }
    serializar() {
      return {
        zw: this.zw, zh: this.zh,
        pasto: Array.from(this.pasto), agua: Array.from(this.agua),
        seguridad: Array.from(this.seguridad), visitas: Array.from(this.visitas),
      };
    }
    static deserializar(o) {
      const d = new Doctrina(o.zw, o.zh, null);
      d.pasto = Float32Array.from(o.pasto); d.agua = Float32Array.from(o.agua);
      d.seguridad = Float32Array.from(o.seguridad); d.visitas = Float32Array.from(o.visitas);
      return d;
    }
  }

  window.BIOS.Genoma = {
    GENES, aleatorio, mezclar, distancia, compatibles, fenotipo, nombreAleatorio, Doctrina,
  };
})();
