/*CANVAS!! */
const canvas = document.getElementById("canvas");
const ctx = canvas ? canvas.getContext("2d") : null;

// Récords por nivel y dificultad persistentes (hay contra qué comparar)
const RECORD_KEY = 'blocka_records_v1';
const DIFICULTADES = [4, 6, 8];
function nivelVacio() { return { 1: null, 2: null, 3: null }; }
function cargarRecords() {
    const base = {};
    DIFICULTADES.forEach((d) => { base[d] = nivelVacio(); });
    try {
        const raw = localStorage.getItem(RECORD_KEY);
        if (!raw) return base;
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
            // Migración: formato anterior plano {1,2,3} -> dificultad 4
            const fuente = (data[4] && typeof data[4] === 'object') ? data : { 4: data };
            DIFICULTADES.forEach((d) => {
                [1, 2, 3].forEach((n) => {
                    const v = fuente[d] ? fuente[d][n] : null;
                    if (typeof v === 'number' && v >= 0) base[d][n] = v;
                });
            });
        }
    } catch (e) { /* dato corrupto: se usa base */ }
    return base;
}
function guardarRecords(records) {
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(records)); } catch (e) {}
}

// Estado global del nivel
const estadoJuego = {
    nivelActual: 1,         // Nivel 1, 2 o 3
    piezas: [],             // Arreglo con la información de las 4, 9 o 16 partes
    bancoImagenes: [
        'img/galeria_BlockA/1.jpg', 'img/galeria_BlockA/2.jpg', 'img/galeria_BlockA/3.jpg',
        'img/galeria_BlockA/4.jpg', 'img/galeria_BlockA/5.jpg', 'img/galeria_BlockA/6.jpg'
    ],
    filtrosDisponibles: ['grises', 'brillo', 'negativo'],
    juegoTerminado: false,
    cantPartes: 4,          // 4, 6 u 8 partes
    imagenNivel: null,      // Imagen original del nivel, para mostrarla completa al ganar
    escalaFinal: 1,         // Escala del tablero, reutilizada por el reveal de victoria
    offsetLeft: 290,
    offsetTop: 41,
    tableroW: 0,
    tableroH: 0,
    // VARIABLES DEL TEMPORIZADOR
    segundosTranscurridos: 0,
    timerInterval: null,
    recordPorNivel: cargarRecords(),
};

function aplicarFiltro(imageData, tipoFiltro) {
    if (!tipoFiltro) return; // Nivel 1
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        if (tipoFiltro === 'grises') {
            // Grises
            const gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gris;
            data[i + 1] = gris;
            data[i + 2] = gris;
        }
        else if (tipoFiltro === 'brillo') {
            // Brillo +30%
            data[i] *= 1.3;
            data[i + 1] *= 1.3;
            data[i + 2] *= 1.3;
        }
        else if (tipoFiltro === 'negativo') {
            // Negativo
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
        }
    }
}

function iniciarNivel() {
    if (!estadoJuego.bancoImagenes.length) return;
    showNivel(true);
    setAyudaEnabled(true);

    if(estadoJuego.nivelActual===2){
        estadoJuego.filtroActual=estadoJuego.filtrosDisponibles[Math.floor(Math.random() * estadoJuego.filtrosDisponibles.length)];
    }

    const rutaImagen = estadoJuego.bancoImagenes[Math.floor(Math.random() * estadoJuego.bancoImagenes.length)];
    const img = new Image();
    img.src = rutaImagen;
    img.onload = function () {
        // Se guarda para poder revelar la imagen completa (sin recorte) al ganar
        estadoJuego.imagenNivel = img;
        setupPiezas(this);
    };
}

/* Rectángulo (en px del canvas) donde se puede dibujar el juego sin chocar
   con el timer/nivel de arriba ni con la toolbar de abajo.
   Lo usan tanto el tablero como la imagen original del final, para que
   ambos se dibujen siempre al mismo tamaño y en la misma posición. */
