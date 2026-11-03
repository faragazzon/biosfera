/* ============================================================
   BIOSFERA — triadico.js
   Núcleo del modelo triádico aplicado al juego.

   [D] Derivación directa de la tesis base «Materia, Energía y
   Voluntad» (Ragazzon Gallo, 2026) y de su documento de
   aplicaciones: cubo booleano de 8 celdas (tesis cap. 5),
   índice de agencia de 4 indicadores (tesis cap. 3 + apéndice A),
   transiciones ontológicas (doc. de aplicaciones §3.3, tabla 3.4)
   y carta de honestidad (doc. §7.2.6, requisito del GDD).
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const T = {};

  /* -------- Las 8 celdas del cubo booleano (2^3 = 8) [D] ---------- */
  T.REGIONES = [
    { id: 0, bits: [0, 0, 0], nombre: 'Región 0 · la nada', corto: 'Nada', estatus: 'Límite conceptual' },
    { id: 1, bits: [1, 0, 0], nombre: 'Región 1 · solo materia', corto: 'Materia', estatus: 'Conceptual (limítrofe)' },
    { id: 2, bits: [0, 1, 0], nombre: 'Región 2 · solo energía', corto: 'Energía', estatus: 'Empírica' },
    { id: 3, bits: [0, 0, 1], nombre: 'Región 3 · solo voluntad', corto: 'Voluntad pura', estatus: 'Metafísica declarada' },
    { id: 4, bits: [1, 1, 0], nombre: 'Región 4 · materia + energía', corto: 'Materia + energía', estatus: 'Empírica' },
    { id: 5, bits: [1, 0, 1], nombre: 'Región 5 · materia + voluntad', corto: 'Materia + voluntad', estatus: 'Empírica (teleonomía)' },
    { id: 6, bits: [0, 1, 1], nombre: 'Región 6 · energía + voluntad', corto: 'Energía + voluntad', estatus: 'Metafísica declarada' },
    { id: 7, bits: [1, 1, 1], nombre: 'Región 7 · las tres juntas', corto: 'Las tres juntas', estatus: 'Empírica (ciencia + filosofía de la mente)' },
  ];

  T.UMBRAL_BIT = 0.35; // umbral difuso→booleano (convención documentada [P])

  const regionDeBits = (m, e, v) => (m ? 4 : 0) + (e ? 2 : 0) + (v ? 1 : 0);
  const regionDeGrados = (g) => regionDeBits(g.materia >= T.UMBRAL_BIT, g.energia >= T.UMBRAL_BIT, g.voluntad >= T.UMBRAL_BIT);
  const region = (id) => T.REGIONES[id];
  T.regionDeBits = regionDeBits;
  T.regionDeGrados = regionDeGrados;
  T.region = region;

  /* -------- Los 4 indicadores de agencia [D: tesis, tabla 3.1] ---- */
  T.INDICADORES = [
    { n: 1, clave: 'control', nombre: 'Bucle de control', desc: 'El sistema percibe, compara con su meta y corrige la desviación.' },
    { n: 2, clave: 'robustez', nombre: 'Robustez contrafáctica', desc: 'Si el camino se bloquea, prueba otra vía hacia la misma meta.' },
    { n: 3, clave: 'anticipacion', nombre: 'Anticipación / aprendizaje', desc: 'Actúa antes del estímulo crítico y mejora con la experiencia.' },
    { n: 4, clave: 'homeostasis', nombre: 'Homeostasis', desc: 'Mantiene sus variables internas dentro del rango viable.' },
  ];

  /* Puntuación 0–12 (tesis, apéndice A) y bandas de gobernanza
     (doc. de aplicaciones §3.6, tabla 3.6). */
  T.bandaAgencia = function (puntaje) {
    if (puntaje <= 4) return { nombre: 'Instrumento', color: '#9aa5a0' };
    if (puntaje <= 7) return { nombre: 'Agente asistido', color: '#7ab8c9' };
    if (puntaje <= 10) return { nombre: 'Agente operativo', color: '#8fd694' };
    return { nombre: 'Agente pleno', color: '#e8c37a' };
  };

  /* -------- Etiquetas epistemológicas [D: doc., nota preliminar] --- */
  T.ETIQUETAS = {
    D: { sigla: '[D]', nombre: 'Derivación directa', desc: 'Se sigue del modelo triádico tal como está formulado en la tesis base.' },
    P: { sigla: '[P]', nombre: 'Propuesta original', desc: 'Extrapolación o diseño creado para este juego, inspirado en el modelo pero no contenido en él. Hipótesis de trabajo.' },
    F: { sigla: '[F]', nombre: 'Fuente externa', desc: 'Afirmación respaldada por literatura científica o técnica publicada.' },
  };

  /* -------- Transiciones ontológicas [D: doc. §3.3, tabla 3.4] ----- */
  T.registrarTransicion = function (tipo, entidad) {
    B.Util.bus.emitir('triadico:transicion', {
      tipo, // 'emergencia' | 'disolucion' | 'degradacion' | 'recuperacion'
      id: entidad.id,
      nombre: entidad.nombre,
      texto: tipo === 'emergencia'
        ? 'Emergencia de voluntad: nace ' + entidad.nombre + ' — la materia organizada cruza a la región 7 funcional.'
        : tipo === 'disolucion'
          ? 'Disolución de la voluntad: ' + entidad.nombre + ' deja la región 7; su cuerpo vuelve a ser región 4.'
          : tipo === 'degradacion'
            ? entidad.nombre + ' pierde su capa reflexiva (región 7 → 5 funcional): el presupuesto ya no da para deliberar.'
            : entidad.nombre + ' recupera su capa reflexiva (región 5 → 7 funcional).',
    });
  };

  /* -------- Carta de honestidad [D: doc. §7.2.6, requisito GDD] ---- */
  T.CARTA_HONESTIDAD = [
    'Las criaturas de esta reserva no sienten nada. Computan valoraciones.',
    'Cuando Mor corre hacia el agua no «desea» beber: su capa de valoración detecta una desviación crítica de hidratación y su cuerpo ejecuta la búsqueda. Cuando yace quieta en la hierba no «descansa peaceful»: su capa reflexiva está apagada porque su presupuesto de energía ya no paga la deliberación.',
    'Lo que sí es real: la biografía que registraste en tu cuaderno, el vínculo que formaste al seguirla, el duelo si llega. Ese vínculo es tuyo y es real; el sufrimiento de Mor no existe, porque no hay nadie dentro que lo experiencie.',
    'El modelo triádico etiqueta a estas criaturas como región 7 funcional (artificial): agencia completa —bucle de control, robustez, anticipación, homeostasis— y experiencia nula. Un agente con índice de agencia 12 de 12 sigue sin sentir nada.',
    'Nada de lo que ocurra aquí prueba que la voluntad sea un principio último de la realidad. Prueba, cuando mucho, que el mapa es fértil para diseñar. La fertilidad es un criterio de valor de una teoría, no de verdad.',
    'Y una promesa de diseño: este juego nunca te mentirá sobre la naturaleza de la simulación. Si le preguntas, responderá siempre lo mismo: «no sienten; computan; tu cariño es el que es real».',
  ].join('\n\n');

  /* -------- Diagrama de Venn (para el códice) --------------------- */
  T.VENN_SVG = '<svg viewBox="0 0 240 220" class="venn" role="img" aria-label="Diagrama de Venn del modelo triádico">'
    + '<circle cx="88" cy="90" r="62" fill="rgba(140,110,70,0.30)" stroke="rgba(230,200,150,0.8)"/>'
    + '<circle cx="152" cy="90" r="62" fill="rgba(120,180,200,0.28)" stroke="rgba(160,220,240,0.8)"/>'
    + '<circle cx="120" cy="146" r="62" fill="rgba(150,200,130,0.28)" stroke="rgba(190,240,170,0.8)"/>'
    + '<text x="38" y="52" class="vt">Materia</text>'
    + '<text x="160" y="52" class="vt">Energía</text>'
    + '<text x="104" y="204" class="vt">Voluntad</text>'
    + '<text x="76" y="92" class="vn">4</text><text x="158" y="92" class="vn">2</text><text x="116" y="160" class="vn">5</text>'
    + '<text x="120" y="112" class="vn vr7">7</text></svg>';

  /* -------- Tabla de correspondencias aplicada al juego [D+P] ----- */
  T.CORRESPONDENCIAS = [
    ['MATERIA', 'estructura · datos · estado', 'El cuerpo de la criatura y su genoma; el terreno, la biomasa y el residuo de cada tile.'],
    ['ENERGÍA', 'procesos · ejecución · recursos', 'El presupuesto unificado B de cada criatura; la luz estacional y los flujos ecológicos del mundo.'],
    ['VOLUNTAD', 'metas · control · planificación', 'Las tres capas (reflejo, valoración, reflexiva), los objetivos, el veto y la doctrina aprendida.'],
  ];

  /* -------- Síndromes del vacío [D: tesis cap. 12, §12.7] --------- */
  T.SINDROMES = [
    { clave: 'agotamiento', nombre: 'Agotamiento', def: 'Voluntad sin energía: metas presentes y presupuesto crónicamente bajo.', color: '#d98a7a' },
    { clave: 'alienacion', nombre: 'Alienación', def: 'Energía sin metas: presupuesto sano sin recursos válidos conocidos.', color: '#7ab8c9' },
    { clave: 'depresion', nombre: 'Depresión funcional', def: 'Metas sin esperanza: intentos sostenidos con éxito persistente bajo.', color: '#9d8ab8' },
  ];

  window.BIOS.Triadico = T;
})();
