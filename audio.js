/* ============================================================
   BIOSFERA — audio.js
   Sonido 100% procedural con WebAudio: ambiente por franja del
   día, lluvia, eventos de juego y música ambiental generativa.
   Sin archivos de audio: todo se sintetiza en tiempo real.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;

  const A = {};
  let ctx = null, master = null, ambi = null, musVol = null;
  let desbloqueado = false;
  let ajustes = { volumen: C.AUDIO.VOL_DEF, musica: C.AUDIO.MUSICA_DEF };
  let temporizadores = [];

  A.desbloquear = function () {
    if (desbloqueado) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = ajustes.volumen;
      master.connect(ctx.destination);
      desbloqueado = true;
      arrancarAmbiente();
      arrancarMusica();
    } catch (e) { console.warn('Audio no disponible', e); }
  };

  A.ajustar = function (nuevos) {
    ajustes = Object.assign(ajustes, nuevos);
    if (master) master.gain.value = ajustes.volumen;
    if (musVol) musVol.gain.value = ajustes.musica ? 0.16 : 0;
  };
  A.ajustesActuales = () => ajustes;

  /* ---------------- Ambiente (viento + pájaros / grillos) ---------- */
  function nodoRuido() {
    const dur = 2.2;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const datos = buf.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }

  function arrancarAmbiente() {
    // viento suave continuo
    const ruido = nodoRuido();
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass'; filtro.frequency.value = 320; filtro.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0.05;
    ruido.connect(filtro); filtro.connect(g); g.connect(master);
    ruido.start();
    ambi = { ruido, filtro, g };
    programarAnimalitos();
  }

  function programarAnimalitos() {
    const J = B.Juego;
    const paso = () => {
      if (!ctx) return;
      const info = J && J.mundo ? J.mundo.luzTotal(J.estado.ciclo, J.estado.tCiclo) : { D: 1 };
      const clima = J && J.mundo ? J.mundo.clima.tipo : 'soleado';
      if (clima !== 'lluvia' && clima !== 'nevada') {
        if (info.D > 0.5) grilloOPajaro(true);
        else if (info.D < 0.3) grilloOPajaro(false);
      }
      if (clima === 'lluvia') lluviaSuave();
      temporizadores.push(setTimeout(paso, 2400 + Math.random() * 4200));
    };
    temporizadores.push(setTimeout(paso, 1500));
  }

  function grilloOPajaro(dia) {
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    if (dia) {
      // gorjeo: osciladores con barrido rápido
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        const f0 = 1900 + Math.random() * 1400;
        const t0 = t + i * (0.09 + Math.random() * 0.07);
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(f0 * (0.6 + Math.random() * 0.5), t0 + 0.09);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.028, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + 0.16);
      }
    } else {
      // grillo: pulsos rápidos de banda alta
      const n = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 4200 + Math.random() * 500;
        const t0 = t + i * 0.07;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.012, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + 0.06);
      }
    }
  }

  function lluviaSuave() {
    if (!ctx || !ambi) return;
    const t = ctx.currentTime;
    const ruido = nodoRuido();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.030, t + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.8);
    ruido.connect(f); f.connect(g); g.connect(master);
    ruido.start(t); ruido.stop(t + 2);
  }

  /* ---------------- Música generativa (acorde lento) ---------------- */
  let musTimer = null;
  function arrancarMusica() {
    musVol = ctx.createGain();
    musVol.gain.value = ajustes.musica ? 0.16 : 0;
    musVol.connect(master);
    const escala = [220, 246.94, 277.18, 329.63, 369.99, 415.30, 493.88]; // lá menor pentatónica extendida
    const paso = () => {
      if (!ctx) return;
      const t = ctx.currentTime;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = escala[Math.floor(Math.random() * escala.length)] * (Math.random() < 0.3 ? 0.5 : 1);
        const t0 = t + i * 0.8;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.05, t0 + 1.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + 4.4);
        o.connect(g); g.connect(musVol);
        o.start(t0); o.stop(t0 + 4.6);
      }
      musTimer = setTimeout(paso, 5200 + Math.random() * 2600);
    };
    paso();
  }

  /* ---------------- Efectos puntuales -------------------------------- */
  function tono(freq, dur, tipo, vol, delay) {
    if (!ctx || !master) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function arpegio(freqs, dur, tipo, vol) {
    freqs.forEach((f, i) => tono(f, dur, tipo, vol, i * (dur * 0.55)));
  }

  A.evento = function (tipo) {
    if (!desbloqueado) return;
    switch (tipo) {
      case 'clic': tono(660, 0.06, 'sine', 0.05); break;
      case 'toast': tono(523.25, 0.14, 'sine', 0.05); break;
      case 'hito': arpegio([392, 523.25, 659.25], 0.3, 'sine', 0.07); break;
      case 'memorable': arpegio([329.63, 415.30, 493.88, 659.25], 0.5, 'sine', 0.06); break;
      case 'nace': arpegio([440, 554.37, 659.25], 0.22, 'triangle', 0.06); break;
      case 'muere': tono(174.61, 0.9, 'sine', 0.05); tono(130.81, 1.1, 'sine', 0.04, 0.18); break;
      case 'caza': tono(220, 0.12, 'sawtooth', 0.035); tono(180, 0.1, 'sawtooth', 0.03, 0.09); break;
      case 'veto': tono(587.33, 0.4, 'sine', 0.06); tono(880, 0.5, 'sine', 0.03, 0.1); break;
      case 'foto': tono(1200, 0.04, 'square', 0.04); tono(900, 0.05, 'square', 0.03, 0.05); break;
      case 'error': tono(180, 0.16, 'square', 0.05); break;
    }
  };

  /* Suspender cuando la pestaña se oculta */
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  window.BIOS.Audio = A;
})();
