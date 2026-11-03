/* ============================================================
   BIOSFERA — ui-paneles.js (BIOS.Paneles)
   Inspector de criatura (ficha viva y congelada) y cajón de
   pestañas: Registro de campo, Crónica, Datos (brújula + serie),
   Predicciones P-B, Códice del naturalista y Ajustes.
   ============================================================ */
(function () {
  'use strict';
  const B = window.BIOS;
  const U = B.Util;
  const C = B.CONFIG;
  const T = B.Triadico;
  const ico = (n) => '<span class="ico">' + B.UI.Iconos[n] + '</span>';
  const esc = U.escapar;

  const P = {};
  let intervalInspector = null;
  let idInspeccionada = null;

  /* ================================================================
     INSPECTOR — la ficha de campo
     ================================================================ */
  const inspector = {};

  inspector.mostrar = function (id) {
    idInspeccionada = id;
    const el = document.getElementById('inspector');
    el.classList.remove('oculto');
    el.classList.add('visible');
    el.scrollTop = 0; // ficha nueva: lectura desde arriba
    if (!intervalInspector) intervalInspector = setInterval(() => inspector.refrescar(), 550);
    inspector.refrescar();
    const J = B.Juego;
    if (J && J.registro) { J.registro.fichasAbiertas++; }
    if (J && J.registro && !J.registro.hitos.has('carta-vista')) {
      J.registro.hitos.add('carta-vista');
      setTimeout(() => B.UI.cartaHonestidad(), 600);
    }
  };
  inspector.ocultar = function () {
    const el = document.getElementById('inspector');
    el.classList.add('oculto'); el.classList.remove('visible');
    idInspeccionada = null;
    if (intervalInspector) { clearInterval(intervalInspector); intervalInspector = null; }
  };
  inspector.idActual = () => idInspeccionada;

  inspector.refrescar = function () {
    const J = B.Juego;
    if (!J || !idInspeccionada) return;
    const viva = J.poblacion.porId(idInspeccionada);
    const congelada = !viva ? J.registro.fichas.get(idInspeccionada) : null;
    if (!viva && !congelada) { inspector.ocultar(); return; }
    const el = document.getElementById('inspector');
    // No pisar el panel mientras el naturalista renombra a la criatura
    const foco = document.activeElement;
    if (foco && el.contains(foco) && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA')) return;
    // [FIX scroll] conservar la posición de lectura (panel y biografía) al redibujar
    const bioEl = el.querySelector('.biografia');
    const sp = el.scrollTop;
    const sb = bioEl ? bioEl.scrollTop : 0;
    if (viva) el.innerHTML = htmlFichaViva(viva);
    else el.innerHTML = htmlFichaCongelada(congelada);
    el.scrollTop = sp;
    const bioNueva = el.querySelector('.biografia');
    if (bioNueva) bioNueva.scrollTop = sb;
    enlazarBotonesFicha(viva, congelada);
  };

  function barra(valor, color, etiqueta, texto) {
    const v = Math.round(U.clamp(valor, 0, 1) * 100);
    return '<div class="barra"><div class="barra-top"><span>' + etiqueta + '</span><span class="barra-valor">' + (texto !== undefined ? texto : v + '%') + '</span></div>'
      + '<div class="barra-pista"><div class="barra-relleno" style="width:' + v + '%;background:' + color + '"></div></div></div>';
  }

  function chipCapa(nombre, activa, desc) {
    return '<span class="chip-capa ' + (activa ? 'on' : 'off') + '" title="' + desc + '">'
      + '<span class="luz"></span>' + nombre + '</span>';
  }

  function htmlFichaViva(c) {
    const f = c.ficha();
    const g = f.grados;
    const ag = f.agencia;
    const sin = f.sindrome ? T.SINDROMES.find((s) => s.clave === f.sindrome) : null;
    return ''
      + '<div class="ficha-cab">'
      + '<canvas id="retrato" width="96" height="96"></canvas>'
      + '<div class="ficha-id">'
      + '<input id="input-nombre" class="nombre" value="' + esc(f.nombre) + '" maxlength="16" title="Renombrar">'
      + '<div class="especie">' + esc(f.especie) + ' · ' + (f.sexo === 'H' ? 'hembra' : 'macho') + ' · ' + U.textoEdad(f.edadCiclos) + '</div>'
      + '<div class="region-badge r' + f.regionId + '">' + esc(f.regionNombre) + '</div>'
      + '</div></div>'
      + '<p class="honestidad-linea">No siente. Computa valoraciones. Tu vínculo es real.</p>'
      + '<div class="bloque"><h4>Grados triádicos <span class="doc">[D]</span></h4>'
      + barra(g.materia, '#c9a45a', 'Materia', g.materia.toFixed(2))
      + barra(g.energia, '#7ab8c9', 'Energía', g.energia.toFixed(2))
      + barra(g.voluntad, '#8fd694', 'Voluntad', g.voluntad.toFixed(2))
      + '</div>'
      + '<div class="bloque"><h4>Las tres capas <span class="doc">[D]</span></h4><div class="capas">'
      + chipCapa('Reflejo', true, 'Capa automática: siempre activa mientras haya vida.')
      + chipCapa('Valoración', f.capas.valoracion, 'Puntúa situaciones por urgencia. Se apaga por debajo del 10% de presupuesto.')
      + chipCapa('Reflexiva', f.capas.reflexiva, 'Planifica, veta y aprende. Se apaga por debajo del 30%.')
      + '</div></div>'
      + '<div class="bloque"><h4>Economía del cuerpo <span class="doc">[D]</span></h4>'
      + barra(f.b, f.b < 0.3 ? '#d98a7a' : '#e8c37a', 'Presupuesto B', Math.round(f.b * 100) + '%')
      + barra(f.h, f.h < 0.3 ? '#d98a7a' : '#7ab8c9', 'Hidratación', Math.round(f.h * 100) + '%')
      + barra(f.i, f.i < 0.5 ? '#d98a7a' : '#9ec49a', 'Integridad', Math.round(f.i * 100) + '%')
      + barra(f.expectativa, '#9d8ab8', 'Expectativa (placebo)', f.expectativa.toFixed(2))
      + '</div>'
      + '<div class="bloque"><h4>Índice de agencia <span class="doc">[D]</span></h4>'
      + '<div class="agencia">'
      + agInd('control', ag.i1) + agInd('robustez', ag.i2) + agInd('anticipacion', ag.i3) + agInd('homeostasis', ag.i4)
      + '</div>'
      + '<div class="agencia-total"><span class="numero">' + ag.total + '</span><span class="sobre">/ 12</span>'
      + '<span class="banda" style="color:' + ag.banda.color + '">' + ag.banda.nombre + '</span></div>'
      + '<p class="nota-doc">Estimación por protocolo simplificado de los 4 indicadores de la tesis (ap. A): bucle de control, robustez contrafáctica, anticipación y homeostasia.</p>'
      + '</div>'
      + (sin ? '<div class="bloque"><h4>Síndrome del vacío <span class="doc">[D]</span></h4><div class="sindrome" style="border-color:' + sin.color + '"><strong>' + sin.nombre + '.</strong> ' + esc(sin.def) + ' <em>(terminología funcional, no clínica)</em></div></div>' : '')
      + '<div class="bloque"><h4>Conducta actual</h4><p class="objetivo">' + esc(f.objetivo) + '</p>'
      + '<p class="mini-dato">Cobertura de su mapa mental: ' + Math.round(f.doctrinaCobertura * 100) + '% · Cazas: ' + f.cazas + ' · Evasiones: ' + f.casiCazada + '</p></div>'
      + htmlLinaje(f)
      + '<div class="bloque"><h4>Biografía</h4><div class="biografia">'
      + (f.bio.length ? f.bio.map((ev) => '<div class="bio-ev"><span class="bio-ciclo">C' + ev.ciclo + '</span><span>' + esc(ev.texto) + '</span></div>').join('') : '<p class="mini-dato">Sin eventos aún.</p>')
      + '</div></div>'
      + '<div class="ficha-botones">'
      + '<button class="btn" id="f-nota">' + ico('doc') + 'Documentar</button>'
      + '<button class="btn" id="f-foto">' + ico('camara') + 'Fotografiar</button>'
      + '<button class="btn" id="f-seguir">' + ico('seguir') + 'Seguir</button>'
      + '<button class="btn" id="f-cerrar">' + ico('cerrar') + 'Cerrar</button>'
      + '</div>';
  }

  function agInd(clave, valor) {
    const def = T.INDICADORES.find((i) => i.clave === clave);
    return '<span class="ag-chip" title="' + esc(def.desc) + '"><span class="ag-puntos">' + '●'.repeat(valor) + '○'.repeat(3 - valor) + '</span>' + def.nombre + '</span>';
  }

  function htmlLinaje(f) {
    const J = B.Juego;
    let html = '<div class="bloque"><h4>Linaje</h4>';
    if (f.padres && f.padres.length) {
      const nombres = f.padres.map((id) => {
        const viva = J.poblacion.porId(id);
        const ficha = J.registro.fichas.get(id);
        const nom = viva ? viva.nombre : (ficha ? ficha.nombre : '?');
        return '<button class="link-linaje" data-id="' + id + '">' + esc(nom) + '</button>';
      });
      html += '<p class="mini-dato">De ' + nombres.join(' y ') + '</p>';
    } else html += '<p class="mini-dato">Linaje inicial (siembra de la reserva).</p>';
    if (f.crias && f.crias.length) {
      const crias = f.crias.slice(0, 8).map((id) => {
        const viva = J.poblacion.porId(id);
        const ficha = J.registro.fichas.get(id);
        const nom = viva ? viva.nombre : (ficha ? ficha.nombre : 'perdida');
        return '<button class="link-linaje" data-id="' + id + '">' + esc(nom) + '</button>';
      });
      html += '<p class="mini-dato">Crías: ' + crias.join(', ') + (f.crias.length > 8 ? ' …' : '') + '</p>';
    } else html += '<p class="mini-dato">Sin crías registradas.</p>';
    return html + '</div>';
  }

  function htmlFichaCongelada(f) {
    if (!f) return '<p class="mini-dato">Ficha no encontrada.</p>';
    const ag = f.agencia || { total: 0, banda: { nombre: '—', color: '#9aa5a0' } };
    return ''
      + '<div class="ficha-cab">'
      + '<canvas id="retrato" width="96" height="96"></canvas>'
      + '<div class="ficha-id">'
      + '<div class="nombre muerta">' + esc(f.nombre || '—') + '</div>'
      + '<div class="especie">' + esc(f.especie || '') + ' · ' + (f.sexo === 'H' ? 'hembra' : 'macho') + '</div>'
      + '<div class="region-badge r4">Región 4 · su cuerpo volvió a ser materia y energía</div>'
      + '</div></div>'
      + '<p class="honestidad-linea">Ficha congelada. El duelo es tuyo y es real.</p>'
      + '<div class="bloque"><h4>Final</h4>'
      + '<p class="mini-dato">Vivió ' + (f.cicloMue !== null && f.cicloNac !== undefined ? (f.cicloMue - f.cicloNac) : '?') + ' ciclos (ciclos ' + f.cicloNac + '–' + f.cicloMue + ').</p>'
      + '<p class="mini-dato">Causa: <strong>' + esc(f.causa || '—') + '</strong></p>'
      + '<p class="mini-dato">Legado: ' + (f.crias || 0) + ' cría(s) · ' + (f.cazas || 0) + ' caza(s) exitosa(s)</p>'
      + (f.sindromeFinal ? '<p class="mini-dato">Terminó con cuadro de ' + esc(f.sindromeFinal) + '.</p>' : '')
      + '</div>'
      + '<div class="bloque"><h4>Índice de agencia final <span class="doc">[D]</span></h4>'
      + '<div class="agencia-total"><span class="numero">' + ag.total + '</span><span class="sobre">/ 12</span><span class="banda" style="color:' + ag.banda.color + '">' + ag.banda.nombre + '</span></div>'
      + '</div>'
      + '<div class="bloque"><h4>Biografía</h4><div class="biografia">'
      + (f.bio && f.bio.length ? f.bio.slice().reverse().map((ev) => '<div class="bio-ev"><span class="bio-ciclo">C' + ev.ciclo + '</span><span>' + esc(ev.texto) + '</span></div>').join('') : '<p class="mini-dato">Sin eventos registrados.</p>')
      + '</div></div>'
      + '<div class="ficha-botones"><button class="btn" id="f-cerrar">' + ico('cerrar') + 'Cerrar</button></div>';
  }

  function enlazarBotonesFicha(viva, congelada) {
    const J = B.Juego;
    const retrato = document.getElementById('retrato');
    if (retrato) {
      if (viva) B.Dibujante.retrato(retrato, viva, performance.now());
      else if (congelada && congelada.genoma) {
        // retrato de una ficha congelada: criatura simulada a partir del genoma guardado
        const fantasma = new B.Criatura({
          genoma: congelada.genoma, x: 0, y: 0, edad: 40,
          doctrina: B.Genoma.Doctrina.paraMundo(), nombre: congelada.nombre,
        });
        fantasma.fen = B.Genoma.fenotipo(congelada.genoma);
        B.Dibujante.retrato(retrato, fantasma, performance.now());
      }
    }
    const inputNombre = document.getElementById('input-nombre');
    if (inputNombre && viva) {
      inputNombre.addEventListener('change', () => {
        const nuevo = inputNombre.value.trim().slice(0, 16);
        if (nuevo) {
          viva.nombre = nuevo;
          const ficha = J.registro.fichas.get(viva.id);
          if (ficha) ficha.nombre = nuevo;
          J.registro.cronicaAdd('nota', 'El naturalista rebautiza a ' + nuevo + '.');
          B.UI.toast('Renombrada: ' + nuevo, 'info');
        }
      });
    }
    const btnNota = document.getElementById('f-nota');
    if (btnNota && viva) {
      btnNota.addEventListener('click', () => {
        B.UI.modal({
          titulo: 'Nota de campo sobre ' + viva.nombre,
          html: '<textarea id="area-nota" rows="4" placeholder="Lo que observaste…"></textarea>',
          botones: [
            { texto: 'Cancelar' },
            { texto: 'Guardar nota', clase: 'principal', onClick: () => {
              const t = document.getElementById('area-nota').value.trim();
              if (t) {
                J.registro.nota(t + ' — sobre ' + viva.nombre, J.estado.ciclo);
                viva.biografiaEvento('nota', 'El naturalista anota: «' + t.slice(0, 80) + (t.length > 80 ? '…' : '') + '»');
                B.UI.toast('Nota guardada en el cuaderno.', 'info');
              }
            } },
          ],
        });
      });
    }
    const btnFoto = document.getElementById('f-foto');
    if (btnFoto && viva) btnFoto.addEventListener('click', () => J.hacerFoto());
    const btnSeguir = document.getElementById('f-seguir');
    if (btnSeguir && viva) btnSeguir.addEventListener('click', () => { J.seguir(viva.id); B.UI.toast('Cámara siguiendo a ' + viva.nombre + '. Arrastra para soltar.', 'info'); });
    const btnCerrar = document.getElementById('f-cerrar');
    if (btnCerrar) btnCerrar.addEventListener('click', () => inspector.ocultar());
    document.querySelectorAll('.link-linaje').forEach((b) => {
      b.addEventListener('click', () => inspector.mostrar(b.dataset.id));
    });
  }

  /* ================================================================
     CAJÓN — pestañas del cuaderno
     ================================================================ */
  const cajon = {};
  let pestañaActiva = 'registro';

  cajon.alternar = function (id) {
    const el = document.getElementById('cajon');
    if (!el.classList.contains('oculto') && pestañaActiva === id) { el.classList.add('oculto'); return; }
    pestañaActiva = id;
    el.classList.remove('oculto');
    cajon.render();
    B.Audio.evento('clic');
  };
  cajon.abrir = function (id) {
    pestañaActiva = id;
    document.getElementById('cajon').classList.remove('oculto');
    cajon.render();
  };
  cajon.cerrar = function () { document.getElementById('cajon').classList.add('oculto'); };
  cajon.render = function () {
    const tabs = document.getElementById('cajon-tabs');
    const cont = document.getElementById('cajon-cont');
    const defs = [
      ['registro', 'libro', 'Cuaderno'], ['cronica', 'doc', 'Crónica'],
      ['datos', 'brujula', 'Datos'], ['predicciones', 'info', 'Predicciones'],
      ['codice', 'doc', 'Códice'], ['ajustes', 'ajustes', 'Ajustes'],
    ];
    tabs.innerHTML = defs.map(([id, ic, n]) =>
      '<button class="tab' + (id === pestañaActiva ? ' activa' : '') + '" data-tab="' + id + '">' + ico(ic) + '<span>' + n + '</span></button>').join('');
    tabs.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { pestañaActiva = b.dataset.tab; cajon.render(); }));
    const J = B.Juego;
    if (!J) return;
    switch (pestañaActiva) {
      case 'registro': cont.innerHTML = htmlRegistro(J); enlazarRegistro(J); break;
      case 'cronica': cont.innerHTML = htmlCronica(J); enlazarCronica(); break;
      case 'datos': cont.innerHTML = htmlDatos(J); dibujarGrafico(J); break;
      case 'predicciones': cont.innerHTML = htmlPredicciones(J); break;
      case 'codice': cont.innerHTML = htmlCodice(); enlazarCodice(); break;
      case 'ajustes': cont.innerHTML = htmlAjustes(J); enlazarAjustes(J); break;
    }
  };

  /* ---------------- Registro ---------------------------------------- */
  function htmlRegistro(J) {
    const { vivas, congeladas } = J.registro.fichasListado();
    const listaVivas = vivas.map((f) => {
      const c = J.poblacion.porId(f.id);
      if (!c) return '';
      return '<button class="fila-ficha" data-id="' + f.id + '">'
        + '<span class="punto-vivo"></span><span class="fila-nombre">' + esc(c.nombre) + '</span>'
        + '<span class="fila-esp">' + esc(c.fen.especie) + '</span>'
        + '<span class="fila-dato">' + U.textoEdad(c.edadCiclos) + '</span></button>';
    }).join('');
    const listaMuertas = congeladas.map((f) =>
      '<button class="fila-ficha muerta" data-id="' + f.id + '">'
      + '<span class="punto-frio"></span><span class="fila-nombre">' + esc(f.nombre || '—') + '</span>'
      + '<span class="fila-esp">' + esc(f.especie || '') + '</span>'
      + '<span class="fila-dato">' + esc(f.causa || '') + '</span></button>').join('');
    const fotos = J.registro.fotos.slice().reverse().map((f, i) =>
      '<figure class="foto-campo"><img src="' + f.url + '" alt="Fotografía del ciclo ' + f.ciclo + '">'
      + '<figcaption>Ciclo ' + f.ciclo + '</figcaption></figure>').join('');
    const notas = J.registro.notas.slice().reverse().map((n) =>
      '<div class="nota-campo"><span class="nota-ciclo">C' + n.ciclo + '</span>' + esc(n.texto) + '</div>').join('');
    return '<div class="seccion"><h3>El cuaderno de campo</h3>'
      + '<p class="mini-dato">' + vivas.length + ' vidas en curso · ' + congeladas.length + ' fichas congeladas · ' + J.registro.hitos.size + ' hitos</p>'
      + '<button class="btn" id="btn-nota-libre">' + ico('doc') + 'Escribir nota de campo</button></div>'
      + '<div class="seccion"><h4>Vivas</h4><div class="lista-fichas">' + (listaVivas || '<p class="mini-dato">Nadie por ahora.</p>') + '</div></div>'
      + '<div class="seccion"><h4>Congeladas</h4><div class="lista-fichas">' + (listaMuertas || '<p class="mini-dato">Aún nadie. Que dure.</p>') + '</div></div>'
      + '<div class="seccion"><h4>Fotografías (' + J.registro.fotos.length + '/' + C.FOTO.MAX + ')</h4><div class="galeria">' + (fotos || '<p class="mini-dato">Sin fotografías: la cámara es una herramienta (P).</p>') + '</div></div>'
      + '<div class="seccion"><h4>Notas</h4>' + (notas || '<p class="mini-dato">Sin notas todavía.</p>') + '</div>';
  }
  function enlazarRegistro(J) {
    document.querySelectorAll('.fila-ficha').forEach((b) => {
      b.addEventListener('click', () => inspector.mostrar(b.dataset.id));
    });
    const btnNota = document.getElementById('btn-nota-libre');
    if (btnNota) btnNota.addEventListener('click', () => {
      B.UI.modal({
        titulo: 'Nota de campo',
        html: '<textarea id="area-nota" rows="4" placeholder="Lo que observaste…"></textarea>',
        botones: [
          { texto: 'Cancelar' },
          { texto: 'Guardar', clase: 'principal', onClick: () => {
            const t = document.getElementById('area-nota').value.trim();
            if (t) { J.registro.nota(t, J.estado.ciclo); cajon.render(); }
          } },
        ],
      });
    });
  }

  /* ---------------- Crónica ----------------------------------------- */
  let filtroCronica = 'todas';
  function htmlCronica(J) {
    const filtros = [['todas', 'Todo'], ['nace', 'Nacimientos'], ['muere', 'Muertes'], ['hito', 'Hitos'], ['veto', 'Vetos'], ['ciclo', 'Población'], ['nota', 'Notas']];
    const eventos = J.registro.cronica.slice().reverse()
      .filter((ev) => filtroCronica === 'todas' || ev.tipo === filtroCronica || (filtroCronica === 'veto' && ev.tipo === 'memorable'))
      .slice(0, 160);
    return '<div class="seccion"><h3>Crónica de la reserva</h3><div class="filtros">'
      + filtros.map(([id, n]) => '<button class="chip-filtro' + (id === filtroCronica ? ' activa' : '') + '" data-f="' + id + '">' + n + '</button>').join('')
      + '</div></div><div class="cronica">'
      + (eventos.length ? eventos.map((ev) =>
        '<div class="cron-ev t-' + ev.tipo + '"><span class="cron-ciclo">C' + ev.ciclo + '</span><span class="cron-tipo">' + ev.tipo + '</span><span>' + esc(ev.texto) + '</span></div>').join('')
        : '<p class="mini-dato">La crónica empieza con el primer acontecer.</p>')
      + '</div>';
  }
  function enlazarCronica() {
    document.querySelectorAll('.chip-filtro').forEach((b) => {
      b.addEventListener('click', () => { filtroCronica = b.dataset.f; cajon.render(); });
    });
  }

  /* ---------------- Datos -------------------------------------------- */
  function htmlDatos(J) {
    const br = J.poblacion.brujulaReserva(J.mundo);
    const mu = J.poblacion.muertes;
    return '<div class="seccion"><h3>Brújula triádica de la reserva <span class="doc">[D→P]</span></h3>'
      + '<p class="mini-dato">Adaptación del instrumento de la tesis (cap. 13) al conjunto del ecosistema.</p>'
      + barra10(br.materia, '#c9a45a', 'Materia (suelo y biomasa)')
      + barra10(br.energia, '#7ab8c9', 'Energía (luz y agua)')
      + barra10(br.voluntad, '#8fd694', 'Voluntad (agencia media)')
      + '<p class="mini-dato">Índice de equilibrio: ' + br.equilibrio.toFixed(1) + ' — ' + br.estado + '</p></div>'
      + '<div class="seccion"><h3>Serie histórica</h3><canvas id="grafico" width="640" height="250"></canvas>'
      + '<div class="leyenda"><span class="lg lg-herb">Forrajeros</span><span class="lg lg-carn">Cazadores</span><span class="lg lg-bio">Biomasa</span><span class="lg lg-luz">Luz</span></div></div>'
      + '<div class="seccion"><h3>Contadores</h3>'
      + '<p class="mini-dato">Nacimientos: ' + J.poblacion.nacimientos + ' · Muertes: ' + (mu.total || 0)
      + ' (inanición ' + (mu.inanición || 0) + ', sed ' + (mu.sed || 0) + ', depredación ' + (mu.depredación || 0) + ', vejez ' + (mu.vejez || 0) + ', heridas ' + (mu.heridas || 0) + ')</p>'
      + '<p class="mini-dato">Vetos terminales presenciados: ' + J.registro.predicciones.vetos + '</p>'
      + '<p class="mini-dato">Residuo acumulado: ' + J.mundo.residuoTotal().toFixed(1) + ' · El micelio recicló ~' + J.registro.hongosReciclados + ' unidades de desorden en fertilidad.</p></div>';
  }
  function barra10(v, color, etiqueta) {
    return '<div class="barra"><div class="barra-top"><span>' + etiqueta + '</span><span class="barra-valor">' + v.toFixed(1) + '/10</span></div>'
      + '<div class="barra-pista"><div class="barra-relleno" style="width:' + (v * 10) + '%;background:' + color + '"></div></div></div>';
  }

  function dibujarGrafico(J) {
    const cv = document.getElementById('grafico');
    if (!cv) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const h = J.registro.historia;
    g.fillStyle = 'rgba(10,16,12,0.5)';
    g.fillRect(0, 0, W, H);
    if (h.length < 2) {
      g.fillStyle = 'rgba(230,238,228,0.5)';
      g.font = '13px "Segoe UI",sans-serif';
      g.fillText('La serie necesita algunos ciclos…', 20, 30);
      return;
    }
    const datos = h.slice(-320);
    const maxPob = Math.max(20, ...datos.map((d) => Math.max(d.herb, d.carn)));
    const x0 = 40, y0 = 16, ancho = W - 54, alto = H - 40;
    // rejilla
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = y0 + alto * i / 4;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + ancho, y); g.stroke();
      g.fillStyle = 'rgba(230,238,228,0.45)';
      g.font = '10px "Segoe UI",sans-serif';
      g.fillText(String(Math.round(maxPob * (1 - i / 4))), 14, y + 3);
    }
    // luz (banda de fondo)
    g.beginPath();
    datos.forEach((d, i) => {
      const x = x0 + ancho * i / (datos.length - 1);
      const y = y0 + alto * (1 - d.luz);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.strokeStyle = 'rgba(240,220,160,0.30)';
    g.setLineDash([3, 4]);
    g.stroke();
    g.setLineDash([]);
    // biomasa
    linea(g, datos, (d) => d.bio, x0, y0, ancho, alto, 1, 'rgba(150,190,140,0.8)', [6, 4]);
    // herbívoros
    linea(g, datos, (d) => d.herb / maxPob, x0, y0, ancho, alto, 2, '#8fd694');
    // carnívoros
    linea(g, datos, (d) => d.carn / maxPob, x0, y0, ancho, alto, 2, '#e8c37a');
    // ejes
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, y0 + alto); g.lineTo(x0 + ancho, y0 + alto); g.stroke();
    g.fillStyle = 'rgba(230,238,228,0.5)';
    g.font = '10px "Segoe UI",sans-serif';
    g.fillText('C' + datos[0].ciclo, x0, H - 6);
    g.fillText('C' + datos[datos.length - 1].ciclo, x0 + ancho - 30, H - 6);
  }
  function linea(g, datos, fn, x0, y0, ancho, alto, w, color, dash) {
    g.beginPath();
    datos.forEach((d, i) => {
      const v = U.clamp(fn(d), 0, 1);
      const x = x0 + ancho * i / (datos.length - 1);
      const y = y0 + alto * (1 - v);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    });
    g.strokeStyle = color;
    g.lineWidth = w;
    if (dash) g.setLineDash(dash);
    g.stroke();
    g.setLineDash([]);
  }

  /* ---------------- Predicciones ------------------------------------- */
  function htmlPredicciones(J) {
    const preds = J.registro.prediccionesEstado();
    return '<div class="seccion"><h3>Predicciones del programa de aplicaciones <span class="doc">[D]</span></h3>'
      + '<p class="mini-dato">El GDD de BIOSFERA compromete la simulación con predicciones falsables (P-B1…P-B4). Este cuaderno las vigila en vivo. «Si no se observa, la mecánica falla» es la regla.</p></div>'
      + preds.map((p) =>
        '<div class="seccion prediccion"><h4>' + p.titulo + '</h4>'
        + '<p class="texto-serifo">' + p.texto + '</p>'
        + '<p class="mini-dato"><strong>Estado:</strong> ' + p.estado + '</p>'
        + '<p class="mini-dato falsacion"><strong>Falsación:</strong> ' + esc(p.falsacion) + '</p></div>').join('');
  }

  /* ---------------- Códice ------------------------------------------- */
  function htmlCodice() {
    const seccion = (id, titulo, cuerpo) =>
      '<details class="codice-seccion" id="cs-' + id + '"' + (id === 'observar' ? ' open' : '') + '><summary>' + titulo + '</summary><div class="codice-cuerpo">' + cuerpo + '</div></details>';
    let html = '<div class="seccion"><h3>Códice del naturalista</h3><p class="mini-dato">Todo lo que el juego hace y por qué lo hace: el modelo que lo sostiene, con sus etiquetas de honestidad.</p></div>';

    html += seccion('observar', 'Cómo se observa', ''
      + '<p>La reserva se recorre <strong>arrastrando</strong> el ratón (o con WASD/flechas) y se acerca con la <strong>rueda</strong>. La <strong>lupa</strong> selecciona criaturas: su ficha vive a la izquierda. El <strong>cuaderno</strong> (R) guarda fichas, crónica, datos y fotografías.</p>'
      + '<p>Herramientas: <strong>Z</strong> observar · <strong>X</strong> sembrar · <strong>C</strong> regar · <strong>V</strong> micelio · <strong>B</strong> comedero · <strong>N</strong> bautizar · <strong>P</strong> fotografiar. <strong>Espacio</strong> pausa · <strong>1/3/8</strong> velocidad · <strong>F</strong> seguir a la seleccionada · <strong>Esc</strong> menú.</p>'
      + '<p>No hay órdenes para las criaturas: el naturalista no manda. Observa, documenta y cultiva. Esa es la apuesta de diseño <span class="doc">[P]</span>.</p>');

    html += seccion('modelo', 'El modelo triádico', ''
      + T.VENN_SVG
      + '<p>Todo ente es combinación de <strong>materia</strong> (estructura, cuerpo, terreno), <strong>energía</strong> (procesos, presupuesto, flujos) y <strong>voluntad</strong> (metas, control, planificación). Las intersecciones dan siete regiones más la nada: el cubo booleano de la tesis (cap. 5) <span class="doc">[D]</span>.</p>'
      + '<table class="tabla-doc"><thead><tr><th>Principio</th><th>En el software</th><th>En BIOSFERA</th></tr></thead><tbody>'
      + T.CORRESPONDENCIAS.map((f) => '<tr><td><strong>' + f[0] + '</strong></td><td>' + f[1] + '</td><td>' + f[2] + '</td></tr>').join('')
      + '</tbody></table>'
      + '<p>Las criaturas son <strong>región 7 funcional (artificial)</strong>: agencia completa, experiencia nula <span class="doc">[D]</span>. El pasto y el agua son región 4. Cuando una criatura pierde sus capas por agotamiento, la puedes ver degradarse a región 5 antes de morir; al morir, su cuerpo vuelve a la región 4: es la <em>disolución de la voluntad</em> <span class="doc">[D]</span>.</p>');

    html += seccion('capas', 'Las tres capas y la economía', ''
      + '<table class="tabla-doc"><thead><tr><th>Capa</th><th>Ritmo</th><th>Hace</th><th>Coste</th></tr></thead><tbody>'
      + '<tr><td><strong>Automática</strong></td><td>~0,2 s</td><td>Reflejos: huir, beber junto al agua, dormir por agotamiento</td><td>mínimo</td></tr>'
      + '<tr><td><strong>De valoración</strong></td><td>~1 s</td><td>Puntúa situaciones por urgencia y elige meta</td><td>medio</td></tr>'
      + '<tr><td><strong>Reflexiva</strong></td><td>~4 s</td><td>Planifica con memoria, <em>veta</em> reflejos y aprende</td><td>alto</td></tr>'
      + '</tbody></table>'
      + '<p>Una sola reserva de energía paga todo: existir, percibir, valorar, deliberar, actuar y aprender <span class="doc">[D]</span>. Por debajo del 30% se apaga la reflexiva; por debajo del 10%, la valoración: <em>mueren primero las funciones caras</em>. Con presupuesto recuperado, vuelven.</p>'
      + '<p>El <strong>veto deliberativo</strong> es la joya: la capa reflexiva puede anular al reflejo. El más dramático es el <em>veto terminal</em>: con sed crítica, todo lo demás se anula y la criatura corre su último tramo hacia el agua <span class="doc">[D]</span>.</p>');

    html += seccion('agencia', 'Índice de agencia', ''
      + '<p>Cada ficha puntúa los cuatro indicadores de la tesis (cap. 3 y apéndice A) sobre 12 <span class="doc">[D]</span>:</p>'
      + '<ul>' + T.INDICADORES.map((i) => '<li><strong>' + i.nombre + ':</strong> ' + i.desc + '</li>').join('') + '</ul>'
      + '<p>Bandas: 0–4 Instrumento · 5–7 Agente asistido · 8–10 Agente operativo · 11–12 Agente pleno. Un agente pleno sigue sin sentir nada: el índice mide conducta orientada a metas, no experiencia <span class="doc">[D]</span>.</p>');

    html += seccion('sindromes', 'Los síndromes del vacío', ''
      + '<p>Definidos una sola vez en la tesis (cap. 12, §12.7) y traducidos aquí como configuraciones medibles <span class="doc">[D]</span>:</p>'
      + '<ul>' + T.SINDROMES.map((s) => '<li><strong style="color:' + s.color + '">' + s.nombre + ':</strong> ' + s.def + '</li>').join('') + '</ul>'
      + '<p>Se ven en la ficha y en los iconos violeta del modo investigación. Se tratan cultivando: comida cerca del agotado, recursos conocidos para el alienado, éxito sostenido para el deprimido. <em>Terminología funcional, no clínica</em>.</p>');

    html += seccion('placebo', 'Expectativa: placebo y nocebo', ''
      + '<p>La expectativa de cada criatura modula su eficiencia según <span class="doc">[D]</span>: <code>eficiencia = capacidad × (0,75 + 0,5 × expectativa)</code>. Come mejor la que confía; el comedero vacío golpea la confianza (nocebo). Es la mecánica social del doc. §6.6 hecha simulación.</p>');

    html += seccion('honestidad', 'Lectura honesta', ''
      + '<p>' + T.CARTA_HONESTIDAD.split('\n\n')[4] + '</p>'
      + '<p>Este juego no valida las regiones 3 y 6 del modelo ni nada metafísico: las simulaciones demuestran fertilidad de diseño, jamás verdad ontológica <span class="doc">[D]</span>. La regla del GDD: <em>«si construimos un hada, no por ello existen las hadas»</em>.</p>'
      + '<button class="btn" id="btn-carta-completa">Leer la carta completa</button>');

    html += seccion('diseno', 'Fichas de diseño (qué es [D], [P], [F])', ''
      + '<ul class="lista-doc">'
      + '<li><span class="doc">[D]</span> ' + T.ETIQUETAS.D.desc + '</li>'
      + '<li><span class="doc">[P]</span> ' + T.ETIQUETAS.P.desc + '</li>'
      + '<li><span class="doc">[F]</span> ' + T.ETIQUETAS.F.desc + '</li>'
      + '</ul>'
      + '<table class="tabla-doc"><thead><tr><th>Sistema</th><th>Estatus</th></tr></thead><tbody>'
      + '<tr><td>Cubo booleano, 7 regiones, transiciones</td><td><span class="doc">[D]</span> tesis cap. 5</td></tr>'
      + '<tr><td>Tres capas con degradación y veto</td><td><span class="doc">[D]</span> tesis cap. 7 + doc. §3.7–3.8</td></tr>'
      + '<tr><td>Índice de agencia 0–12</td><td><span class="doc">[D]</span> tesis cap. 3 + ap. A</td></tr>'
      + '<tr><td>Síndromes del vacío</td><td><span class="doc">[D]</span> tesis §12.7</td></tr>'
      + '<tr><td>Placebo/nocebo por expectativa</td><td><span class="doc">[D]</span> doc. §6.6</td></tr>'
      + '<tr><td>Muerte con legado (genoma + doctrina)</td><td><span class="doc">[D]</span> GDD pilar 4</td></tr>'
      + '<tr><td>Rol naturalista sin mando</td><td><span class="doc">[D]</span> GDD pilar 2</td></tr>'
      + '<tr><td>Umbrales y constantes concretas</td><td><span class="doc">[P]</span> calibración propia</td></tr>'
      + '<tr><td>Brújula de la reserva</td><td><span class="doc">[D→P]</span> adaptación del cap. 13</td></tr>'
      + '</tbody></table>');
    return html;
  }
  function enlazarCodice() {
    const btn = document.getElementById('btn-carta-completa');
    if (btn) btn.addEventListener('click', () => B.UI.cartaHonestidad());
  }

  /* ---------------- Ajustes ------------------------------------------ */
  function htmlAjustes(J) {
    const a = J.estado.ajustes;
    return '<div class="seccion"><h3>Ajustes</h3>'
      + '<div class="ajuste"><label>Volumen general</label><input type="range" id="ax-vol" min="0" max="100" value="' + Math.round((B.Audio.ajustesActuales().volumen) * 100) + '"></div>'
      + '<div class="ajuste"><label>Música ambiental</label><button class="btn toggle" id="ax-musica">' + (B.Audio.ajustesActuales().musica ? 'Sí' : 'No') + '</button></div>'
      + '<div class="ajuste"><label>Modo investigación (iconos de necesidad)</label><button class="btn toggle" id="ax-inv">' + (a.investigacion ? 'Activo' : 'Inactivo') + '</button></div>'
      + '<div class="ajuste"><label>Mostrar trayectorias de las metas</label><button class="btn toggle" id="ax-tray">' + (a.trayectorias ? 'Activo' : 'Inactivo') + '</button></div>'
      + '<div class="ajuste"><label>Autoguardado por ciclo</label><button class="btn toggle" id="ax-auto">' + (a.autoguardado ? 'Activo' : 'Inactivo') + '</button></div>'
      + '</div>'
      + '<div class="seccion"><h3>Partida</h3>'
      + '<button class="btn" id="ax-guardar">' + ico('guardar') + 'Guardar ahora</button> '
      + '<button class="btn" id="ax-exportar">' + ico('exportar') + 'Exportar a archivo</button> '
      + '<button class="btn" id="ax-importar">' + ico('importar') + 'Importar de archivo</button></div>'
      + '<div class="seccion"><h3>Acerca de</h3><p class="mini-dato">BIOSFERA v' + C.VERSION + ' · HTML/CSS/JS puro, sin dependencias, sin servidor. Implementación del Proyecto 9 del documento «Aplicaciones del modelo triádico a la programación, la IA y los videojuegos» (cap. 6, §6.2), sobre la tesis «Materia, Energía y Voluntad» de F. A. Ragazzon Gallo (2026).</p></div>';
  }
  function enlazarAjustes(J) {
    document.getElementById('ax-vol').addEventListener('input', (e) => {
      B.Audio.ajustar({ volumen: e.target.value / 100 });
      J.estado.ajustes.volumen = e.target.value / 100;
      J.guardarAjustes();
    });
    const tog = (id, fn) => document.getElementById(id).addEventListener('click', function () { fn(); cajon.render(); });
    tog('ax-musica', () => { B.Audio.ajustar({ musica: !B.Audio.ajustesActuales().musica }); J.estado.ajustes.musica = B.Audio.ajustesActuales().musica; J.guardarAjustes(); });
    tog('ax-inv', () => { J.estado.ajustes.investigacion = !J.estado.ajustes.investigacion; J.guardarAjustes(); });
    tog('ax-tray', () => { J.estado.ajustes.trayectorias = !J.estado.ajustes.trayectorias; J.guardarAjustes(); });
    tog('ax-auto', () => { J.estado.ajustes.autoguardado = !J.estado.ajustes.autoguardado; J.guardarAjustes(); });
    document.getElementById('ax-guardar').addEventListener('click', () => { J.guardar(); B.UI.toast('Partida guardada.', 'info'); });
    document.getElementById('ax-exportar').addEventListener('click', () => J.exportar());
    document.getElementById('ax-importar').addEventListener('click', () => J.importar());
  }

  /* Refresco periódico del cajón si está en una pestaña viva */
  setInterval(() => {
    const el = document.getElementById('cajon');
    if (!el || el.classList.contains('oculto')) return;
    if (pestañaActiva === 'datos') {
      const J = B.Juego;
      if (J && J.corriendo) cajon.render();
    }
  }, 2500);

  P.inspector = inspector;
  P.cajon = cajon;

  /* Botón de cierre del cajón (el DOM ya existe: los scripts van al final del body) */
  const btnCerrarCajon = document.getElementById('cajon-cerrar');
  if (btnCerrarCajon) btnCerrarCajon.addEventListener('click', () => cajon.cerrar());

  window.BIOS.Paneles = P;
})();
