/* ============================================================
   BIOSFERA — poblacion.js
   Gestión de la población: rejilla espacial para consultas de
   vecindad, nacimientos con legado, estadísticas y el bucle de
   actualización de todas las criaturas.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;
  const G = B.Genoma;
  const TRI = B.Triadico;

  class Poblacion {
    constructor(mundo, semilla) {
      this.mundo = mundo;
      this.rng = U.RNG((semilla ^ 0x51ED270B) >>> 0);
      this.lista = [];
      this.rejilla = new Map();
      this.cicloActual = 0;
      this.tCiclo = 0;
      this.nacimientos = 0;
      this.muertes = { inanición: 0, sed: 0, depredación: 0, heridas: 0, vejez: 0, total: 0 };
      this.vetosTerminales = 0;
      this._memorableVisto = new Set();
    }

    /* ---------------- Creación inicial ------------------------------ */
    crearInicial() {
      const usados = new Set();
      const vivos = [];
      // Forrajeros dispersos: muestreo amplio y elección del más lejano [P]
      // [P] v1.2: la siembra inicial es un rebaño reproductor (mayoría adulta):
      // si casi todas son crías, la tasa de natalidad no alcanza a sostener
      // a la pareja de cazadores y el rebaño se hunde en los primeros ciclos.
      for (let i = 0; i < C.POB.INICIAL_HERB; i++) {
        const p = this.puntoDisperso(vivos, 0.65, 1.35);
        if (!p) continue;
        const g = G.aleatorio(this.rng);
        g.tam = U.clamp(g.tam, 0.6, 1.32);
        const c = new B.Criatura({
          genoma: g, x: p.x, y: p.y, rng: this.rng, usados, ciclo: 0, edad: this.rng.entero(12, 30),
        });
        this.agregar(c); vivos.push(c);
      }
      // La pareja fundadora de cazadores llega junta (territorio compartido)
      // y lejos del grupo de forrajeros: se evita el banquete inicial [P].
      // v1.2: con un solo fundador jamás hay segunda generación; ahora son
      // macho y hembra del mismo linaje, adultos, para poder fundar población.
      let anclaCarn = null, genFundador = null, sexoFundador = null;
      for (let i = 0; i < C.POB.INICIAL_CARN; i++) {
        const p = anclaCarn
          ? this.puntoPareja(anclaCarn, vivos)              // junto a su pareja
          : this.puntoTerritorio(vivos);                    // territorio propio, lejos de las presas
        if (!p) continue;
        // El segundo miembro nace del mismo linaje con variación individual:
        // compatibilidad genética garantizada (misma especie) [P]
        const g = genFundador
          ? G.mezclar(genFundador, genFundador, this.rng)
          : G.aleatorio(this.rng);
        g.tam = U.clamp(g.tam, 1.45, 1.8);
        g.velocidad = U.clamp(g.velocidad + 0.15, 0.3, 0.95);
        const c = new B.Criatura({
          genoma: g, x: p.x, y: p.y, rng: this.rng, usados, ciclo: 0,
          edad: this.rng.entero(16, 22),   // adultos jóvenes: listos para cortejar
          sexo: genFundador ? (sexoFundador === 'H' ? 'M' : 'H') : undefined,
        });
        if (!genFundador) { genFundador = g; sexoFundador = c.sexo; }
        c.cooldownRepro = 0; // [P] v1.2: pareja asentada — cría en su primera temporada
        this.agregar(c); vivos.push(c);
        anclaCarn = p;
      }
      return this;
    }

    /* Punto de nacimiento que maximiza la distancia mínima a los vivos. */
    puntoDisperso(vivos, tamMin, tamMax, minDeseada) {
      let mejor = null, mejorD = -1;
      for (let intento = 0; intento < 40; intento++) {
        const p = this.puntoNacimiento(tamMin, tamMax);
        if (!p) continue;
        let dMin = Infinity;
        for (const v of vivos) dMin = Math.min(dMin, U.dist(p.x, p.y, v.x, v.y));
        if (dMin > mejorD) { mejorD = dMin; mejor = p; }
        if (minDeseada && dMin >= minDeseada) return p;
      }
      return mejor || this.puntoNacimiento(tamMin, tamMax);
    }

    /* Territorio de la pareja fundadora: tile libre con agua alcanzable a pie,
       sin requisito de pasto (los cazadores no pastan), lo más lejos posible
       de las presas — se evita el banquete inicial. [P]
       [P] v1.2.1: el territorio debe estar en una isla suficientemente grande
       Y con presas (misma tierra firme que el rebaño): una isla sin presas es
       un territorio de hambre segura. El punto se busca por barrido exhaustivo
       (determinista, óptimo en distancia) en vez de muestreo aleatorio. */
    puntoTerritorio(vivos) {
      const islasPresas = new Set();
      for (const v of vivos) {
        const t = this.mundo.tileEn(v.x, v.y);
        if (t) islasPresas.add(this.mundo.idIsla[t.i]);
      }
      let mejor = null, mejorD = -1;
      for (let ty = 2; ty < this.mundo.H - 2; ty++) {
        for (let tx = 2; tx < this.mundo.W - 2; tx++) {
          if (this.mundo.esBloqueado(tx, ty)) continue;
          const i = this.mundo.idx(tx, ty);
          if (this.mundo.tamIsla[i] < C.POB.MIN_ISLA) continue;
          if (islasPresas.size && !islasPresas.has(this.mundo.idIsla[i])) continue;
          if (this.mundo.distAgua[i] > 14) continue;
          const c = this.mundo.centroTile(tx, ty);
          let dMin = Infinity;
          for (const v of vivos) dMin = Math.min(dMin, U.dist(c.x, c.y, v.x, v.y));
          if (dMin > mejorD) { mejorD = dMin; mejor = c; }
        }
      }
      if (mejor) return mejor;
      return this.puntoNacimiento(1.45, 1.8);   // degenerado: colocación global
    }

    /* Punto de nacimiento junto a la pareja fundadora: dentro del territorio
       (disco de 7 tiles del ancla; 12 como respaldo), sobre la MISMA isla
       (un brazo de agua entre ambos sería una pareja de hecho separada) y,
       de los puntos válidos, el más lejano de las presas — se conserva el
       aire del territorio. [P] v1.2.1 */
    puntoPareja(ancla, presas) {
      const m = this.mundo;
      const tA = m.tileEn(ancla.x, ancla.y);
      if (!tA) return this.puntoNacimiento(1.45, 1.8);
      const islaAncla = m.idIsla[tA.i];
      for (const R of [7, 12]) {
        let mejor = null, mejorD = -1;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > R * R) continue;    // disco, no cuadrado
            const tx = tA.tx + dx, ty = tA.ty + dy;
            if (!m.dentro(tx, ty) || m.esBloqueado(tx, ty)) continue;
            const i = m.idx(tx, ty);
            if (m.idIsla[i] !== islaAncla) continue;    // misma isla
            if (m.distAgua[i] > 14) continue;           // agua alcanzable a pie
            const c = m.centroTile(tx, ty);
            let dMin = Infinity;
            for (const p of presas) dMin = Math.min(dMin, U.dist(c.x, c.y, p.x, p.y));
            if (dMin > mejorD) { mejorD = dMin; mejor = c; }
          }
        }
        if (mejor) return mejor;
      }
      return this.puntoNacimiento(1.45, 1.8);  // degenerado: colocación global
    }

    puntoNacimiento(tamMin, tamMax) {
      for (let intento = 0; intento < 220; intento++) {
        const tx = this.rng.entero(2, this.mundo.W - 3);
        const ty = this.rng.entero(2, this.mundo.H - 3);
        if (this.mundo.esBloqueado(tx, ty)) continue;
        const i = this.mundo.idx(tx, ty);
        if (this.mundo.bio[i] < 0.18) continue;
        if (this.mundo.distAgua[i] > 6) continue;
        // [P] v1.2.1: nunca en un islote minúsculo — criatura encarcelada
        if (this.mundo.tamIsla[i] < C.POB.MIN_ISLA) continue;
        const c = this.mundo.centroTile(tx, ty);
        return { x: c.x, y: c.y };
      }
      // Respaldo: tile libre de la isla mayor con más pasto (nunca un islote)
      let mejor = null, mejorBio = -1;
      for (let ty = 1; ty < this.mundo.H - 1; ty++) for (let tx = 1; tx < this.mundo.W - 1; tx++) {
        if (this.mundo.esBloqueado(tx, ty)) continue;
        if (this.mundo.islaDe(tx, ty) !== this.mundo.mayorIslaId) continue;
        const bio = this.mundo.bio[this.mundo.idx(tx, ty)];
        if (bio > mejorBio) { mejorBio = bio; mejor = { tx, ty }; }
      }
      if (mejor) { const c = this.mundo.centroTile(mejor.tx, mejor.ty); return { x: c.x, y: c.y }; }
      // Degenerado total: cualquier tile libre
      for (let ty = 1; ty < this.mundo.H - 1; ty++) for (let tx = 1; tx < this.mundo.W - 1; tx++) {
        if (!this.mundo.esBloqueado(tx, ty)) {
          const c = this.mundo.centroTile(tx, ty);
          return { x: c.x, y: c.y };
        }
      }
      return null;
    }

    /* ---------------- Nacimiento con legado [D] --------------------- */
    nacimiento(genoma, doctrina, x, y, padres) {
      if (this.contar().total >= C.POB.CAP) return null;
      // Tope ecológico de cazadores: el territorio sostiene pocos depredadores [P]
      if (genoma.tam >= 1.4 && this.contar().carn >= C.POB.CARN_CAP) return null;
      // [P] v1.2: la cría nace en tile libre — nunca sobre agua o roca.
      // La madre puede parir pegada a la orilla y el desfase aleatorio caer al lago.
      let px = x + this.rng.rango(-8, 8), py = y + this.rng.rango(-8, 8);
      const t = this.mundo.tileLibreCercano(px, py);
      if (t) { const c0 = this.mundo.centroTile(t.tx, t.ty); px = c0.x; py = c0.y; }
      const cria = new B.Criatura({
        genoma, doctrina, x: px, y: py,
        rng: this.rng, ciclo: this.cicloActual, edad: 0, padres,
      });
      this.agregar(cria);
      this.nacimientos++;
      if (padres) {
        padres[0].crias.push(cria.id);
        padres[1].crias.push(cria.id);
      }
      TRI.registrarTransicion('emergencia', cria);
      U.bus.emitir('fx', { tipo: 'nacimiento', x, y });
      U.bus.emitir('criatura:nace', { c: cria });
      return cria;
    }

    agregar(criatura) { this.lista.push(criatura); }

    porId(id) { return this.lista.find((c) => c.id === id) || null; }

    /* ---------------- Rejilla espacial ------------------------------ */
    reconstruirRejilla() {
      this.rejilla.clear();
      const CS = 96;
      for (const c of this.lista) {
        if (!c.vivo) continue;
        const k = ((c.x / CS) | 0) + ',' + ((c.y / CS) | 0);
        let arr = this.rejilla.get(k);
        if (!arr) { arr = []; this.rejilla.set(k, arr); }
        arr.push(c);
      }
    }

    vecinosCercanos(x, y, radioPx, filtro) {
      const CS = 96;
      const res = [];
      const r = Math.ceil(radioPx / CS);
      const cx = (x / CS) | 0, cy = (y / CS) | 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const arr = this.rejilla.get((cx + dx) + ',' + (cy + dy));
        if (!arr) continue;
        for (const c of arr) {
          if (U.dist(x, y, c.x, c.y) <= radioPx && (!filtro || filtro(c))) res.push(c);
        }
      }
      return res;
    }

    vecinoMasCercano(x, y, radioPx, filtro) {
      const vs = this.vecinosCercanos(x, y, radioPx, filtro);
      let mejor = null, md = Infinity;
      for (const c of vs) {
        const d = U.dist(x, y, c.x, c.y);
        if (d < md) { md = d; mejor = c; }
      }
      return mejor;
    }

    presasPotenciales(cazador) {
      // Olfato de caza: el rastro químico delata a las presas a distancia [P]
      const radio = cazador.radioSentido() * 2.8;
      const presas = this.vecinosCercanos(cazador.x, cazador.y, radio,
        (c) => cazador.puedeCazar(c) && (!c.accion || c.accion.tipo !== 'congelarse' || U.dist(cazador.x, cazador.y, c.x, c.y) < radio * 0.35));
      // Las crías pesan menos en la elección: la manada protege [P]
      presas.sort((a, b) => (U.dist2(cazador.x, cazador.y, a.x, a.y) + (a.esCria() ? 6400 : 0))
        - (U.dist2(cazador.x, cazador.y, b.x, b.y) + (b.esCria() ? 6400 : 0)));
      return presas;
    }

    candidatoCortejo(c) {
      // Radio ampliado de búsqueda de pareja: sin encuentros no hay linajes [P].
      // [P] v1.2: los cazadores, escasos y solitarios, rastrean pareja mucho más
      // lejos (×3): si no, la pareja fundadora se pierde tras explorar 30 s.
      const radio = c.radioSentido() * (c.fen.dieta === 'carnivoro' ? 3 : 2);
      return this.vecinoMasCercano(c.x, c.y, radio, (o) =>
        o.id !== c.id && o.vivo && o.esAdulto() && o.cooldownRepro <= 0
        && o.fen.dieta === c.fen.dieta && o.sexo !== c.sexo
        && G.compatibles(o.genoma, c.genoma) && o.fracB() > 0.5);
    }

    /* ---------------- Bucle ----------------------------------------- */
    paso(dtS, ciclo, tCiclo) {
      this.cicloActual = ciclo;
      this.tCiclo = tCiclo;
      this.reconstruirRejilla();
      const mundo = this.mundo;
      for (const c of this.lista) {
        if (c.vivo) c.paso(dtS, mundo, this);
      }
      // Limpieza de muertos al final del ciclo (los cuerpos ya son residuo)
      if (this.lista.some((c) => !c.vivo)) {
        this.lista = this.lista.filter((c) => c.vivo);
      }
    }

    finDeCiclo() {
      for (const c of this.lista) c.finDeCiclo(this.mundo);
    }

    contar() {
      let herb = 0, carn = 0;
      for (const c of this.lista) {
        if (!c.vivo) continue;
        if (c.fen.dieta === 'carnivoro') carn++; else herb++;
      }
      return { herb, carn, total: herb + carn };
    }

    /* Brújula de la reserva: materia, energía y voluntad del conjunto.
       [P] Adaptación de la brújula triádica de la tesis (cap. 13). */
    brujulaReserva(mundo) {
      const n = this.lista.length || 1;
      let bSum = 0, hSum = 0, agSum = 0, sinSum = 0;
      for (const c of this.lista) {
        bSum += c.fracB(); hSum += c.H;
        agSum += c.agencia().total / 12;
        if (c.sindromeDominante()) sinSum++;
      }
      const materia = U.clamp((mundo.biomasaMedia() * 0.6 + mundo.fertilidadMedia() * 0.4) * 10, 0, 10);
      const energia = U.clamp(mundo.luzEstacional(this.cicloActual) * 5 + (hSum / n) * 5, 0, 10);
      const voluntad = U.clamp((agSum / n) * 10 * (1 - 0.5 * (sinSum / n)), 0, 10);
      const eq = Math.max(materia, energia, voluntad) - Math.min(materia, energia, voluntad);
      return {
        materia, energia, voluntad, equilibrio: eq,
        estado: eq <= 2 ? 'equilibrio razonable' : eq <= 5 ? 'desequilibrio moderado' : 'desequilibrio severo',
        sindromes: sinSum, poblacion: this.contar(),
      };
    }

    registrarMuerte(causa) {
      this.muertes.total = (this.muertes.total || 0) + 1;
      const clave = ['inanición', 'sed', 'depredación', 'heridas', 'vejez'].includes(causa) ? causa : 'heridas';
      this.muertes[clave] = (this.muertes[clave] || 0) + 1;
    }

    serializar() {
      return {
        cicloActual: this.cicloActual,
        nacimientos: this.nacimientos,
        muertes: this.muertes,
        lista: this.lista.map((c) => c.serializar()),
      };
    }
    static deserializar(o, mundo, semilla) {
      const p = new Poblacion(mundo, semilla);
      p.cicloActual = o.cicloActual || 0;
      p.nacimientos = o.nacimientos || 0;
      p.muertes = Object.assign({ inanición: 0, sed: 0, depredación: 0, heridas: 0, vejez: 0, total: 0 }, o.muertes);
      p.lista = o.lista.map((d) => B.Criatura.deserializar(d));
      // Re-vincular padres y crías por id
      for (const c of p.lista) {
        if (c.padresIds) c.padres = c.padresIds.map((id) => p.porId(id)).filter(Boolean);
        for (const idCria of c.crias) {
          const cria = p.porId(idCria);
          if (cria && cria.padresIds && !cria.padres) {
            cria.padres = cria.padresIds.map((id) => p.porId(id)).filter(Boolean);
          }
        }
      }
      return p;
    }
  }

  window.BIOS.Poblacion = Poblacion;
})();