function areaSeguraJuego() {
    const contRect = canvas.getBoundingClientRect();
    const ky = contRect.height > 0 ? canvas.height / contRect.height : 1;
    const screenEl = document.getElementById('gameScreen');
    const screenRect = screenEl ? screenEl.getBoundingClientRect() : null;
    const bottomCss = screenRect ? Math.max(0, contRect.bottom - screenRect.bottom) : 0;
    const bordeInf = (id) => {
        const el = document.getElementById(id);
        if (!el || !screenRect) return 0;
        return Math.max(0, el.getBoundingClientRect().bottom - screenRect.top);
    };
    const topCss = Math.max(bordeInf('timer-display'), bordeInf('level-display'), 50) + 10;
    const top = topCss * ky;
    const bottom = bottomCss * ky + 8 * ky;
    return { top: top, alto: Math.max(1, canvas.height - top - bottom) };
}

function setupPiezas(imagen) {
    if (!canvas || canvas.style.display !== 'block') return; // se salió al menú durante la carga
    estadoJuego.piezas = [];

    // Determinar filas y columnas según la cantidad de partes seleccionadas (4, 6, 8 o 16)
    let cols = 2, filas = 2;
    if (estadoJuego.cantPartes === 6) { cols = 3; filas = 2; }
    if (estadoJuego.cantPartes === 9) { cols = 3; filas = 3; }
    if (estadoJuego.cantPartes === 8) { cols = 4; filas = 2; }
    if (estadoJuego.cantPartes === 16) { cols = 4; filas = 4; }

    /* Recorte de la fuente para que TODAS las piezas salgan cuadradas (1:1).
       Sin esto, con cols != filas sobre una imagen cuadrada las piezas quedan
       rectangulares y al rotar 90/270 se salen de su casilla.
       Se conserva siempre el ancho completo y se recorta el alto necesario, centrado. */
    const subWidth = Math.min(imagen.width / cols, imagen.height / filas);
    const subHeight = subWidth;
    const srcX = (imagen.width - cols * subWidth) / 2;
    const srcY = (imagen.height - filas * subHeight) / 2;
    // Zona segura en px del canvas: reserva arriba (timer/nivel) y abajo (toolbar)
    const area = areaSeguraJuego();
    const topRes = area.top;
    const bottomRes = canvas.height - area.top - area.alto;
    // Escala para que el tablero entre en la zona segura (1 = sin cambios)
    const esc = Math.min(1, canvas.width / (cols * subWidth), area.alto / (filas * subHeight));
    // La imagen original del final se dibuja con esta misma escala, para que el
    // reveal se vea del mismo tamaño que el rompecabezas que se acaba de armar.
    estadoJuego.escalaFinal = esc;
    const wPieza = subWidth * esc;
    const hPieza = subHeight * esc;
    estadoJuego.tableroW = cols * wPieza;
    estadoJuego.tableroH = filas * hPieza;
    // Centrar el área de juego (y el marco) dentro de la zona segura
    estadoJuego.offsetLeft = Math.max(0, (canvas.width - estadoJuego.tableroW) / 2);
    estadoJuego.offsetTop = Math.max(0, topRes + (area.alto - estadoJuego.tableroH) / 2);
    // Sin 0°: garantiza que ninguna pieza nazca ya resuelta, siempre hay algo que rotar
    const angulos = [90, 180, 270];

    // Canvas auxiliar en memoria para recortar y procesar filtros
    const canvasAux = document.createElement('canvas');
    canvasAux.width = subWidth;
    canvasAux.height = subHeight;
    const ctxAux = canvasAux.getContext('2d');

    let id = 0;
    for (let r = 0; r < filas; r++) {
        for (let c = 0; c < cols; c++) {

            // Recortar subimagen
            ctxAux.clearRect(0, 0, subWidth, subHeight);
            ctxAux.drawImage(imagen, srcX + c * subWidth, srcY + r * subHeight, subWidth, subHeight, 0, 0, subWidth, subHeight);

            // Obtener ImageData original y con filtro
            const imgDataOrig = ctxAux.getImageData(0, 0, subWidth, subHeight);
            const imgDataFilt = ctxAux.getImageData(0, 0, subWidth, subHeight);

            // Nivel 3: Filtro aleatorio distinto por cada subimagen (sobre una copia)
            let filtroParaPieza = estadoJuego.filtroActual;
            if (estadoJuego.nivelActual >= 3) {
                filtroParaPieza = estadoJuego.filtrosDisponibles[Math.floor(Math.random() * estadoJuego.filtrosDisponibles.length)];
            }
            aplicarFiltro(imgDataFilt, filtroParaPieza);

            // Guardar el objeto estructural con los datos de la subimagen
            estadoJuego.piezas.push({
                id: id++,
                col: c,
                row: r,
                width: wPieza,
                height: hPieza,
                rotacion: angulos[Math.floor(Math.random() * angulos.length)],
                fijada: false,                                                // Para "Ayudita"
                canvasPropio: crearCanvasDePieza(subWidth, subHeight, imgDataFilt),
                imgDataOriginal: imgDataOrig
            });
        }
    }
    dibujarJuego();
    showMarco(true);
}

