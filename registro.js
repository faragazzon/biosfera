/* ============================================================
   BIOSFERA — registro.js
   El registro de campo: la progresión documental del naturalista.
   Fichas vivas y congeladas, hitos, crónica, series históricas,
   predicciones P-B1..P-B4 y fotografías.

   [D] Pilar 5 del GDD: la progresión es documental, sin puntuación.
   [D] Predicciones P-B1..P-B4 del GDD como hipótesis de investigación
        con estado vivo en el cuaderno.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;

  class Registro {
    constructor() {
      this.fichas = new Map();      // id → ficha (viva leída en vivo; congelada almacenada)
      this.cronica = [];
      this.historia = [];           // serie por ciclo: {ciclo, herb, carn, bio, luz}
      this.hitos = new Set();
      this.fotos = [];
      this.notas = [];
      this.predicciones = { vinculo: 0, vetos: 0, boomBust: { picos: 0, valles: 0, eventos: [] }, colapso: null };
      this.fichasAbiertas = 0;
      this.hongosReciclados = 0;
    }

    /* ---------------- Fichas ----------------------------------------- */
    crearFicha(c) {
      if (this.fichas.has(c.id)) return;
      this.fichas.set(c.id, { viva: true, id: c.id });
      this.cronicaAdd('nace', 'Nace ' + c.nombre + ' (' + c.fen.especie + ').', c.cicloNac);
    }
    congelarFicha(c, causa) {
      const f = this.fichas.get(c.id) || { viva: true, id: c.id };
      f.viva = false;
      f.nombre = c.nombre;
      f.especie = c.fen.especie;
      f.dieta = c.fen.dieta;
      f.genoma = U.copiar(c.genoma);
      f.fenotipo = U.copiar(c.fen);
      f.cicloNac = c.cicloNac; f.cicloMue = c.cicloMue;
      f.causa = causa;
      f.crias = c.crias.length;
      f.cazas = c.cazas;
      f.agencia = c.agencia();
      f.bio = c.bio.slice(-16);
      f.sindromeFinal = c.sindromeDominante();
      this.fichas.set(c.id, f);
      this.cronicaAdd('muere', 'Muere ' + c.nombre + ' por ' + causa + '. Legado: ' + (c.crias.length || 'sin') + ' cría(s).', c.cicloMue);
    }
    fichasListado() {
      const vivas = [], congeladas = [];
      for (const f of this.fichas.values()) (f.viva ? vivas : congeladas).push(f);
      return { vivas, congeladas };
    }

    /* ---------------- Crónica ---------------------------------------- */
    cronicaAdd(tipo, texto, ciclo) {
      this.cronica.push({ tipo, texto, ciclo: ciclo !== undefined ? ciclo : this.cicloVivo() });
      if (this.cronica.length > 600) this.cronica.splice(0, this.cronica.length - 600);
    }
    cicloVivo() { return (B.Juego && B.Juego.estado) ? B.Juego.estado.ciclo : 0; }

    /* ---------------- Fin de ciclo ----------------------------------- */
    finDeCiclo(snap) {
      this.historia.push({
        ciclo: snap.ciclo, herb: snap.herb, carn: snap.carn,
        bio: +snap.bio.toFixed(3), luz: +snap.luz.toFixed(3),
      });
      if (this.historia.length > 700) this.historia.shift();
      this.analizarSeries();
      this.comprobarHitos(snap);
      this.actualizarPredicciones(snap);
    }

    /* Detección de ciclos auge-quiebre (Lotka-Volterra) [P-B2] */
    analizarSeries() {
      const h = this.historia;
      if (h.length < 12) return;
      const serie = h.map((p) => p.herb);
      const n = serie.length;
      let picos = 0, valles = 0;
      for (let i = 2; i < n - 2; i++) {
        const v = serie[i];
        const esMax = v > serie[i - 1] && v > serie[i - 2] && v >= serie[i + 1] && v >= serie[i + 2];
        const esMin = v < serie[i - 1] && v < serie[i - 2] && v <= serie[i + 1] && v <= serie[i + 2];
        if (esMax && v >= 18) picos++;
        if (esMin && v <= 9) valles++;
      }
      const p = this.predicciones.boomBust;
      if (picos > p.picos) {
        p.picos = picos;
        this.cronicaAdd('ciclo', 'Auge poblacional detectado: ' + picos + ' picos en la serie.');
      }
      if (valles > p.valles) {
        p.valles = valles;
        this.cronicaAdd('ciclo', 'Quiebre poblacional detectado: ' + valles + ' valles en la serie.');
      }
      p.eventos = serie.filter((v, i) => i > 0 && Math.abs(v - serie[i - 1]) > 8).length;
    }

    /* ---------------- Predicciones del GDD [D: P-B1..P-B4] ---------- */
    actualizarPredicciones(snap) {
      const p = this.predicciones;
      // P-B4: el colapso enseña (la segunda curva, más larga)
      if (snap.total === 0 && !p.colapso) {
        p.colapso = { ciclo: snap.ciclo, recuperacion: null };
      }
      if (p.colapso && !p.colapso.recuperacion && snap.total >= 12) {
        p.colapso.recuperacion = snap.ciclo;
        this.cronicaAdd('ciclo', 'La reserva se recupera tras el colapso del ciclo ' + p.colapso.ciclo + '.');
      }
    }

    prediccionesEstado() {
      const p = this.predicciones;
      const duracion = p.colapso ? (p.colapso.recuperacion ? p.colapso.recuperacion - p.colapso.ciclo : null) : null;
      return [
        {
          id: 'P-B1', titulo: 'P-B1 · La biografía genera vínculo',
          texto: 'Las fichas biográficas y las fotografías crean apego documental: el naturalista sigue vidas, no puntuaciones.',
          estado: this.fichasAbiertas >= 10 ? 'apoyada (' + this.fichasAbiertas + ' aperturas de ficha; ' + this.fotos.length + ' fotos)'
            : 'en curso (' + this.fichasAbiertas + ' aperturas; ' + this.fotos.length + ' fotos)',
          falsacion: 'Si el registro no genera seguimiento de vidas concretas, la mecánica es decorativa.',
        },
        {
          id: 'P-B2', titulo: 'P-B2 · Ciclos auge–quiebre',
          texto: 'La dinámica pasto–herbívoros–cazadores produce ciclos tipo Lotka-Volterra visibles en la serie histórica.',
          estado: p.boomBust.picos > 0 ? 'apoyada (' + p.boomBust.picos + ' picos, ' + p.boomBust.valles + ' valles)'
            : 'en curso (serie corta)',
          falsacion: 'Si la serie no oscila con amplitud, la economía está mal calibrada.',
        },
        {
          id: 'P-B3', titulo: 'P-B3 · El veto como momento memorable',
          texto: 'El veto terminal de la capa reflexiva («el último trago») produce los momentos memorables de la simulación.',
          estado: p.vetos > 0 ? 'apoyada (' + p.vetos + ' vetos terminales registrados)' : 'en curso (aún sin vetos)',
          falsacion: 'Si los vetos nunca ocurren o pasan inadvertidos, la mecánica falla.',
        },
        {
          id: 'P-B4', titulo: 'P-B4 · El colapso enseña',
          texto: 'Tras un quiebre, la reserva re-sembrada sostiene curvas más largas: el sistema «aprende» vía doctrina heredada.',
          estado: p.colapso ? (p.colapso.recuperacion ? 'apoyada (recuperación en ' + duracion + ' ciclos)' : 'colapso activo (esperando recuperación)')
            : 'en curso (sin colapso aún)',
          falsacion: 'Si las curvas post-colapso no difieren, la herencia de doctrina no aporta.',
        },
      ];
    }

    /* ---------------- Hitos ------------------------------------------ */
    definicionesHitos() {
      const J = () => B.Juego;
      return [
        { id: 'primer-encuentro', titulo: 'El primer encuentro', texto: 'Seleccionaste a tu primera criatura. La reserva empezó a leerse.', cond: (s) => this.fichasAbiertas >= 1 },
        { id: 'carta', titulo: 'La carta honesta', texto: 'Leíste la carta de honestidad: sabes qué es real aquí y qué no.', cond: () => this.hitos.has('carta') },
        { id: 'primer-nacimiento', titulo: 'El primer nacimiento', texto: 'Presenciaste un nacimiento: emergencia de voluntad en la región 7.', cond: (s) => s.nacimientos >= 1 },
        { id: 'primera-muerte', titulo: 'La primera muerte', texto: 'Una disolución de voluntad cruzó tu cuaderno. El duelo es tuyo y es real.', cond: (s) => s.muertes >= 1 },
        { id: 'primera-caza', titulo: 'La primera caza', texto: 'El bucle depredador se cerró por primera vez ante tus ojos.', cond: (s) => s.cazas >= 1 },
        { id: 'veto-terminal', titulo: 'El último trago', texto: 'Un veto terminal se ejecutó: la voluntad anuló al reflejo en el borde de la sed.', cond: (s) => this.predicciones.vetos >= 1 },
        { id: 'primer-invierno', titulo: 'El primer invierno', texto: 'La reserva completó un invierno entero. La luz baja cobra su precio.', cond: (s) => s.ciclo >= 200 },
        { id: 'boom', titulo: 'Auge', texto: 'La población superó los 55 vivos: el pasto no da para tanto.', cond: (s) => s.total >= 55 },
        { id: 'quiebre', titulo: 'Quiebre', texto: 'La población cayó por debajo de 10. La curva enseña.', cond: (s) => s.total <= 9 && s.ciclo > 8 },
        { id: 'longevo', titulo: 'La longeva', texto: 'Una criatura alcanzó los 110 ciclos de edad.', cond: (s) => s.edadMax >= 110 },
        { id: 'linaje-3', titulo: 'Tercera generación', texto: 'Un linaje llegó a su tercera generación: la doctrina fluye.', cond: (s) => s.generacion >= 3 },
        { id: 'raro', titulo: 'El raro', texto: 'Nació un ejemplar albino. La deriva genética también escribe.', cond: (s) => s.albino },
        { id: 'orden', titulo: 'El orden regresa', texto: 'El micelio recicló residuo suficiente: la entropía pagó su factura.', cond: (s) => this.hongosReciclados >= 25 },
        { id: 'fotografo', titulo: 'Fotógrafa o fotógrafo de campo', texto: 'Cinco fotografías en el cuaderno.', cond: () => this.fotos.length >= 5 },
        { id: 'documentalista', titulo: 'Documentalista', texto: 'Diez notas de campo escritas por ti.', cond: () => this.notas.length >= 10 },
        { id: 'cien', titulo: 'Cien ciclos', texto: 'Cien ciclos de observación continua.', cond: (s) => s.ciclo >= 100 },
        { id: 'doscientos', titulo: 'La reserva antigua', texto: 'Doscientos ciclos: un año completo del modelo.', cond: (s) => s.ciclo >= 200 },
        { id: 'quinientos', titulo: 'Los quinientos', texto: 'Quinientos ciclos: la reserva antigua de los manuales.', cond: (s) => s.ciclo >= 500 },
        { id: 'sindrome', titulo: 'El vacío tiene nombre', texto: 'Detectaste el primer síndrome del vacío en una ficha.', cond: (s) => s.sindromes >= 1 },
        { id: 'cazador', titulo: 'Cazadora o cazador eficiente', texto: 'Un cazador sumó cinco caza exitosas.', cond: (s) => s.cazas >= 5 },
        { id: 'reunion', titulo: 'La siembra de emergencia', texto: 'Tras un colapso, re-sembraste la reserva y siguió viva.', cond: () => this.hitos.has('reunion') },
      ];
    }

    comprobarHitos(snap) {
      for (const h of this.definicionesHitos()) {
        if (this.hitos.has(h.id)) continue;
        let ok = false;
        try { ok = h.cond(snap); } catch (e) { ok = false; }
        if (ok) {
          this.hitos.add(h.id);
          this.cronicaAdd('hito', h.titulo + ' — ' + h.texto, snap.ciclo);
          U.bus.emitir('hito', h);
        }
      }
    }

    /* ---------------- Fotos y notas ---------------------------------- */
    foto(dataURL, ciclo) {
      this.fotos.push({ url: dataURL, ciclo, texto: null });
      if (this.fotos.length > C.FOTO.MAX) this.fotos.shift();
    }
    nota(texto, ciclo) {
      this.notas.push({ texto, ciclo });
      if (this.notas.length > 120) this.notas.shift();
    }

    /* ---------------- Serialización ---------------------------------- */
    serializar() {
      const fichas = [];
      for (const f of this.fichas.values()) {
        fichas.push(f.viva ? { viva: true, id: f.id } : f);
      }
      return {
        fichas,
        cronica: this.cronica.slice(-400),
        historia: this.historia.slice(-600),
        hitos: Array.from(this.hitos),
        fotos: this.fotos.slice(-C.FOTO.MAX),
        notas: this.notas.slice(-60),
        predicciones: {
          vinculo: this.fichasAbiertas, vetos: this.predicciones.vetos,
          boomBust: this.predicciones.boomBust, colapso: this.predicciones.colapso,
        },
        hongosReciclados: this.hongosReciclados,
      };
    }
    static deserializar(o) {
      const r = new Registro();
      r.fichas = new Map((o.fichas || []).map((f) => [f.id, f]));
      r.cronica = o.cronica || [];
      r.historia = o.historia || [];
      r.hitos = new Set(o.hitos || []);
      r.fotos = o.fotos || [];
      r.notas = o.notas || [];
      if (o.predicciones) {
        r.fichasAbiertas = o.predicciones.vinculo || 0;
        r.predicciones.vetos = o.predicciones.vetos || 0;
        r.predicciones.boomBust = o.predicciones.boomBust || r.predicciones.boomBust;
        r.predicciones.colapso = o.predicciones.colapso || null;
      }
      r.hongosReciclados = o.hongosReciclados || 0;
      return r;
    }
  }

  window.BIOS.Registro = Registro;
})();
