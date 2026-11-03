/* ============================================================
   BIOSFERA — mundo.js
   El terrario: generación de terreno con semilla, ecología
   (pasto, residuo, micelio), luz estacional de período 200,
   clima por cadenas de Markov y comederos del naturalista.

   [D] Pilares del GDD (doc. §6.2): «todo cuesta», «importar
   orden / exportar desorden» (los hongos reciclan el residuo en
   fertilidad), luz sinusoidal de período 200.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;
  const ECO = C.ECOLOGIA;

  const TIPO = { SUELO: 0, AGUA: 1, ROCA: 2 };

  class Mundo {
    constructor(semilla) {
      this.semilla = semilla >>> 0;
      this.rng = U.RNG(this.semilla ^ 0x9E3779B9);
      this.W = C.MUNDO.W; this.H = C.MUNDO.H; this.TILE = C.MUNDO.TILE;
      this.Wpx = this.W * this.TILE; this.Hpx = this.H * this.TILE;
      const n = this.W * this.H;
      this.tipo = new Uint8Array(n);
      this.fertil = new Float32Array(n);
      this.bio = new Float32Array(n);
      this.residuo = new Float32Array(n);
      this.hongos = new Float32Array(n);
      this.humedad = new Float32Array(n);
      this.distAgua = new Float32Array(n);
      this.restos = [];        // marcadores visuales de cuerpos {x, y, ciclo}
      this.comederos = [];     // {x, y, raciones}
      this.clima = { tipo: 'soleado', restante: 40 + this.rng.siguiente() * 60 };
      this.ecoAcum = 0; this.hongoAcum = 0;
      this.generar();
    }

    /* ---------------- Generación del terreno ------------------------ */
    generar() {
      const s = this.semilla;
      const W = this.W, H = this.H;
      // Umbral de agua adaptativo: garantiza lagos suficientes (2–10% del área)
      let umbral = 0.34;
      for (let intento = 0; intento < 12; intento++) {
        let agua = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const elev = U.fbm(x * 0.055, y * 0.055, s, 5);
          if (elev < umbral) agua++;
        }
        if (agua >= W * H * 0.025 && agua <= W * H * 0.11) break;
        umbral += agua < W * H * 0.025 ? -0.02 : 0.02;
      }
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const elev = U.fbm(x * 0.055, y * 0.055, s, 5);
          const borde = Math.min(x, y, W - 1 - x, H - 1 - y);
          if (elev < umbral && borde > 1) this.tipo[i] = TIPO.AGUA;
          else if (elev > 0.78 || borde === 0) this.tipo[i] = TIPO.ROCA;
          else this.tipo[i] = TIPO.SUELO;
          const fertR = U.fbm(x * 0.08 + 40, y * 0.08 + 40, s + 7, 4);
          this.fertil[i] = U.clamp(0.25 + (fertR - 0.35) * 1.4, 0.08, 1);
          this.bio[i] = this.tipo[i] === TIPO.SUELO ? U.clamp(this.fertil[i] * 0.85, 0.04, 0.9) : 0;
          this.residuo[i] = 0; this.hongos[i] = 0;
        }
      }
      this.calcularDistAgua();
      this.calcularIslas();
      const total = W * H;
      for (let i = 0; i < total; i++) {
        this.humedad[i] = U.clamp(1 - this.distAgua[i] / 7, 0.05, 1) * 0.85
          + U.ruido01(i % W, (i / W) | 0, s + 31) * 0.15;
      }
    }

    /* ---------------- Islas (conectividad) -------------------------- */
    /* Componentes conexos de suelo caminable (4-vecinos). Los nacimientos
       iniciales exigen una isla mínima (C.POB.MIN_ISLA): ninguna criatura
       fundadora debe quedar encarcelada en un islote de pocas celdas
        destinado a morir en pocos ciclos. No afecta a la ecología ni a la
        conducta: solo decide dónde se siembra la población inicial.
        [P] v1.2.1 */
    calcularIslas() {
      const W = this.W, H = this.H, n = W * H;
      this.idIsla = new Int32Array(n);   // 0 = agua/roca; k = componente
      this.tamIsla = new Int32Array(n);  // tamaño del componente (0 si no caminable)
      const pila = new Int32Array(n);
      let idc = 0;
      const tams = [0];
      for (let s = 0; s < n; s++) {
        if (this.tipo[s] !== TIPO.SUELO || this.idIsla[s] !== 0) continue;
        idc++;
        let cima = 0;
        pila[cima++] = s;
        this.idIsla[s] = idc;
        let tam = 0;
        while (cima > 0) {
          const i = pila[--cima];
          tam++;
          const x = i % W, y = (i / W) | 0;
          if (x > 0 && this.tipo[i - 1] === TIPO.SUELO && !this.idIsla[i - 1]) { this.idIsla[i - 1] = idc; pila[cima++] = i - 1; }
          if (x < W - 1 && this.tipo[i + 1] === TIPO.SUELO && !this.idIsla[i + 1]) { this.idIsla[i + 1] = idc; pila[cima++] = i + 1; }
          if (y > 0 && this.tipo[i - W] === TIPO.SUELO && !this.idIsla[i - W]) { this.idIsla[i - W] = idc; pila[cima++] = i - W; }
          if (y < H - 1 && this.tipo[i + W] === TIPO.SUELO && !this.idIsla[i + W]) { this.idIsla[i + W] = idc; pila[cima++] = i + W; }
        }
        tams[idc] = tam;
      }
      this.mayorIslaId = 0;
      for (let k = 1; k < tams.length; k++) if (tams[k] > tams[this.mayorIslaId]) this.mayorIslaId = k;
      for (let i = 0; i < n; i++) if (this.idIsla[i]) this.tamIsla[i] = tams[this.idIsla[i]];
    }
    islaDe(tx, ty) { return this.dentro(tx, ty) ? this.idIsla[this.idx(tx, ty)] : 0; }

    calcularDistAgua() {
      const W = this.W, H = this.H, n = W * H;
      this.distAgua.fill(99);
      const cola = [];
      for (let i = 0; i < n; i++) if (this.tipo[i] === TIPO.AGUA) { this.distAgua[i] = 0; cola.push(i); }
      let cabeza = 0;
      while (cabeza < cola.length) {
        const i = cola[cabeza++];
        const x = i % W, y = (i / W) | 0, d = this.distAgua[i];
        const vecinos = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
        for (const [vx, vy] of vecinos) {
          if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
          const j = vy * W + vx;
          if (this.distAgua[j] > d + 1) { this.distAgua[j] = d + 1; cola.push(j); }
        }
      }
    }

    /* ---------------- Índices y consultas --------------------------- */
    idx(tx, ty) { return ty * this.W + tx; }
    dentro(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H; }
    tileEn(xpx, ypx) {
      const tx = Math.floor(xpx / this.TILE), ty = Math.floor(ypx / this.TILE);
      if (!this.dentro(tx, ty)) return null;
      return { tx, ty, i: this.idx(tx, ty) };
    }
    esAgua(tx, ty) { return this.dentro(tx, ty) && this.tipo[this.idx(tx, ty)] === TIPO.AGUA; }
    esBloqueado(tx, ty) {
      if (!this.dentro(tx, ty)) return true;
      return this.tipo[this.idx(tx, ty)] !== TIPO.SUELO;
    }
    conAguaAdyacente(tx, ty) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (this.esAgua(tx + dx, ty + dy)) return true;
      }
      return false;
    }
    tileLibreCercano(xpx, ypx) {
      const t = this.tileEn(xpx, ypx);
      if (!t) return null;
      if (!this.esBloqueado(t.tx, t.ty)) return t;
      for (let r = 1; r <= 4; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (this.dentro(t.tx + dx, t.ty + dy) && !this.esBloqueado(t.tx + dx, t.ty + dy)) {
            return { tx: t.tx + dx, ty: t.ty + dy, i: this.idx(t.tx + dx, t.ty + dy) };
          }
        }
      }
      return null;
    }
    centroTile(tx, ty) { return { x: tx * this.TILE + this.TILE / 2, y: ty * this.TILE + this.TILE / 2 }; }

    /* ---------------- Luz y estaciones ------------------------------ */
    luzEstacional(ciclo) {
      const f = (ciclo % C.LUZ.PERIODO) / C.LUZ.PERIODO;
      const q = f * 4;
      const a = C.LUZ.ANCLAS;
      const i = Math.min(3, Math.floor(q));
      const j = (i + 1) % 4;
      const t = q - i;
      return U.interpCos(a[i], a[j], t);
    }
    estacion(ciclo) { return U.estacionDeCiclo(ciclo); }
    faseDia(tCicloMs) {
      const f = U.clamp(tCicloMs / C.TIEMPO.CICLO_MS, 0, 1);
      if (f < 0.10) return { f, D: U.interpCos(0.10, 1, f / 0.10), nombre: 'Amanecer' };
      if (f < 0.62) return { f, D: 1, nombre: 'Día' };
      if (f < 0.74) return { f, D: U.interpCos(1, 0.06, (f - 0.62) / 0.12), nombre: 'Atardecer' };
      return { f, D: 0.06, nombre: 'Noche' };
    }
    luzTotal(ciclo, tCicloMs) {
      const est = this.luzEstacional(ciclo);
      const dia = this.faseDia(tCicloMs);
      return { luz: est * Math.max(dia.D, 0.12), D: dia.D, faseDia: dia.nombre, f: dia.f, estacional: est };
    }

    /* ---------------- Clima (cadena de Markov) ---------------------- */
    pasoClima(dtS, estacion) {
      this.clima.restante -= dtS;
      if (this.clima.restante <= 0) {
        const r = this.rng.siguiente();
        let siguienteTipo;
        if (estacion === 'Invierno') siguienteTipo = r < 0.5 ? 'nevada' : r < 0.8 ? 'nublado' : 'soleado';
        else if (estacion === 'Primavera') siguienteTipo = r < 0.45 ? 'soleado' : r < 0.75 ? 'nublado' : 'lluvia';
        else if (estacion === 'Verano') siguienteTipo = r < 0.65 ? 'soleado' : r < 0.85 ? 'nublado' : 'lluvia';
        else siguienteTipo = r < 0.4 ? 'nublado' : r < 0.65 ? 'lluvia' : 'soleado';
        this.clima.tipo = siguienteTipo;
        this.clima.restante = 30 + this.rng.siguiente() * 80;
        U.bus.emitir('mundo:clima', { tipo: siguienteTipo });
      }
    }

    /* ---------------- Paso ecológico -------------------------------- */
    paso(dtS, ciclo, tCicloMs) {
      const info = this.luzTotal(ciclo, tCicloMs);
      this.pasoClima(dtS, this.estacion(ciclo));
      this.ecoAcum += dtS;
      if (this.ecoAcum >= 0.5) {
        const dts = this.ecoAcum; this.ecoAcum = 0;
        this.pasoCrecimiento(dts, info);
      }
      this.hongoAcum += dtS;
      if (this.hongoAcum >= 2) {
        const dts = this.hongoAcum; this.hongoAcum = 0;
        this.pasoHongos(dts);
      }
      return info;
    }

    pasoCrecimiento(dts, info) {
      const W = this.W, H = this.H;
      const lluvia = this.clima.tipo === 'lluvia' ? 1 : 0;
      const nevada = this.clima.tipo === 'nevada' ? 1 : 0;
      const luzC = info.luz;
      for (let i = 0; i < W * H; i++) {
        if (this.tipo[i] !== TIPO.SUELO) continue;
        // humedad: se difunde hacia la base por cercanía al agua y lluvia
        let hum = this.humedad[i];
        hum += (U.clamp(1 - this.distAgua[i] / 7, 0.05, 1) * 0.85 - hum) * 0.02;
        if (lluvia) hum += ECO.HUMEDAD_LLUVIA * dts;
        hum -= ECO.HUMEDAD_CAIDA * dts;
        this.humedad[i] = U.clamp(hum, 0.03, 1);
        // pasto: crecimiento limitado por luz, fertilidad, humedad y espacio
        const espacio = 1 - this.bio[i];
        let tasa = ECO.CRECE_PASTO * luzC * this.fertil[i] * this.humedad[i] * espacio;
        if (lluvia) tasa *= 1.3;
        if (nevada) tasa *= 0.45;
        this.bio[i] = U.clamp(this.bio[i] + tasa * dts, 0, 1);
        if (this.residuo[i] > 0) this.residuo[i] = Math.max(0, this.residuo[i] - ECO.RESIDUO_CAIDA * dts);
      }
    }

    pasoHongos(dts) {
      // Los hongos crecen sobre residuo y lo convierten en fertilidad:
      // «importar orden, exportar desorden» — el orden vuelve por el micelio.
      const W = this.W, H = this.H;
      for (let i = 0; i < W * H; i++) {
        if (this.tipo[i] !== TIPO.SUELO) continue;
        if (this.residuo[i] > 0.04 && this.humedad[i] > 0.15) {
          this.hongos[i] = U.clamp(this.hongos[i] + ECO.HONGOS_CRECE * dts * (0.4 + this.residuo[i]), 0, 1);
          const conv = Math.min(this.residuo[i], ECO.HONGOS_TASA * this.hongos[i] * dts);
          this.residuo[i] -= conv;
          this.fertil[i] = U.clamp(this.fertil[i] + conv * 0.55, 0, 1);
          if (this.residuo[i] <= 0.001) this.hongos[i] *= 0.985;
        } else if (this.hongos[i] > 0) {
          this.hongos[i] = Math.max(0, this.hongos[i] - 0.004 * dts);
        }
      }
    }

    /* ---------------- Mutaciones por herramientas ------------------- */
    comerBio(tx, ty, cant) {
      if (!this.dentro(tx, ty)) return 0;
      const i = this.idx(tx, ty);
      const real = Math.min(this.bio[i], cant);
      this.bio[i] -= real;
      return real;
    }
    depositarRestos(xpx, ypx, tam, ciclo) {
      const t = this.tileEn(xpx, ypx);
      if (!t) return;
      const i = t.i;
      this.residuo[i] = U.clamp(this.residuo[i] + 0.28 + 0.22 * tam, 0, 1.4);
      this.bio[i] = U.clamp(this.bio[i] + 0.06, 0, 1);
      this.restos.push({ x: xpx, y: ypx, ciclo, tam });
      if (this.restos.length > 60) this.restos.shift();
    }
    sembrar(tx, ty) {
      if (!this.dentro(tx, ty)) return false;
      const i = this.idx(tx, ty);
      if (this.tipo[i] !== TIPO.SUELO) return false;
      this.bio[i] = U.clamp(this.bio[i] + 0.55, 0, 1);
      this.humedad[i] = U.clamp(this.humedad[i] + 0.1, 0, 1);
      return true;
    }
    regar(tx, ty) {
      if (!this.dentro(tx, ty)) return false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!this.dentro(tx + dx, ty + dy)) continue;
        const i = this.idx(tx + dx, ty + dy);
        if (this.tipo[i] !== TIPO.SUELO) continue;
        const d = Math.hypot(dx, dy);
        this.humedad[i] = U.clamp(this.humedad[i] + 0.45 * (1 - d / 2.6), 0, 1);
      }
      return true;
    }
    inocular(tx, ty) {
      if (!this.dentro(tx, ty)) return false;
      const i = this.idx(tx, ty);
      if (this.tipo[i] !== TIPO.SUELO || this.residuo[i] < 0.05) return false;
      this.hongos[i] = U.clamp(this.hongos[i] + 0.75, 0, 1);
      return true;
    }
    colocarComedero(xpx, ypx) {
      const t = this.tileLibreCercano(xpx, ypx);
      if (!t) return false;
      const c = this.centroTile(t.tx, t.ty);
      this.comederos.push({ x: c.x, y: c.y, raciones: C.BANCOS.COMEDERO_RACIONES });
      return true;
    }
    comederosCercanos(xpx, ypx, radioPx) {
      const res = [];
      for (const com of this.comederos) {
        if (com.raciones > 0 && U.dist(xpx, ypx, com.x, com.y) <= radioPx) res.push(com);
      }
      return res;
    }
    comerDeComedero(com, cant) {
      const real = Math.min(com.raciones, cant);
      com.raciones -= real;
      return real;
    }

    /* ---------------- Estadísticas ---------------------------------- */
    biomasaMedia() {
      let s = 0, n = 0;
      for (let i = 0; i < this.bio.length; i++) if (this.tipo[i] === TIPO.SUELO) { s += this.bio[i]; n++; }
      return n ? s / n : 0;
    }
    residuoTotal() {
      let s = 0;
      for (let i = 0; i < this.residuo.length; i++) s += this.residuo[i];
      return s;
    }
    fertilidadMedia() {
      let s = 0, n = 0;
      for (let i = 0; i < this.fertil.length; i++) if (this.tipo[i] === TIPO.SUELO) { s += this.fertil[i]; n++; }
      return n ? s / n : 0;
    }

    /* ---------------- Serialización --------------------------------- */
    serializar() {
      const r2 = (a) => Array.from(a, (v) => Math.round(v * 100) / 100);
      return {
        semilla: this.semilla,
        tipo: Array.from(this.tipo),
        fertil: r2(this.fertil), bio: r2(this.bio),
        residuo: r2(this.residuo), hongos: r2(this.hongos), humedad: r2(this.humedad),
        restos: this.restos.slice(-40),
        comederos: this.comederos.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), raciones: c.raciones })),
        clima: { tipo: this.clima.tipo, restante: Math.round(this.clima.restante) },
      };
    }
    static deserializar(o) {
      const m = new Mundo(o.semilla);
      m.tipo = Uint8Array.from(o.tipo);
      m.fertil = Float32Array.from(o.fertil);
      m.bio = Float32Array.from(o.bio);
      m.residuo = Float32Array.from(o.residuo);
      m.hongos = Float32Array.from(o.hongos);
      m.humedad = Float32Array.from(o.humedad);
      m.restos = o.restos || [];
      m.comederos = o.comederos || [];
      m.clima = o.clima || { tipo: 'soleado', restante: 60 };
      m.calcularDistAgua();
      m.calcularIslas();   // el terreno restaurado puede editar el jugador
      return m;
    }
  }

  Mundo.TIPO = TIPO;
  window.BIOS.Mundo = Mundo;
})();