// Función auxiliar para pasar de ImageData a un Canvas que se pueda dibujar fácil con drawImage
function crearCanvasDePieza(w, h, imageData) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').putImageData(imageData, 0, 0);
    return c;
}

function dibujarJuego() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    estadoJuego.piezas.forEach(pieza => {
        const dx = estadoJuego.offsetLeft + (pieza.col * pieza.width);
        const dy = estadoJuego.offsetTop + (pieza.row * pieza.height);

        ctx.save();
        // Trasladar y rotar según el centro de la subimagen
        ctx.translate(dx + pieza.width / 2, dy + pieza.height / 2);
        ctx.rotate((pieza.rotacion * Math.PI) / 180);

        // Dibujar el canvas interno procesado (escalado al tamaño de juego)
        ctx.drawImage(pieza.canvasPropio, -pieza.width / 2, -pieza.height / 2, pieza.width, pieza.height);
        ctx.restore();

        // Borde si la pieza fue fijada por "Ayudita"
        if (pieza.fijada) {
            ctx.strokeStyle = 'gold';
            ctx.lineWidth = 3;
            ctx.strokeRect(dx + 2, dy + 2, pieza.width - 4, pieza.height - 4);
        }
    });
}

// Desactivar menú derecho en el canvas
if (canvas && ctx) {
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('mousedown', function (e) {
        if (estadoJuego.juegoTerminado) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        estadoJuego.piezas.forEach(pieza => {
            const px = estadoJuego.offsetLeft + (pieza.col * pieza.width);
            const py = estadoJuego.offsetTop + (pieza.row * pieza.height);

            // Detectar si el click fue dentro de esta subimagen
            if (clickX >= px && clickX <= px + pieza.width &&
                clickY >= py && clickY <= py + pieza.height) {

                if (!pieza.fijada) {
                    // Rotar: Clic Derecho = 90°, Clic Izquierdo = -90°
                    const sentido = (e.button === 2) ? 90 : -90;
                    pieza.rotacion = (pieza.rotacion + sentido + 360) % 360;

                    dibujarJuego();
                    comprobarVictoria();
                }
            }
        });
    });
}

function usarAyudita() {
    if (!canvas || !ctx || estadoJuego.juegoTerminado) return;
    const candidatas = estadoJuego.piezas.filter((p) => !p.fijada && p.rotacion !== 0);
    if (!candidatas.length) return;
    const elegida = candidatas[Math.floor(Math.random() * candidatas.length)];
    elegida.rotacion = 0;
    elegida.fijada = true;
    estadoJuego.segundosTranscurridos += 5;
    showTimer(true, 'Tiempo: ' + formatearTiempo(estadoJuego.segundosTranscurridos));
    dibujarJuego();
    comprobarVictoria();
}

function setAyudaEnabled(on) {
    const b = document.getElementById('btnAyuda');
    if (b) b.disabled = !on;
}

/* Al ganar se revela la imagen ORIGINAL completa, sin el recorte que se usó
   para armar las piezas cuadradas. Reutiliza la MISMA escala con la que se
   armó el tablero (estadoJuego.escalaFinal), de modo que el reveal se ve
   exactamente del mismo tamaño que el rompecabezas que se acaba de resolver. */
function mostrarImagenCompleta() {
    const img = estadoJuego.imagenNivel;
    if (!canvas || !ctx || !img) return false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const escala = Math.min(estadoJuego.escalaFinal, canvas.width / img.width);
    const w = img.width * escala;
    const h = img.height * escala;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    // El marco pasa a encuadrar la imagen completa, no el tablero recortado anterior
    ubicarMarco(x, y, w, h);
    return true;
}

