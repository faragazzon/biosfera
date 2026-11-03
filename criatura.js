/* ============================================================
   BIOSFERA — criatura.js
   Las criaturas del terrario: agentes con las tres capas de la
   voluntad (automática, de valoración, reflexiva), economía
   termodinámica unificada, veto deliberativo, aprendizaje por
   doctrina, síndromes del vacío, reproducción y muerte con legado.

   [D] Arquitectura de tres capas: tesis base cap. 7 (tabla 7.1).
   [D] Economía con degradación: doc. de aplicaciones §3.8
        (orden de pérdida: reflexiva → valoración → automática).
   [D] Veto deliberativo tipo Libet: doc. §5.2 (AGNES).
   [D] Síndromes del vacío: tesis base cap. 12 §12.7 + doc. §3.8.4.
   [D] Muerte con legado (cuerpo → biomasa; genoma + doctrina en
        las crías): GDD BIOSFERA, pilar 4.
   [P] Detalles de implementación y umbrales concretos.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;
  const G = B.Genoma;
  const TRI = B.Triadico;
  const ECON = C.ECON, CUERPO = C.CUERPO, REP = C.REPRODUCCION, CAZA = C.CAZA, PL = C.PLACEBO;

  const ACCIONES_INMOVILES = { descansar: 1, dormir: 1, esconder: 1, congelarse: 1, comer: 1, beber: 1, ritual: 1, carroñar: 1 };

  class Criatura {
    constructor(op) {
      const rng = op.rng || U.RNG((Math.random() * 2147483647) | 0);
      this.rng = rng;
      this.id = U.uid('c');
      this.genoma = op.genoma;
      this.fen = G.fenotipo(this.genoma);
      this.nombre = op.nombre || G.nombreAleatorio(rng, op.usados || null);
      this.doctrina = op.doctrina || G.Doctrina.paraMundo();
      this.x = op.x; this.y = op.y;
      this.dir = rng.siguiente() * Math.PI * 2;
      this.edadCiclos = op.edad || 0;
      this.edadSuave = this.edadCiclos; // edad continua (ciclos fraccionarios) para crecer sin saltos
      this.adulta = this.esAdulto();   // para narrar el paso de cría a adulto una sola vez
      this.sexo = op.sexo || (rng.azar(0.5) ? 'H' : 'M'); // [P] op.sexo: la pareja fundadora de cazadores llega como macho y hembra
      this.B = this.maxB() * 0.9;
      this.H = 0.92; this.I = 1;
      this.fatiga = 0.1;
      this.expectativa = 0.5;
      this.exitoEMA = 0.5;
      this.capas = { reflexiva: true, valoracion: true };
      this.objetivo = null;
      this.accion = null;
      this.vivo = true;
      this.causaMuerte = null; this.causaI = null;
      this.cicloNac = op.ciclo || 0; this.cicloActual = this.cicloNac;
      this.cicloMue = null;
      this.cooldownRepro = REP.MIN_EDAD;
      this.crias = []; this.padres = op.padres || null;
      this.cazas = 0; this.casiCazada = 0;
      this.vetoTerminalHecho = false;
      this.tSim = 0;
      this.acumReflejo = 0; this.acumVal = 0; this.acumRef = 0;
      this.ultCorreccion = -9;
      this.ultDistDest = 1e9; this.tEstancada = 0;
      // [P] v1.2: memoria de metas fallidas (el agua/roca bloquea el paso).
      // Aprendizaje local e imperfecto, con caducidad: la criatura deja de
      // elegir esa meta durante un rato en lugar de empujar el obstáculo
      // hasta agotarse. No da conocimiento del mapa: solo experiencia propia.
      this.metaFallida = null;
      this.ultDevTotal = 0;
      this.huyendo = false; this.depurador = null;
      // Seguimiento del protocolo de agencia (4 indicadores) [D]
      this.ag = { correcciones: 0, robustez: 0, anticipaciones: 0, aprendizajes: 0, homeo: 0, homeoMuestras: 1 };
      // Síndromes del vacío [D]
      this.sin = { bEMA: this.B / this.maxB(), agotado: false, alienado: false, deprimido: false, rachaBajaB: 0, rachaSinMeta: 0, rachaFracaso: 0, intentos: 0 };
      // Animación
      this.anim = { fase: rng.siguiente() * 10, parpadeo: 2 + rng.siguiente() * 4, bob: 0, squash: 1 };
      this.bio = [];
      this.biografiaEvento('nace', op.padres
        ? 'Nace de ' + (op.padres[0] ? op.padres[0].nombre : '?') + ' y ' + (op.padres[1] ? op.padres[1].nombre : '?')
        : 'Siembra inicial de la reserva');
    }

    /* ---------------- Propiedades derivadas ------------------------- */
    maxB() { return CUERPO.MAXB_BASE + CUERPO.MAXB_TAM * this.tamActual(); }
    /* Fracción de crecimiento 0..1 (suave: avanza cada paso, no por saltos de ciclo). */
    fracCrecimiento() {
      const edad = this.edadSuave !== undefined ? this.edadSuave : this.edadCiclos;
      return U.clamp(edad / REP.ADULTO, 0, 1);
    }
    /* Tamaño económico (regla v1.0, intacta: el equilibrio ecológico depende de ella). */
    tamActual() { return this.genoma.tam * Math.min(1, 0.35 + this.edadCiclos / REP.ADULTO); }
    /* Tamaño VISUAL: nace pequeña (30%) y crece de forma continua hasta el tamaño
       adulto con curva √ (rápido de cría, maduración gradual). Solo lo dibuja el
       renderizador; la economía interna no lo mira. [P] */
    tamVisual() { return this.genoma.tam * (0.30 + 0.70 * Math.sqrt(this.fracCrecimiento())); }
    esCria() { return this.edadCiclos < REP.ADULTO; }
    esAdulto() { return this.edadCiclos >= REP.ADULTO; }
    velPx() { return this.fen.velBase * (this.esCria() ? 0.9 : 1); }
    radioSentido() { return 70 + 150 * this.genoma.sentido; }
    placeboMult() { return PL.EF_MIN + PL.EF_RANGO * this.expectativa; }
    fracB() { return U.clamp(this.B / this.maxB(), 0, 1); }
    puedeCazar(presa) {
      return this.fen.dieta === 'carnivoro' && this.esAdulto() && presa.vivo
        && presa.id !== this.id && presa.tamActual() <= this.tamActual() * 0.86
        // [P] v1.2: reconocimiento filial — un cazador no devora a sus propias
        // crías (la manada protege); las ajenas sí cuentan como presa.
        && !(presa.padres && presa.padres.indexOf(this) >= 0);
    }

    /* ---------------- Economía termodinámica [D] --------------------- */
    cargarEconomia(dtS, moviendo, esfuerzo) {
      const g = this.genoma;
      const descansando = this.accion && (this.accion.tipo === 'descansar' || this.accion.tipo === 'dormir');
      // Los cazadores tienen un metabolismo de espera: quemar poco entre festines [P]
      const factorDieta = this.fen.dieta === 'carnivoro' ? 0.72 : 1;
      let coste = ECON.EXISTIR * (0.6 + 0.8 * g.metabolismo) * (0.55 + 0.45 * this.tamActual()) * factorDieta;
      if (descansando) coste *= 0.68;
      coste += ECON.PERCIBIR * (0.5 + g.sentido);
      if (this.capas.valoracion) coste += ECON.VALORAR;
      if (this.capas.reflexiva) coste += ECON.DELIBERAR / C.CAPAS.REFLEXIVA_S;
      if (moviendo) coste += ECON.ACTUAR * (0.6 + g.velocidad) * (esfuerzo || 1);
      this.B -= coste * dtS;
      // Degradación por agotamiento: muere primero lo caro [D]
      const frac = this.fracB();
      if (frac < ECON.UMBRAL_REFLEXIVA && this.capas.reflexiva) {
        this.capas.reflexiva = false;
        TRI.registrarTransicion('degradacion', this);
        this.biografiaEvento('capa', 'Pierde la capa reflexiva: el presupuesto ya no paga la deliberación.');
      } else if (frac > ECON.UMBRAL_REFLEXIVA + 0.08 && !this.capas.reflexiva && this.capas.valoracion) {
        this.capas.reflexiva = true;
        TRI.registrarTransicion('recuperacion', this);
        this.biografiaEvento('capa', 'Recupera la capa reflexiva.');
      }
      if (frac < ECON.UMBRAL_VALORACION && this.capas.valoracion) {
        this.capas.valoracion = false;
        this.biografiaEvento('capa', 'Pierde la capa de valoración: solo quedan los reflejos.');
      } else if (frac > ECON.UMBRAL_VALORACION + 0.08 && !this.capas.valoracion) {
        this.capas.valoracion = true;
        this.biografiaEvento('capa', 'Recupera la capa de valoración.');
      }
    }

    /* ---------------- Paso principal -------------------------------- */
    paso(dtS, mundo, pob) {
      if (!this.vivo) return;
      this.tSim += dtS;
      this.cicloActual = pob.cicloActual;
      this.edadSuave += (dtS * 1000) / C.TIEMPO.CICLO_MS; // crece de forma continua

      const moviendo = this.debeMoverse();
      this.cargarEconomia(dtS, moviendo, this.esfuerzoActual());

      // Necesidades
      const corriendo = moviendo && (this.huyendo || (this.objetivo && (this.objetivo.tipo === 'cazar' || this.objetivo.tipo === 'agua-terminal')));
      this.H = U.clamp(this.H - CUERPO.SED_TASA * (corriendo ? 1.6 : 1) * dtS, 0, 1);
      if (moviendo) this.fatiga = U.clamp(this.fatiga + CUERPO.FATIGA_SUBE * (0.6 + this.genoma.velocidad) * dtS, 0, 1);
      // El hambre y la sed crónicas desgastan la integridad
      if (this.fracB() < 0.14) this.I = U.clamp(this.I - 0.010 * dtS, 0, 1);
      if (this.H < 0.08) this.I = U.clamp(this.I - 0.012 * dtS, 0, 1);
      // Regeneración lenta por robustez
      if (this.I < 1 && this.fracB() > 0.5 && this.H > 0.4) this.I = U.clamp(this.I + 0.0012 * this.genoma.robustez * dtS, 0, 1);

      // Capa automática (reflejos) — siempre activa mientras hay vida [D]
      this.acumReflejo += dtS;
      if (this.acumReflejo >= C.CAPAS.REFLEJO_S) { this.reflejo(mundo, pob); this.acumReflejo = 0; }

      // Capa de valoración [D]
      this.acumVal += dtS;
      if (this.capas.valoracion && this.acumVal >= C.CAPAS.VALORACION_S) { this.valorar(mundo, pob); this.acumVal = 0; }

      // Capa reflexiva: planificar, vetar, aprender [D]
      this.acumRef += dtS;
      if (this.capas.reflexiva && this.acumRef >= C.CAPAS.REFLEXIVA_S) { this.reflexiva(mundo, pob); this.acumRef = 0; }

      if (this.accion) this.ejecutarAccion(dtS, mundo, pob);
      if (this.debeMoverse()) this.moverse(dtS, mundo);

      // Muerte
      if (this.B <= 0) this.morir('inanición');
      else if (this.H <= 0) this.morir('sed');
      else if (this.I <= 0) this.morir(this.causaI || 'heridas');
    }

    debeMoverse() {
      if (this.accion && ACCIONES_INMOVILES[this.accion.tipo]) return false;
      return !!this.objetivo;
    }
    esfuerzoActual() {
      if (this.huyendo) return 2.0;
      if (this.objetivo && this.objetivo.tipo === 'cazar') return CAZA.COSTE_MULT;
      if (this.objetivo && this.objetivo.tipo === 'agua-terminal') return 1.8;
      return 1;
    }

    /* ---------------- Capa automática: reflejos [D] ------------------ */
    reflejo(mundo, pob) {
      if (!this.vivo) return;
      // Depredador a la vista
      if (this.fen.dieta === 'herbivoro') {
        const depredador = pob.vecinoMasCercano(this.x, this.y, this.radioSentido(),
          (c) => c.fen.dieta === 'carnivoro' && c.puedeCazar(this));
        if (depredador) {
          const d = U.dist(this.x, this.y, depredador.x, depredador.y);
          this.casiCazada++;
          // Veto de congelarse: el cazador ve el movimiento [P]
          if (d > 3.2 * mundo.TILE && this.I > 0.55 && this.ag.aprendizajes > 1 && this.capas.reflexiva) {
            this.fijarAccion('congelarse', 4, { depredador: depredador.id });
            this.biografiaEvento('veto', 'Veto: se congela en lugar de huir (el cazador ve el movimiento).');
            return;
          }
          // Reflejo de huida
          const ang = Math.atan2(this.y - depredador.y, this.x - depredador.x);
          const hx = U.clamp(this.x + Math.cos(ang) * 240, 20, mundo.Wpx - 20);
          const hy = U.clamp(this.y + Math.sin(ang) * 240, 20, mundo.Hpx - 20);
          this.objetivo = { tipo: 'huida', x: hx, y: hy, desde: this.tSim, entidad: depredador.id };
          this.accion = null;
          this.huyendo = true;
          return;
        }
      }
      this.huyendo = false;
      // Reflejo de pasto desesperado: con el presupuesto crítico, la capa
      // automática toma el mando del hambre aunque la valoración esté apagada. [P]
      if (this.fracB() < 0.14 && this.fen.dieta === 'herbivoro') {
        const t = mundo.tileEn(this.x, this.y);
        if (t && mundo.tipo[t.i] === 0 && mundo.bio[t.i] > 0.05 && !this.accion) {
          this.fijarAccion('comer', 7, { hasta0: 7 });
          return;
        }
        const tp = this.mejorTileSentido(mundo, 'bio', 8, true);
        if (tp) {
          const c = mundo.centroTile(tp.tx, tp.ty);
          this.objetivo = { tipo: 'pasto', x: c.x, y: c.y, desde: this.tSim, invalido: false };
          this.accion = null;
          return;
        }
      }
      // [P] v1.2: el mismo reflejo para cazadores — caza o carroña desesperada
      // con el presupuesto crítico. Sin esto, el cazador que apaga su capa de
      // valoración se quedaba inmóvil («nada») y moría de pie junto a las presas.
      if (this.fracB() < 0.14 && this.fen.dieta === 'carnivoro') {
        const presa = pob.vecinoMasCercano(this.x, this.y, this.radioSentido() * 2.8, (o) => this.puedeCazar(o));
        if (presa) {
          this.objetivo = { tipo: 'cazar', x: presa.x, y: presa.y, desde: this.tSim, entidad: presa.id, ref: presa, invalido: false };
          this.accion = null;
          return;
        }
        const tc = this.mejorTileSentido(mundo, 'residuo', 8, true);
        if (tc) {
          const c = mundo.centroTile(tc.tx, tc.ty);
          this.objetivo = { tipo: 'carroña', x: c.x, y: c.y, desde: this.tSim, invalido: false };
          this.accion = null;
          return;
        }
      }
      // Beber por reflejo si hay agua junto al pie y sed alta
      if (this.H < 0.16) {
        const t = mundo.tileEn(this.x, this.y);
        if (t && mundo.conAguaAdyacente(t.tx, t.ty)) { this.fijarAccion('beber', 5); return; }
      }
      // Dormir por agotamiento
      if (this.fatiga > 0.95 && (!this.accion || this.accion.tipo !== 'dormir')) this.fijarAccion('dormir', 8);
    }

    /* ---------------- Capa de valoración [D] ------------------------- */
    valorar(mundo, pob) {
      if (!this.vivo || this.huyendo) return;
      if (this.accion && ACCIONES_INMOVILES[this.accion.tipo] && this.accion.hasta > 0.5) return;
      const g = this.genoma;
      const devE = 1 - this.fracB();
      const devA = 1 - this.H;
      const holgura = 1 - devE;
      const info = mundo.luzTotal(pob.cicloActual, pob.tCiclo);
      const noche = info.D < 0.35;
      const cand = [];
      const t = mundo.tileEn(this.x, this.y);

      const tam = (t2) => Math.ceil(this.radioSentido() / mundo.TILE);
      const hambrienta = devE > 0.5, sedienta = devA > 0.4;
      // — Pasto sentido local (solo forrajeros; los cazadores no pastan) [P]
      const tp = this.fen.dieta === 'herbivoro' ? this.mejorTileSentido(mundo, 'bio', tam() + (hambrienta ? 4 : 0), true) : null;
      if (tp) cand.push({ tipo: 'pasto', tx: tp.tx, ty: tp.ty, pts: 1.28 * devE + 0.25 * g.apetito });
      // — Agua sentido local (o ampliado por sed)
      const ta = this.mejorTileSentido(mundo, 'agua', tam() + (sedienta ? 5 : 0), true);
      if (ta) cand.push({ tipo: 'agua', tx: ta.tx, ty: ta.ty, pts: 1.18 * devA + 0.08 });
      // — Agua conocida por doctrina: ir proactivamente [D: memoria aprendida]
      else if (devA > 0.3 && t) {
        const zona = this.doctrina.mejorZona('agua', t.tx, t.ty);
        const tileAgua = zona ? this.tileAguaEnZona(mundo, zona) : null;
        if (tileAgua) {
          const c = mundo.centroTile(tileAgua.tx, tileAgua.ty);
          // [P] v1.2: no volver al agua cuyo camino ya fracasó
          if (!this.metaBloqueadaPx(c.x, c.y)) cand.push({ tipo: 'agua', tx: tileAgua.tx, ty: tileAgua.ty, pts: 1.08 * devA });
        }
      }
      // — Sed sin agua conocida: seguir el gradiente de humedad (migración) [P]
      if (!ta && devA > 0.42) {
        const m2 = this.direccionHumedad(mundo);
        if (m2) cand.push({ tipo: 'migrar-agua', x: m2.x, y: m2.y, pts: 1.05 * devA + 0.42 });
        else if (devA > 0.55) cand.push({ tipo: 'explorar', pts: 0.85 * devA }); // vagar hasta hallar gradiente
      }
      // — Comedero descubierto ([P] v1.2: salta el que ya demostró ser inalcanzable)
      const coms = mundo.comederosCercanos(this.x, this.y, this.radioSentido());
      const com = coms.find((k) => !this.metaBloqueadaPx(k.x, k.y)) || null;
      if (com) {
        cand.push({ tipo: 'comedero', x: com.x, y: com.y, pts: 1.22 * devE * (1 + 0.25 * this.expectativa), com });
        if (!this.doctrina.comederoVisto) {
          this.doctrina.comederoVisto = true;
          this.aprenderZona('pasto', com.x, com.y, 0.9);
          this.biografiaEvento('descubre', 'Descubre un comedero del naturalista: la expectativa sube.');
        }
      }
      // — Carroña y caza (solo carnívoros)
      if (this.fen.dieta === 'carnivoro') {
        // [P] v1.2: las crías de cazador no pastan ni cazan todavía: huelen la
        // carroña más lejos (los juveniles hambrientos rastrean cadáveres),
        // que suele ser la matanza de sus padres cerca del territorio.
        const tc = this.mejorTileSentido(mundo, 'residuo', tam() + (this.esCria() ? 6 : 0), true);
        if (tc) cand.push({ tipo: 'carroña', tx: tc.tx, ty: tc.ty, pts: 1.05 * devE });
        const presa = pob.presasPotenciales(this)[0];
        if (presa) {
          const dPresa = U.dist(this.x, this.y, presa.x, presa.y);
          // [P] v1.2: la caza es dirigida por el hambre (sin término constante):
          // cazar con el presupuesto lleno desperdicia la presa y tala el rebaño
          // — el exceso de caza mataba al ecosistema entero por sobresalto.
          if (dPresa < 340 && devE > 0.22) cand.push({ tipo: 'cazar', entidad: presa, pts: 1.4 * devE });
          else if (devE > 0.3) {
            // Rastrear: caminar hacia el olor sin gastar la persecución [P]
            cand.push({ tipo: 'rastrear', x: presa.x, y: presa.y, pts: 0.75 * devE + 0.1 });
          }
        }
      }
      // — Descanso y sueño (los cazadores en ayunas ahorran: el acecho es barato) [P]
      cand.push({ tipo: 'descansar', pts: 0.72 * this.fatiga + (noche ? 0.32 : 0.05) + (this.sin.agotado ? 0.35 : 0) + (this.fen.dieta === 'carnivoro' && devE < 0.5 ? 0.22 : 0) });
      // — Explorar (curiosidad con holgura; o forrajeo desesperado sin ella) [P]
      if (holgura > 0.3) cand.push({ tipo: 'explorar', pts: 0.55 * g.curiosidad * holgura + 0.12 });
      else if (devE > 0.45 && !tp) cand.push({ tipo: 'explorar', pts: 0.5 + 0.3 * devE });
      // — Cortejo
      if (this.esAdulto() && this.cooldownRepro <= 0 && holgura > this.umbralCortejo(pob)) {
        const pareja = pob.candidatoCortejo(this);
        if (pareja) cand.push({ tipo: 'cortejo', entidad: pareja, pts: 0.95 * holgura });
      }

      if (!cand.length) return;
      cand.sort((a, b) => b.pts - a.pts);
      const mejor = cand[0];
      // Histéresis: no saltar de objetivo sin causa
      if (this.objetivo && !this.objetivo.invalido && this.objetivo.tipo === mejor.tipo && this.objetivo.pts !== undefined) {
        if (this.objetivo.pts >= mejor.pts * 0.72) return;
      }

      const obj = { tipo: mejor.tipo, desde: this.tSim, invalido: false, pts: mejor.pts };
      if (mejor.tipo === 'cazar' || mejor.tipo === 'cortejo') {
        obj.entidad = mejor.entidad.id;
        obj.ref = mejor.entidad;
        obj.x = mejor.entidad.x; obj.y = mejor.entidad.y;
      } else if (mejor.tipo === 'comedero') {
        obj.x = mejor.com.x; obj.y = mejor.com.y; obj.com = mejor.com;
      } else if (mejor.tipo === 'migrar-agua' || mejor.tipo === 'rastrear') {
        obj.x = mejor.x; obj.y = mejor.y;
      } else if (mejor.tipo === 'descansar' || mejor.tipo === 'explorar') {
        const c = this.puntoAleatorioSeguro(mundo, mejor.tipo === 'explorar');
        obj.x = c.x; obj.y = c.y;
      } else {
        const centro = mundo.centroTile(mejor.tx, mejor.ty);
        obj.x = centro.x; obj.y = centro.y;
        obj.tx = mejor.tx; obj.ty = mejor.ty;
      }
      // Anticipación: fijar meta antes de que la necesidad sea crítica [D]
      if ((mejor.tipo === 'agua' && devA < 0.45) || (mejor.tipo === 'pasto' && devE < 0.45)) this.ag.anticipaciones++;
      this.objetivo = obj;
      this.accion = null;
    }

    umbralCortejo(pob) {
      // Freno natural: la escasez encarece el cortejo [P]
      const presion = pob.contar().total / C.POB.SUPRESION;
      const base = this.fen.dieta === 'carnivoro' ? REP.CARN_UMBRAL : REP.UMBRAL_HOLGURA;
      return U.clamp(base + Math.max(0, presion - 1) * 0.18, base, 0.95);
    }

    /* Migra siguiendo el gradiente de humedad: 8 sondeos lejanos.
       Sentido biológicamente plausible: la humedad del suelo delata el agua. [P] */
    direccionHumedad(mundo) {
      const t = mundo.tileEn(this.x, this.y);
      if (!t) return null;
      const R = 6 + Math.round(this.genoma.sentido * 4);
      let mejor = null, mejorHum = mundo.humedad[t.i] || 0;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const px = U.clamp(this.x + Math.cos(a) * R * mundo.TILE, 12, mundo.Wpx - 12);
        const py = U.clamp(this.y + Math.sin(a) * R * mundo.TILE, 12, mundo.Hpx - 12);
        const tt = mundo.tileEn(px, py);
        if (!tt) continue;
        // [P] v1.2: solo se huele la tierra húmeda que se puede pisar: una
        // sonda dentro del agua sería un señuelo intransitable.
        if (mundo.esBloqueado(tt.tx, tt.ty)) continue;
        const hum = mundo.humedad[tt.i];
        if (hum > mejorHum + 0.04) { mejorHum = hum; mejor = { x: px, y: py }; }
      }
      return mejor;
    }

    mejorTileSentido(mundo, clave, radioTiles, evitarMeta) {
      const t = mundo.tileEn(this.x, this.y);
      if (!t) return null;
      // [P] v1.2: si se pide, se saltan los tiles junto a la última meta
      // fallida (±2 tiles) — la criatura recuerda que por ahí no se pasa.
      const mf = evitarMeta ? this.metaFallida : null;
      const mfActiva = !!mf && this.tSim <= mf.hasta;
      const mfx = mfActiva ? Math.floor(mf.x / mundo.TILE) : -99;
      const mfy = mfActiva ? Math.floor(mf.y / mundo.TILE) : -99;
      let mejor = null, mejorP = -1;
      for (let dy = -radioTiles; dy <= radioTiles; dy++) {
        for (let dx = -radioTiles; dx <= radioTiles; dx++) {
          const tx = t.tx + dx, ty = t.ty + dy;
          if (!mundo.dentro(tx, ty)) continue;
          if (mfActiva && Math.abs(tx - mfx) <= 2 && Math.abs(ty - mfy) <= 2) continue;
          const i = mundo.idx(tx, ty);
          let v = 0;
          if (clave === 'bio') { if (mundo.tipo[i] !== 0) continue; v = mundo.bio[i]; if (v < 0.10) continue; }
          else if (clave === 'agua') {
            // [P] v1.2: la meta de agua es la ORILLA (tile caminable con agua
            // adyacente), no el propio lago: se bebe desde la orilla y así la
            // meta más próxima casi siempre está en el propio lado de la
            // criatura — sin cruzar brazos de agua intransitables.
            if (mundo.tipo[i] !== 0) continue;
            if (!mundo.conAguaAdyacente(tx, ty)) continue;
            v = 1;
          }
          else if (clave === 'residuo') { if (mundo.tipo[i] !== 0) continue; v = mundo.residuo[i]; if (v < 0.15) continue; }
          const d = Math.hypot(dx, dy);
          const p = v / (1 + d * 0.45);
          if (p > mejorP) { mejorP = p; mejor = { tx, ty }; }
        }
      }
      return mejor;
    }

    puntoAleatorioSeguro(mundo, lejos) {
      const r = lejos ? (140 + this.rng.siguiente() * 320) : (40 + this.rng.siguiente() * 90);
      const ang = this.rng.siguiente() * Math.PI * 2;
      let x = U.clamp(this.x + Math.cos(ang) * r, 24, mundo.Wpx - 24);
      let y = U.clamp(this.y + Math.sin(ang) * r, 24, mundo.Hpx - 24);
      const t = mundo.tileLibreCercano(x, y);
      if (t) { const c = mundo.centroTile(t.tx, t.ty); x = c.x; y = c.y; }
      return { x, y };
    }

    /* ---------------- Capa reflexiva [D] ---------------------------- */
    reflexiva(mundo, pob) {
      if (!this.vivo) return;
      const devTotal = (1 - this.fracB()) + (1 - this.H);
      const t = mundo.tileEn(this.x, this.y);

      // 1) Veto terminal: el último trago [D: P-B3, momento memorable]
      if (this.H < 0.12 && !this.vetoTerminalHecho) {
        const zona = this.doctrina.mejorZona('agua', t ? t.tx : 0, t ? t.ty : 0);
        const tileAgua = zona ? this.tileAguaEnZona(mundo, zona) : this.mejorTileSentido(mundo, 'agua', 8);
        if (tileAgua) {
          this.vetoTerminalHecho = true;
          const c = mundo.centroTile(tileAgua.tx, tileAgua.ty);
          this.objetivo = { tipo: 'agua-terminal', x: c.x, y: c.y, desde: this.tSim, invalido: false };
          this.accion = null;
          this.biografiaEvento('veto-terminal', 'Veto terminal: la capa reflexiva anula todo lo demás y ordena el último trago.');
          U.bus.emitir('memorable', {
            texto: this.nombre + ' ejecuta un veto terminal: la sed crítica anula toda otra meta.',
            x: this.x, y: this.y, id: this.id,
          });
          return;
        }
      }

      // 2) Replanificación si el objetivo está estancado o muerto
      if (this.objetivo && !this.huyendo) {
        const caducado = this.tSim - this.objetivo.desde > 26;
        const entidadMuerta = this.objetivo.ref && (!this.objetivo.ref.vivo || (this.objetivo.tipo === 'cazar' && !this.objetivo.ref.vivo));
        if (this.objetivo.invalido || caducado || entidadMuerta) {
          const clave = (1 - this.H) > (1 - this.fracB()) ? 'agua' : 'pasto';
          const zona = this.doctrina.mejorZona(clave, t ? t.tx : 0, t ? t.ty : 0);
          let tile = null;
          if (zona) tile = clave === 'agua' ? this.tileAguaEnZona(mundo, zona) : this.tilePastoEnZona(mundo, zona);
          if (tile) {
            // [P] v1.2: la meta conocida que ya fracasó no cuenta como replan
            const cz = mundo.centroTile(tile.tx, tile.ty);
            if (this.metaBloqueadaPx(cz.x, cz.y)) tile = null;
          }
          if (!tile) tile = this.mejorTileSentido(mundo, clave === 'agua' ? 'agua' : 'bio', 9, true);
          if (tile) {
            const c = mundo.centroTile(tile.tx, tile.ty);
            this.objetivo = { tipo: clave === 'agua' ? 'agua' : 'pasto', x: c.x, y: c.y, tx: tile.tx, ty: tile.ty, desde: this.tSim, invalido: false, replan: true };
            this.accion = null;
          } else {
            this.objetivo = null;
          }
        }
      }

      // 3) Aprendizaje: recompensa = reducción de la desviación total [D]
      const mejora = this.ultDevTotal - devTotal;
      this.ultDevTotal = devTotal;
      if (t) {
        this.doctrina.marcarVisita(t.tx, t.ty);
        if (mejora > 0.05) {
          const clave = this.ultimoExito === 'agua' ? 'agua' : 'pasto';
          this.aprenderZona(clave, this.x, this.y, U.clamp(0.6 + mejora, 0, 1));
          this.ag.aprendizajes++;
        }
        if (this.peligroReciente) {
          this.aprenderZona('seguridad', this.x, this.y, 0.15);
          this.peligroReciente = false;
        }
      }

      // 4) Anticipación estacional: con la luz baja, ir al pasto conocido
      const info = mundo.luzTotal(pob.cicloActual, pob.tCiclo);
      if (info.estacional < 0.35 && this.fracB() < 0.55 && !this.objetivo && t) {
        const zona = this.doctrina.mejorZona('pasto', t.tx, t.ty);
        if (zona) {
          const tile = this.tilePastoEnZona(mundo, zona);
          if (tile) {
            const c = mundo.centroTile(tile.tx, tile.ty);
            this.objetivo = { tipo: 'pasto', x: c.x, y: c.y, tx: tile.tx, ty: tile.ty, desde: this.tSim, invalido: false };
            this.ag.anticipaciones++;
          }
        }
      }
    }

    tileAguaEnZona(mundo, zona) {
      for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 6; dx++) {
        const tx = zona.tx + dx - 2, ty = zona.ty + dy - 2;
        if (mundo.esAgua(tx, ty)) return { tx, ty };
      }
      return null;
    }
    tilePastoEnZona(mundo, zona) {
      let mejor = null, mv = 0;
      for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 6; dx++) {
        const tx = zona.tx + dx - 2, ty = zona.ty + dy - 2;
        if (!mundo.dentro(tx, ty)) continue;
        const i = mundo.idx(tx, ty);
        if (mundo.tipo[i] !== 0) continue;
        if (mundo.bio[i] > mv) { mv = mundo.bio[i]; mejor = { tx, ty }; }
      }
      return mejor && mv > 0.12 ? mejor : null;
    }

    aprenderZona(clave, xpx, ypx, valor) {
      const t = { tx: Math.floor(xpx / mundoGlobal().TILE), ty: Math.floor(ypx / mundoGlobal().TILE) };
      this.doctrina.aprender(clave, t.tx, t.ty, valor, 0.30);
    }

    /* ---------------- Memoria de metas fallidas [P] v1.2 -------------- */
    /* La voluntad aprende del bloqueo: si una meta fija (pasto, agua,
       comedero…) no se alcanza porque el agua o la roca cierran el paso,
       se deja de elegirla durante un tiempo y la doctrina de esa zona pierde
       valor — y la doctrina se hereda, así que el conocimiento también pasa
       a las crías. Mismo espíritu que aprenderZona, aplicado al fracaso:
       memoria local, imperfecta y caduca. Sin mapa global, sin A*: la
       criatura solo recuerda SU experiencia (región 2 del diagrama:
       «si el camino se bloquea, prueba otra vía»). */
    registrarMetaFallida(xpx, ypx, tipoMeta) {
      this.metaFallida = { x: xpx, y: ypx, hasta: this.tSim + 75 };
      const clave = (tipoMeta === 'agua' || tipoMeta === 'agua-terminal' || tipoMeta === 'migrar-agua') ? 'agua'
        : (tipoMeta === 'pasto' || tipoMeta === 'comedero') ? 'pasto' : null;
      const m = mundoGlobal();
      if (clave && m) this.doctrina.aprender(clave, Math.floor(xpx / m.TILE), Math.floor(ypx / m.TILE), 0.06, 0.22);
    }
    metaBloqueadaPx(xpx, ypx) {
      const m = this.metaFallida;
      return !!m && this.tSim <= m.hasta && U.dist(xpx, ypx, m.x, m.y) < 80;
    }

    /* ---------------- Acciones --------------------------------------- */
    fijarAccion(tipo, durS, data) {
      this.accion = { tipo, hasta: durS, data: data || {}, t: 0 };
    }

    ejecutarAccion(dtS, mundo, pob) {
      const a = this.accion;
      if (!a) return;
      a.hasta -= dtS; a.t += dtS;
      const t = mundo.tileEn(this.x, this.y);

      switch (a.tipo) {
        case 'comer': {
          if (!t || mundo.tipo[t.i] !== 0 || mundo.bio[t.i] < 0.02) { this.terminarComer(false); break; }
          const bio = mundo.bio[t.i];
          const ganancia = CUERPO.INTAKE_PASTO * bio * this.genoma.eficiencia * this.placeboMult() * dtS;
          const antes = this.B;
          this.B = Math.min(this.maxB(), this.B + ganancia);
          mundo.comerBio(t.tx, t.ty, 0.062 * dtS * (0.6 + 0.4 * bio));
          a.ganado = (a.ganado || 0) + (this.B - antes);
          // migas y masticado se animan en el renderizador, anclados a la boca
          if (a.t % 1.0 < dtS && B.Render) B.Render.marcaSucia(t.tx, t.ty);
          if (a.hasta <= 0 || this.B >= this.maxB() * 0.985) this.terminarComer(true);
          break;
        }
        case 'carroñar': {
          if (!t || mundo.residuo[t.i] < 0.05) { this.accion = null; break; }
          const ganancia = CUERPO.INTAKE_PASTO * CAZA.CARROÑA_GAIN * mundo.residuo[t.i] * this.genoma.eficiencia * dtS;
          this.B = Math.min(this.maxB(), this.B + ganancia);
          mundo.residuo[t.i] = Math.max(0, mundo.residuo[t.i] - 0.05 * dtS);
          if (a.t % 1.0 < dtS && B.Render) B.Render.marcaSucia(t.tx, t.ty);
          if (a.hasta <= 0) this.accion = null;
          break;
        }
        case 'beber': {
          this.H = U.clamp(this.H + CUERPO.BEBER_TASA * dtS, 0, 1);
          // lengüetazos, gotas y ondulas se animan en el renderizador, sobre el agua
          if (a.hasta <= 0 || this.H >= 0.98) {
            // Aprendizaje reforzado: el agua se graba a fuego en la doctrina [D]
            this.aprenderZona('agua', this.x, this.y, 0.95);
            if (this.objetivo && this.objetivo.tipo === 'agua-terminal') {
              this.H = Math.max(this.H, 0.55);
              this.biografiaEvento('supervivencia', 'Sobrevive al veto terminal: llega al agua y bebe.');
              U.bus.emitir('memorable', { texto: this.nombre + ' sobrevivió al veto terminal: bebió a tiempo.', x: this.x, y: this.y, id: this.id });
            }
            this.ultimoExito = 'agua';
            this.accion = null; this.objetivo = null;
          }
          break;
        }
        case 'descansar':
        case 'dormir': {
          this.fatiga = U.clamp(this.fatiga - CUERPO.FATIGA_BAJA * (a.tipo === 'dormir' ? 1.4 : 1) * dtS, 0, 1);
          if (a.hasta <= 0 || (a.tipo === 'descansar' && this.fatiga < 0.2)) this.accion = null;
          break;
        }
        case 'congelarse': {
          const dep = a.data.depredador ? pob.porId(a.data.depredador) : null;
          if (dep && dep.vivo) {
            const d = U.dist(this.x, this.y, dep.x, dep.y);
            if (d < 2.2 * mundo.TILE) { // detectada: huir ya
              this.accion = null; this.reflejo(mundo, pob);
            } else if (a.hasta <= 0) this.accion = null;
          } else if (a.hasta <= 0) this.accion = null;
          break;
        }
        case 'esconder': {
          if (a.hasta <= 0) this.accion = null;
          break;
        }
        case 'ritual': {
          const pareja = pob.porId(a.data.pareja);
          if (!pareja || !pareja.vivo) { this.accion = null; break; }
          if (a.t % 1.1 < dtS) U.bus.emitir('fx', { tipo: 'corazon', x: (this.x + pareja.x) / 2, y: (this.y + pareja.y) / 2 - 14 });
          if (a.hasta <= 0) {
            // La madre asume el coste mayor [D: economía de la reproducción]
            const madre = this.sexo === 'H' ? this : pareja;
            const padre = this.sexo === 'H' ? pareja : this;
            if (madre.vivo && padre.vivo && madre.fracB() > 0.35) {
              const genoma = G.mezclar(madre.genoma, padre.genoma, this.rng);
              const doctrina = G.Doctrina.mezclar(madre.doctrina, padre.doctrina, this.rng);
              pob.nacimiento(genoma, doctrina, this.x, this.y, [madre, padre]);
              // Gemelos ocasionales: la demografía respira [P]
              if (this.rng.azar(0.2) && pob.contar().total < C.POB.CAP) {
                const g2 = G.mezclar(madre.genoma, padre.genoma, this.rng);
                const d2 = G.Doctrina.mezclar(madre.doctrina, padre.doctrina, this.rng);
                pob.nacimiento(g2, d2, this.x, this.y, [madre, padre]);
              }
              madre.B -= madre.maxB() * REP.COSTE_MADRE;
              padre.B -= padre.maxB() * REP.COSTE_PADRE;
              madre.cooldownRepro = this.fen.dieta === 'carnivoro' ? REP.CARN_COOLDOWN : REP.COOLDOWN_MADRE;
              padre.cooldownRepro = this.fen.dieta === 'carnivoro' ? REP.CARN_COOLDOWN : REP.COOLDOWN_PADRE;
              this.biografiaEvento('cria', 'Cortejo con ' + pareja.nombre + ': llega una cría.');
            }
            this.accion = null; this.objetivo = null;
          }
          break;
        }
        default:
          if (a.hasta <= 0) this.accion = null;
      }
    }

    terminarComer(exito) {
      const a = this.accion;
      const esperado = a ? ((a.data && a.data.hasta0) || 6) * CUERPO.INTAKE_PASTO * 0.45 * this.genoma.eficiencia : 1;
      if (a) {
        const exitoFrac = U.clamp((a.ganado || 0) / Math.max(1, esperado), 0, 1);
        this.exitoEMA = U.clamp(this.exitoEMA + PL.EMA_EXITO * (exitoFrac - this.exitoEMA), 0, 1);
        this.sin.intentos++;
        if (exitoFrac < 0.25) this.expectativa = U.clamp(this.expectativa - PL.GOLPE_FRACASO, 0, 1);
        else this.expectativa = U.clamp(this.expectativa + PL.EMA_EXITO * (1 - this.expectativa), 0, 1);
      }
      this.ultimoExito = 'pasto';
      if (exito) this.aprenderZona('pasto', this.x, this.y, 0.8);
      this.accion = null; this.objetivo = null;
    }

    /* ---------------- Movimiento ------------------------------------- */
    moverse(dtS, mundo) {
      let destino = null, entidad = null;
      if (this.objetivo) {
        if (this.objetivo.ref && this.objetivo.ref.vivo !== undefined) {
          if (!this.objetivo.ref.vivo) { this.objetivo.invalido = true; return; }
          destino = { x: this.objetivo.ref.x, y: this.objetivo.ref.y };
          entidad = this.objetivo.ref;
        } else destino = { x: this.objetivo.x, y: this.objetivo.y };
      }
      if (!destino) return;

      let vel = this.velPx();
      if (this.objetivo.tipo === 'cazar') vel *= CAZA.VEL_MULT;
      if (this.objetivo.tipo === 'agua-terminal') vel *= 1.5;
      if (this.huyendo) vel *= 1.28;
      if (this.sin.agotado) vel *= 0.75;
      if (this.sin.deprimido) vel *= 0.82;
      if (this.sin.alienado) vel *= 0.7;

      const dx = destino.x - this.x, dy = destino.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const llegada = this.objetivo.tipo === 'cazar' ? CAZA.CAPTURA_PX
        : this.objetivo.tipo === 'agua' ? mundo.TILE * 1.6 : 13;

      // ¿Llegó? (para agua: basta estar en tile con agua adyacente)
      const tAqui = mundo.tileEn(this.x, this.y);
      const enAgua = this.objetivo.tipo === 'agua' || this.objetivo.tipo === 'agua-terminal';
      const juntoAlAgua = enAgua && tAqui && mundo.conAguaAdyacente(tAqui.tx, tAqui.ty);
      if (d < llegada || (juntoAlAgua && d < mundo.TILE * 2.4)) { this.llegar(mundo); return; }

      // Dirección deseada con esquiva de obstáculos (correcciones = I1)
      const angDeseado = Math.atan2(dy, dx);
      let ang = angDeseado;
      const prueba = 24;
      const rots = [0, 0.55, -0.55, 1.15, -1.15, 1.9, -1.9, Math.PI];
      for (const r of rots) {
        const a2 = angDeseado + r;
        const px = this.x + Math.cos(a2) * prueba, py = this.y + Math.sin(a2) * prueba;
        const tp = mundo.tileEn(px, py);
        if (tp && !mundo.esBloqueado(tp.tx, tp.ty)) { ang = a2; if (r !== 0 && this.tSim - this.ultCorreccion > 1.5) { this.ag.correcciones++; this.ultCorreccion = this.tSim; } break; }
      }
      this.dir = ang;
      const paso = vel * dtS;
      const nx = this.x + Math.cos(ang) * paso, ny = this.y + Math.sin(ang) * paso;
      const tn = mundo.tileEn(nx, ny);
      if (tn && !mundo.esBloqueado(tn.tx, tn.ty)) { this.x = nx; this.y = ny; }
      else if (!tn) { this.x = U.clamp(nx, 8, mundo.Wpx - 8); this.y = U.clamp(ny, 8, mundo.Hpx - 8); }
      else {
        // [P] v1.2: el agua y la roca no se pisan — jamás. Antes este rama
        // dejaba entrar a la criatura en el tile bloqueado («caminar sobre el
        // agua"). Ahora solo queda el micro-deslizamiento costero: probar
        // desviaciones del paso y moverse por la primera libre.
        for (const desv of [0.9, -0.9, 1.7, -1.7, Math.PI]) {
          const ax = this.x + Math.cos(ang + desv) * paso;
          const ay = this.y + Math.sin(ang + desv) * paso;
          const ta = mundo.tileEn(ax, ay);
          if (ta && !mundo.esBloqueado(ta.tx, ta.ty)) { this.x = ax; this.y = ay; break; }
        }
      }

      // Estancamiento → invalidar (la reflexiva replanifica; robustez = I2)
      // [P] v1.2: el umbral de progreso escala con la velocidad propia: caminar
      // despacio hacia la meta SÍ es progreso; estancarse es no acercarse.
      const mejoraMin = Math.max(1.2, vel * dtS * 0.45);
      if (d > this.ultDistDest - mejoraMin) this.tEstancada += dtS; else this.tEstancada = 0;
      this.ultDistDest = d;
      if (this.tEstancada > 7) {
        this.objetivo.invalido = true; this.tEstancada = 0; this.ultDistDest = 1e9;
        // [P] v1.2: aprender del bloqueo — esa meta no se alcanza desde aquí
        // (el agua o la roca lo impiden). Se recuerda un rato y se deja de
        // elegirla, en lugar de empujar el obstáculo hasta agotarse.
        const tipoObj = this.objetivo.tipo;
        if (!this.huyendo && tipoObj !== 'cazar' && tipoObj !== 'cortejo') {
          this.registrarMetaFallida(destino.x, destino.y, tipoObj);
        }
      }

      // Caza: captura
      if (this.objetivo.tipo === 'cazar' && entidad) {
        const dc = U.dist(this.x, this.y, entidad.x, entidad.y);
        if (dc < CAZA.CAPTURA_PX + entidad.tamActual() * 6) {
          const daño = CAZA.DAÑO * this.tamActual();
          entidad.peligroReciente = true;
          entidad.herir(daño, 'depredación');
          if (!entidad.vivo) {
            const g = CUERPO.GANANCIA_CAZA * entidad.tamActual() * this.genoma.eficiencia;
            this.B = Math.min(this.maxB(), this.B + g);
            this.cazas++;
            this.biografiaEvento('caza', 'Caza exitosa sobre ' + entidad.nombre + '.');
            this.aprenderZona('seguridad', this.x, this.y, 0.9);
          }
          this.objetivo = null;
          this.fijarAccion('descansar', 3.5);
        } else if (this.tSim - this.objetivo.desde > 20) {
          this.fatiga = U.clamp(this.fatiga + 0.3, 0, 1);
          this.expectativa = U.clamp(this.expectativa - PL.GOLPE_FRACASO, 0, 1);
          this.objetivo = null;
          this.fijarAccion('descansar', 3);
        }
      }
      // Cortejo: aproximación
      if (this.objetivo && this.objetivo.tipo === 'cortejo' && entidad) {
        const dc = U.dist(this.x, this.y, entidad.x, entidad.y);
        if (dc < 30) {
          const ambos = !entidad.accion || entidad.accion.tipo !== 'ritual';
          if (ambos && entidad.cooldownRepro <= 0 && entidad.fracB() > 0.4) {
            this.fijarAccion('ritual', 4, { pareja: entidad.id });
            entidad.fijarAccion('ritual', 4, { pareja: this.id });
            this.biografiaEvento('cortejo', 'Cortejo con ' + entidad.nombre + '.');
          } else { this.objetivo = null; }
        }
      }
      // Polvo al correr
      if ((this.huyendo || (this.objetivo && this.objetivo.tipo === 'cazar')) && this.tSim % 0.28 < dtS) {
        U.bus.emitir('fx', { tipo: 'polvo', x: this.x - Math.cos(this.dir) * 10, y: this.y - Math.sin(this.dir) * 10 });
      }
      this.anim.fase += vel * dtS * 0.135;
    }

    llegar(mundo) {
      const tipo = this.objetivo.tipo;
      this.ultDistDest = 1e9;
      if (this.objetivo.replan) { this.ag.robustez++; this.objetivo.replan = false; }
      switch (tipo) {
        case 'pasto': this.fijarAccion('comer', 6 + this.rng.siguiente() * 4, { hasta0: 8 }); this.objetivo = null; break;
        case 'comedero': {
          const com = this.objetivo.com;
          if (com && com.raciones > 0) {
            const raciones = Math.min(com.raciones, 1 + Math.floor(this.tamActual()));
            mundo.comerDeComedero(com, raciones);
            const g = raciones * CUERPO.RACION_COMEDERO * this.genoma.eficiencia * this.placeboMult();
            this.B = Math.min(this.maxB(), this.B + g);
            this.expectativa = U.clamp(this.expectativa + 0.08, 0, 1);
            this.biografiaEvento('comedero', 'Come del comedero: la expectativa sube.');
          } else {
            this.expectativa = U.clamp(this.expectativa - PL.GOLPE_FRACASO, 0, 1); // nocebo: comedero vacío
            this.biografiaEvento('nocebo', 'Llega a un comedero vacío: la expectativa cae.');
          }
          this.accion = null; this.objetivo = null;
          break;
        }
        case 'agua': this.fijarAccion('beber', 5); this.objetivo = null; break;
        case 'agua-terminal': this.fijarAccion('beber', 6); break;
        case 'carroña': this.fijarAccion('carroñar', 7); this.objetivo = null; break;
        case 'descansar': this.fijarAccion('descansar', 5 + this.rng.siguiente() * 4); this.objetivo = null; break;
        case 'explorar': {
          const t = mundo.tileEn(this.x, this.y);
          if (t) {
            this.doctrina.marcarVisita(t.tx, t.ty);
            this.aprenderZona(mundo.bio[t.i] > 0.2 ? 'pasto' : 'seguridad', this.x, this.y, 0.5);
            this.ag.aprendizajes++;
          }
          this.fijarAccion('descansar', 2.5); this.objetivo = null;
          break;
        }
        case 'huida': this.objetivo = null; this.huyendo = false; break;
        case 'rastrear':
        case 'migrar-agua': {
          const tm = mundo.tileEn(this.x, this.y);
          if (tm) {
            this.doctrina.marcarVisita(tm.tx, tm.ty);
            this.ag.aprendizajes++;
          }
          this.fijarAccion('descansar', 2);
          this.objetivo = null;
          break;
        }
        default: this.objetivo = null;
      }
    }

    /* ---------------- Daño, muerte y legado -------------------------- */
    herir(daño, causa) {
      if (!this.vivo) return;
      this.I = U.clamp(this.I - daño, 0, 1);
      this.causaI = causa;
      if (this.I <= 0) this.morir(causa);
    }

    morir(causa) {
      if (!this.vivo) return;
      this.vivo = false;
      this.causaMuerte = causa;
      this.cicloMue = this.cicloActual;
      mundoGlobal().depositarRestos(this.x, this.y, this.tamActual(), this.cicloActual);
      this.biografiaEvento('muere', 'Muere por ' + causa + ' en el ciclo ' + this.cicloActual + '.');
      TRI.registrarTransicion('disolucion', this);
      U.bus.emitir('fx', { tipo: 'disolucion', x: this.x, y: this.y });
      U.bus.emitir('criatura:muere', { c: this, causa });
    }

    /* ---------------- Fin de ciclo: edad, síndromes, homeostasis ----- */
    finDeCiclo(mundo) {
      if (!this.vivo) return;
      this.edadCiclos++;
      if (this.edadSuave < this.edadCiclos) this.edadSuave = this.edadCiclos; // invariant de crecimiento
      // La cría se hace adulta: se narra una sola vez y brilla al alcanzar su tamaño [P]
      if (!this.adulta && this.esAdulto()) {
        this.adulta = true;
        this.biografiaEvento('crece', 'Se hace adulta: alcanza su tamaño definitivo.');
        for (let i = 0; i < 8; i++) {
          const an = (i / 8) * Math.PI * 2;
          U.bus.emitir('fx', { tipo: 'brillo', x: this.x + Math.cos(an) * 10, y: this.y + Math.sin(an) * 7 });
        }
      }
      if (this.cooldownRepro > 0) this.cooldownRepro--;
      // Homeostasis (I4): muestra por ciclo
      const homeoOk = this.fracB() > 0.25 && this.H > 0.25 ? 1 : 0;
      this.ag.homeo = Math.min(20, this.ag.homeo + homeoOk);
      this.ag.homeoMuestras = Math.min(20, this.ag.homeoMuestras + 1);
      // Vejez: la integridad se desgasta al final de la vida esperada
      if (this.edadCiclos > this.fen.vida) this.I = U.clamp(this.I - 0.07, 0, 1);

      // Síndromes del vacío [D: tesis §12.7 — agotamiento, alienación, depresión]
      const s = this.sin;
      s.bEMA = U.clamp(s.bEMA + 0.12 * (this.fracB() - s.bEMA), 0, 1);
      if (s.bEMA < 0.30) s.rachaBajaB++; else s.rachaBajaB = 0;
      const sinRecursos = this.doctrina.cobertura() < 0.18 && !this.objetivo;
      if (this.fracB() > 0.5 && sinRecursos) s.rachaSinMeta++; else s.rachaSinMeta = 0;
      const fracaso = s.intentos > 2 && this.exitoEMA < 0.25;
      if (fracaso) s.rachaFracaso++; else s.rachaFracaso = 0;
      s.intentos = Math.max(0, s.intentos - 1);

      const antes = { agotado: s.agotado, alienado: s.alienado, deprimido: s.deprimido };
      s.agotado = s.rachaBajaB >= 3;
      s.alienado = s.rachaSinMeta >= 3;
      s.deprimido = s.rachaFracaso >= 3;
      for (const clave of ['agotado', 'alienado', 'deprimido']) {
        if (antes[clave] !== s[clave]) {
          this.biografiaEvento('sindrome', (s[clave] ? 'Comienza un cuadro de ' : 'Sale del cuadro de ') + clave + '.');
          U.bus.emitir('fx', { tipo: 'sindrome', x: this.x, y: this.y });
        }
      }
    }

    /* ---------------- Índice de agencia (0–12) [D: tesis, ap. A] ----- */
    agencia() {
      const a = this.ag;
      const i1 = Math.min(3, Math.floor(a.correcciones / 4));
      const i2 = Math.min(3, Math.floor(a.robustez / 3));
      const i3 = Math.min(3, Math.floor((a.anticipaciones + a.aprendizajes) / 5));
      const i4 = a.homeoMuestras > 0 ? Math.min(3, Math.floor((a.homeo / a.homeoMuestras) * 3.6)) : 0;
      const total = i1 + i2 + i3 + i4;
      return { i1, i2, i3, i4, total, banda: TRI.bandaAgencia(total) };
    }

    /* ---------------- Grados triádicos y región [D] ------------------ */
    gradosTriadicos() {
      const ag = this.agencia();
      let voluntad = ag.total / 12;
      if (!this.capas.valoracion) voluntad = Math.min(voluntad, 0.44);
      else if (!this.capas.reflexiva) voluntad = Math.min(voluntad, 0.78);
      if (!this.vivo) voluntad = 0;
      const materia = U.clamp(0.25 + 0.75 * (this.tamActual() / 1.8) * this.I, 0, 1);
      const energia = U.clamp(0.15 + 0.85 * this.fracB(), 0, 1);
      const region = TRI.regionDeGrados({ materia, energia, voluntad });
      return { materia, energia, voluntad, region };
    }

    sindromeDominante() {
      const s = this.sin;
      if (s.agotado) return 'agotamiento';
      if (s.alienado) return 'alienacion';
      if (s.deprimido) return 'depresion';
      return null;
    }

    /* ---------------- Biografía y ficha ------------------------------ */
    biografiaEvento(tipo, texto) {
      this.bio.push({ ciclo: this.cicloActual, tipo, texto });
      if (this.bio.length > 48) this.bio.shift();
      U.bus.emitir('criatura:bio', { c: this, tipo, texto });
    }

    describirObjetivo() {
      const o = this.objetivo;
      if (!o) {
        if (this.accion) return this.descripcionAccion();
        return 'sin meta activa';
      }
      const nombres = {
        pasto: 'buscar pasto', agua: 'buscar agua', 'agua-terminal': 'el último trago',
        comedero: 'ir al comedero', carroña: 'buscar carroña', cazar: 'cazar',
        rastrear: 'rastrear un olor', cortejo: 'cortejar', descansar: 'buscar descanso', explorar: 'explorar', huida: 'huir',
        'migrar-agua': 'migrar hacia la humedad',
      };
      const extra = o.ref ? ' (' + o.ref.nombre + ')' : '';
      return (nombres[o.tipo] || o.tipo) + extra;
    }
    descripcionAccion() {
      const nombres = {
        comer: 'pastando', beber: 'bebiendo', descansar: 'descansando', dormir: 'durmiendo',
        esconder: 'escondida', congelarse: 'inmóvil (veto)', ritual: 'ritual de cortejo', carroñar: 'carroñando',
      };
      return nombres[this.accion.tipo] || this.accion.tipo;
    }

    ficha() {
      const g = this.gradosTriadicos();
      const reg = TRI.region(g.region);
      return {
        id: this.id, nombre: this.nombre, especie: this.fen.especie, dieta: this.fen.dieta,
        sexo: this.sexo, vivo: this.vivo, causaMuerte: this.causaMuerte,
        edadCiclos: this.edadCiclos, esperanza: this.fen.vida, cicloNac: this.cicloNac, cicloMue: this.cicloMue,
        genoma: this.genoma, fenotipo: this.fen,
        b: this.fracB(), h: this.H, i: this.I,
        capas: { ...this.capas },
        objetivo: this.describirObjetivo(),
        expectativa: this.expectativa,
        agencia: this.agencia(),
        sindrome: this.sindromeDominante(),
        crias: this.crias.slice(), padres: this.padres ? this.padres.map((p) => p.id) : null,
        bio: this.bio.slice(-14).reverse(),
        grados: g, regionNombre: reg.nombre, regionId: g.region,
        cazas: this.cazas, casiCazada: this.casiCazada,
        doctrinaCobertura: this.doctrina.cobertura(),
      };
    }

    /* ---------------- Serialización ---------------------------------- */
    serializar() {
      return {
        id: this.id, nombre: this.nombre, genoma: this.genoma,
        doctrina: this.doctrina.serializar(),
        x: Math.round(this.x), y: Math.round(this.y), dir: +this.dir.toFixed(2),
        edadCiclos: this.edadCiclos, sexo: this.sexo,
        B: Math.round(this.B), H: +this.H.toFixed(3), I: +this.I.toFixed(3),
        fatiga: +this.fatiga.toFixed(3), expectativa: +this.expectativa.toFixed(3), exitoEMA: +this.exitoEMA.toFixed(3),
        capas: { ...this.capas },
        vivo: this.vivo, causaMuerte: this.causaMuerte,
        cicloNac: this.cicloNac, cicloMue: this.cicloMue,
        cooldownRepro: this.cooldownRepro, crias: this.crias.slice(),
        padres: this.padres ? this.padres.map((p) => p.id) : null,
        cazas: this.cazas, casiCazada: this.casiCazada, vetoTerminalHecho: this.vetoTerminalHecho,
        ag: { ...this.ag },
        sin: { bEMA: +this.sin.bEMA.toFixed(3), agotado: this.sin.agotado, alienado: this.sin.alienado, deprimido: this.sin.deprimido, rachaBajaB: this.sin.rachaBajaB, rachaSinMeta: this.sin.rachaSinMeta, rachaFracaso: this.sin.rachaFracaso, intentos: this.sin.intentos },
        bio: this.bio.slice(-24),
        tSim: +this.tSim.toFixed(1),
      };
    }
    static deserializar(o) {
      const c = Object.create(Criatura.prototype);
      c.rng = U.RNG((Math.random() * 2147483647) | 0);
      c.id = o.id; c.nombre = o.nombre; c.genoma = o.genoma;
      c.fen = G.fenotipo(o.genoma);
      c.doctrina = G.Doctrina.deserializar(o.doctrina);
      c.x = o.x; c.y = o.y; c.dir = o.dir || 0;
      c.edadCiclos = o.edadCiclos; c.edadSuave = o.edadCiclos || 0; c.adulta = c.edadCiclos >= REP.ADULTO; c.sexo = o.sexo;
      c.B = o.B; c.H = o.H; c.I = o.I;
      c.fatiga = o.fatiga; c.expectativa = o.expectativa; c.exitoEMA = o.exitoEMA;
      c.capas = o.capas;
      c.objetivo = null; c.accion = null;
      c.vivo = o.vivo; c.causaMuerte = o.causaMuerte; c.causaI = null;
      c.cicloNac = o.cicloNac; c.cicloActual = o.cicloNac; c.cicloMue = o.cicloMue;
      c.cooldownRepro = o.cooldownRepro; c.crias = o.crias || []; c.padres = null; // los padres se re-vinculan tras cargar
      c.cazas = o.cazas || 0; c.casiCazada = o.casiCazada || 0;
      c.vetoTerminalHecho = !!o.vetoTerminalHecho;
      c.tSim = o.tSim || 0;
      c.acumReflejo = 0; c.acumVal = 0; c.acumRef = 0;
      c.ultCorreccion = -9; c.ultDistDest = 1e9; c.tEstancada = 0;
      c.metaFallida = null; // [P] v1.2: la memoria de metas fallidas no se guarda; al cargar, parte limpia
      c.ultDevTotal = (1 - c.fracB()) + (1 - c.H);
      c.huyendo = false; c.depurador = null; c.peligroReciente = false; c.ultimoExito = null;
      c.ag = Object.assign({ correcciones: 0, robustez: 0, anticipaciones: 0, aprendizajes: 0, homeo: 0, homeoMuestras: 1 }, o.ag);
      c.sin = Object.assign({ bEMA: 0.8, agotado: false, alienado: false, deprimido: false, rachaBajaB: 0, rachaSinMeta: 0, rachaFracaso: 0, intentos: 0 }, o.sin);
      c.anim = { fase: Math.random() * 10, parpadeo: 2 + Math.random() * 4, bob: 0, squash: 1 };
      c.bio = o.bio || [];
      c.padresIds = o.padres || null;
      return c;
    }
  }

  /* Referencia global al mundo (para aprenderZona/morir sin acoplar). */
  let _mundo = null;
  Criatura.fijarMundo = (m) => { _mundo = m; };
  function mundoGlobal() { return _mundo; }

  window.BIOS.Criatura = Criatura;
})();
