/* ============================================================
   BIOSFERA — El cuaderno del naturalista
   config.js · Constantes globales del proyecto

   Implementación del Proyecto 9 «BIOSFERA» del documento de
   aplicaciones del modelo triádico (cap. 6, §6.2):
   simulación de vida con economía termodinámica, criaturas con
   tres capas de voluntad, rol de naturalista y registro de campo.

   Proyecto 100% local: HTML + CSS + JS sin dependencias externas.
   ============================================================ */
window.BIOS = window.BIOS || {};

BIOS.CONFIG = {
  VERSION: '1.2.1',
  GUARDADO_CLAVE: 'biosfera_partida_v1',
  AJUSTES_CLAVE: 'biosfera_ajustes_v1',

  MUNDO: {
    TILE: 32,
    W: 72,            // 72 × 45 tiles → 2304 × 1440 px de mundo
    H: 45,
  },

  TIEMPO: {
    PASO: 100,          // ms de simulación por paso lógico
    CICLO_MS: 70000,    // duración de un ciclo («día») a velocidad 1×
    MAX_PASOS_FRAME: 34,
    VELOCIDADES: [0, 1, 3, 8],
  },

  /* Luz estacional: período de 200 ciclos con anclas por estación.
     [D] Derivado de la tesis base (cap. 4, economía termodinámica)
     y del GDD de BIOSFERA (luz sinusoidal, período 200). */
  LUZ: { ANCLAS: [0.78, 1.0, 0.52, 0.18], PERIODO: 200 },

  /* Economía termodinámica de las criaturas.
     [D] Costes por segundo con las proporciones relativas de AGNES
     (doc. de aplicaciones §5.2): existir .4 / percibir .2 / valorar .5 /
     deliberar 2.0 / actuar .3 / aprender .1 — reescalados al ciclo de juego. */
  ECON: {
    EXISTIR: 0.26, PERCIBIR: 0.05, VALORAR: 0.06,
    DELIBERAR: 0.16, ACTUAR: 0.115, APRENDER: 0.05,
    UMBRAL_REFLEXIVA: 0.30,   // por debajo: se apaga la capa reflexiva
    UMBRAL_VALORACION: 0.10,  // por debajo: se apaga la capa de valoración
  },

  CUERPO: {
    MAXB_BASE: 40, MAXB_TAM: 62,     // presupuesto máx = 40 + 62·tamaño
    INTAKE_PASTO: 4.0,               // u/s al pastar por unidad de biomasa
    GANANCIA_CAZA: 160,              // una presa alimenta varios ciclos
    RACION_COMEDERO: 9,
    SED_TASA: 0.0032, BEBER_TASA: 0.16,
    FATIGA_SUBE: 0.02, FATIGA_BAJA: 0.10,
    VIDA_BASE: 92,                   // ciclos, modulada por metabolismo
  },

  ECOLOGIA: {
    CRECE_PASTO: 0.0058,   // biomasa/s máx = tasa·luz·fert·hum·espacio
    HONGOS_TASA: 0.010,    // residuo → fertilidad por segundo
    HONGOS_CRECE: 0.006,
    RESIDUO_CAIDA: 0.0006, // caída natural del residuo
    HUMEDAD_LLUVIA: 0.06,  // aporte por segundo de lluvia
    HUMEDAD_CAIDA: 0.002,
  },

  REPRODUCCION: {
    UMBRAL_HOLGURA: 0.62,   // fracción de B para iniciar cortejo (herbívoros)
    COSTE_MADRE: 0.35, COSTE_PADRE: 0.15,
    COOLDOWN_MADRE: 10, COOLDOWN_PADRE: 8,
    /* [P] v1.2: 12 (antes 20): la pareja fundadora alcanza a criar una segunda
       camada antes del primer valle de presas — sin esto el linaje casi nunca
       pasa de la primera generación. */
    CARN_UMBRAL: 0.80, CARN_COOLDOWN: 12,
    MIN_EDAD: 6, ADULTO: 16,
  },

  CAZA: {
    VEL_MULT: 1.55, COSTE_MULT: 2.2, CAPTURA_PX: 23,
    DAÑO: 0.5,               // daño por captura · tamaño del cazador
    CARROÑA_GAIN: 0.5,       // eficiencia comiendo residuo (carroña)
  },

  /* Mecánica placebo/nocebo: la expectativa modula la eficiencia.
     [D] Doc. de aplicaciones §6.6: resultado = capacidad × (0.75 + 0.5·expectativa). */
  PLACEBO: { EF_MIN: 0.75, EF_RANGO: 0.5, EMA_EXITO: 0.12, GOLPE_FRACASO: 0.20 },

  /* [P] v1.2: los cazadores llegan como pareja fundadora (2) — con un solo
     fundador jamás hay segunda generación. La siembra forrajera sube a 20 y
     es un rebaño reproductor para que presas y depredadores coexistan.
     [P] v1.2.1: MIN_ISLA — tamaño mínimo (en tiles) de la isla donde puede
     nacer la población inicial: nadie se siembra encarcelado en un islote
     de pocas celdas. Solo afecta a la colocación inicial. */
  POB: { INICIAL_HERB: 20, INICIAL_CARN: 2, CAP: 140, SUPRESION: 90, CARN_CAP: 4, MIN_ISLA: 40 },

  /* Bancos del naturalista: escasez honesta, no dios.
     [P] Diseño pro-voluntad (doc. §6.7): recursos limitados y visibles. */
  BANCOS: {
    SEMILLAS_INI: 6, SEMILLAS_MAX: 12, SEMILLAS_CICLO: 1,
    AGUA_CICLO: 3,
    MICELIO_INI: 3, MICELIO_MAX: 6, MICELIO_CICLO: 5,
    COMEDEROS_INI: 2, COMEDEROS_CICLO: 8, COMEDERO_RACIONES: 40,
  },

  FOTO: { COOLDOWN_CICLOS: 2, MAX: 12, ANCHO: 480, ALTO: 300 },

  RENDER: {
    MAX_TILES_SUCIOS: 90,      // tiles redibujados por frame como máximo
    PARTICULAS_CAP: 700,
    PASTO_MEcido_CAP: 420,     // matas de pasto animadas visibles
  },

  CAPAS: { REFLEJO_S: 0.22, VALORACION_S: 1.0, REFLEXIVA_S: 4.0 },

  AUDIO: { VOL_DEF: 0.5, MUSICA_DEF: true },
};