function comprobarVictoria() {
    // Si todas las piezas tienen rotación 0°
    const gano = estadoJuego.piezas.every(p => p.rotacion === 0);

    if (gano) {
        estadoJuego.juegoTerminado = true;
        setAyudaEnabled(false);
        // Detener temporizador y obtener los tiempos
        const resultado = detenerTemporizador();
        const nivel = estadoJuego.nivelActual;

        // Fase 1: mostrar el rompecabezas armado (el recorte que se usó para jugar)
        estadoJuego.piezas.forEach(pieza => {
            const ctxPieza = pieza.canvasPropio.getContext('2d');
            ctxPieza.putImageData(pieza.imgDataOriginal, 0, 0);
        });
        dibujarJuego();

        // Fase 2: revelar la imagen original completa (solo si hubo recorte)
        // En 4 piezas la grilla 2x2 ya usa la imagen entera, así que no hay nada que revelar.
        const huboRecorte = estadoJuego.cantPartes === 6 || estadoJuego.cantPartes === 8;
        if (huboRecorte) {
            setTimeout(mostrarImagenCompleta, 1500);
        }

        // Fase 3: fondo de victoria + panel de resultados + botonera
        setTimeout(() => {
            if (canvas) canvas.style.display = 'none';
            setCover("img/blockA_victoria.png");
            showVeil(false);
            showMarco(false);
            showTimer(false);
            showNivel(false);
            mostrarPanelVictoria(resultado, nivel);
            const btnSiguiente = document.getElementById('siguiente_nivel');
            if (btnSiguiente) btnSiguiente.style.display = nivel >= 3 ? 'none' : '';
            setBotonera(document.getElementById('botonera2'), true);
        }, huboRecorte ? 3000 : 1500);
    }
}

function mostrarPanelVictoria(resultado, nivel) {
    const panel = document.getElementById('panelVictoria');
    if (!panel) return;
    document.getElementById('vTiempo').textContent = resultado.tiempoTexto;
    document.getElementById('vNivel').textContent = nivel;
    document.getElementById('vDificultad').textContent = resultado.dificultad + ' piezas';
    document.getElementById('vRecord').textContent = resultado.recordTexto;
    document.getElementById('vNuevoRecord').style.display = resultado.esNuevoRecord ? '' : 'none';
    document.getElementById('vFinal').style.display = nivel >= 3 ? '' : 'none';
    panel.style.display = 'block';
}

function ocultarPanelVictoria() {
    const panel = document.getElementById('panelVictoria');
    if (panel) panel.style.display = 'none';
}

// Función para formatear segundos a MM:SS
function formatearTiempo(segundos) {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    const mm = mins < 10 ? '0' + mins : mins;
    const ss = segs < 10 ? '0' + segs : segs;
    return `${mm}:${ss}`;
}

// Iniciar temporizador
function iniciarTemporizador() {
    clearInterval(estadoJuego.timerInterval);
    estadoJuego.segundosTranscurridos = 0;

    showTimer(true, 'Tiempo: 00:00');

    estadoJuego.timerInterval = setInterval(() => {
        estadoJuego.segundosTranscurridos++;
        showTimer(true, 'Tiempo: ' + formatearTiempo(estadoJuego.segundosTranscurridos));
    }, 1000);
}

// Detener temporizador y calcular récord del nivel actual
function detenerTemporizador() {
    clearInterval(estadoJuego.timerInterval);

    const tiempoActual = estadoJuego.segundosTranscurridos;
    const nivel = estadoJuego.nivelActual;
    const dif = estadoJuego.cantPartes;
    if (!estadoJuego.recordPorNivel[dif]) estadoJuego.recordPorNivel[dif] = nivelVacio();
    const recordPrevio = estadoJuego.recordPorNivel[dif][nivel] ?? null;
    let esNuevoRecord = false;

    if (recordPrevio === null || tiempoActual < recordPrevio) {
        estadoJuego.recordPorNivel[dif][nivel] = tiempoActual;
        esNuevoRecord = true;
        guardarRecords(estadoJuego.recordPorNivel);
    }

    return {
        tiempoTexto: formatearTiempo(tiempoActual),
        recordTexto: formatearTiempo(estadoJuego.recordPorNivel[dif][nivel]),
        esNuevoRecord: esNuevoRecord,
        dificultad: dif
    };
}