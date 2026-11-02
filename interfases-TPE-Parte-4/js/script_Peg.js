/* ===========================================================================
   PEGS ON NEON

   Figura        -> clase base: posición y detección de clics
   Ficha         -> hereda de Figura; representa una esfera de neón
   TableroJuego  -> estado de la partida (grilla, fichas) y reglas del juego
   Temporizador  -> cuenta regresiva con límite de tiempo
   Partida       -> coordina TODO: crea el tablero, arranca y reinicia la
                    partida, corre el bucle de render, traduce los eventos
                    del puntero y actualiza la interfaz (timer + panel de fin)
   =========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const canvas = document.getElementById('canvas');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playBtn.classList.add('is-playing');
            // El fondo del tablero se dibuja UNA sola vez dentro del canvas,
            // por eso ya no se reemplaza la imagen de portada (era la copia duplicada)
            canvas.style.display = 'block';
            partida.iniciar();
        });
    }

    // Solo el panel de fin de partida ofrece reiniciar: NO hay reinicio "en cualquier
    // momento" (el botón de la barra de acciones fue eliminado). Se reinicia únicamente
    // cuando la partida termina (victoria, sin movimientos o tiempo agotado).
    const btnReiniciar = document.getElementById('reiniciarPartidaBtn');
    if (btnReiniciar) btnReiniciar.addEventListener('click', () => partida.reiniciar());
});

// ==========================================
// 1. CLASE PADRE: Figura
// ==========================================
class Figura {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    dibujar(contexto) {}

    // margen: tolerancia extra para facilitar el agarre (0 = solo el dibujo de la ficha)
    containsPoint(px, py, margen = 0) {
        const dx = this.x - px;
        const dy = this.y - py;
        const r = this.radio + margen;
        return (dx * dx + dy * dy) <= (r * r);
    }
}

// ==========================================
// 2. CLASE FICHA
// ==========================================
class Ficha extends Figura {
    constructor(x, y, radio, imagen, fila, col) {
        super(x, y);
        this.radio = radio;
        this.imagen = imagen;
        this.fila = fila;
        this.col = col;
        this.isDragging = false;
    }

    dibujar(contexto) {
        contexto.save();
        if (this.isDragging) {
            contexto.shadowColor = '#00ffff'; // Brillo Neón Cyan
            contexto.shadowBlur = 18;
            contexto.shadowOffsetX = 0;
            contexto.shadowOffsetY = 0;
        }

        if (this.imagen && this.imagen.complete && this.imagen.naturalWidth !== 0) {
            // 1. Crear el camino del círculo de la ficha
            contexto.beginPath();
            contexto.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
            contexto.closePath();

            // 2. Aplicar la máscara de recorte
            contexto.clip();

            // 3. Dibujar la imagen recortada en forma circular
            contexto.drawImage(
                this.imagen,
                this.x - this.radio,
                this.y - this.radio,
                this.radio * 2,
                this.radio * 2
            );
        }
         else {
            contexto.beginPath();
            contexto.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
            contexto.fillStyle = '#1e88e5'; // Color temporal de prueba
            contexto.fill();
            contexto.strokeStyle = '#0d47a1';
            contexto.lineWidth = 3;
            contexto.stroke();
            contexto.closePath();
        }
        contexto.restore();
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    // --- Transiciones de estado (el tablero NO toca los atributos directamente) ---

    seleccionar() {
        this.isDragging = true;
    }

    soltar() {
        this.isDragging = false;
    }

    // Ubica la ficha en una celda del tablero (coordenada de matriz + de píxel)
    ubicarEn(fila, col, x, y) {
        this.fila = fila;
        this.col = col;
        this.setPosition(x, y);
    }
}

// ==========================================
// 3. CLASE TABLERO / JUEGO
// ==========================================
class TableroJuego {
    constructor(ctx, margenX, margenY, tamCasilla, imgFondo, imgFicha) {
        this.ctx = ctx;
        this.margenX = margenX;
        this.margenY = margenY;
        this.tamCasilla = tamCasilla;
        this.imgFondo = imgFondo;
        this.imgFicha = imgFicha;

        this.grid = TableroJuego.grillaInicial();

        this.fichas = [];
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];
        this.animOffset = 0;
        // Contador de saltos válidos realizados en la partida (se muestra en el panel de estado)
        this.movimientos = 0;
        // true = la partida terminó (victoria, tiempo agotado o sin movimientos): tablero bloqueado
        this.partidaTerminada = false;
        // Callback que avisa el fin de la partida. Lo asigna Partida.
        this.alFinalizar = null;

        this.inicializarFichas();
    }

    // Grilla inicial de la partida: tablero en cruz con el centro vacío
    static grillaInicial() {
        return [
            [-1, -1,  1,  1,  1, -1, -1],
            [-1, -1,  1,  1,  1, -1, -1],
            [ 1,  1,  1,  1,  1,  1,  1],
            [ 1,  1,  1,  0,  1,  1,  1], // Centro vacío
            [ 1,  1,  1,  1,  1,  1,  1],
            [-1, -1,  1,  1,  1, -1, -1],
            [-1, -1,  1,  1,  1, -1, -1]
        ];
    }

    // Devuelve el tablero al estado inicial de una nueva partida
    reiniciar() {
        this.grid = TableroJuego.grillaInicial();
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];
        this.animOffset = 0;
        this.movimientos = 0;      // nueva partida: el contador de movimientos vuelve a cero
        this.partidaTerminada = false;
        this.inicializarFichas();
    }

    // Bloquea el tablero al terminar la partida (y suelta cualquier arrastre en curso)
    finalizarPartida() {
        this.partidaTerminada = true;
        this.cancelarArrastre();
    }

    inicializarFichas() {
        this.fichas = [];
        const RADIO_VISIBLE = 37.7 / 2;   // = 18.85 px
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (this.grid[r][c] === 1) {
                    let posX = this.margenX + c * this.tamCasilla + this.tamCasilla / 2;
                    let posY = this.margenY + r * this.tamCasilla + this.tamCasilla / 2;
                    this.fichas.push(new Ficha(posX, posY, RADIO_VISIBLE, this.imgFicha, r, c));
                }
            }
        }
    }

    getCoordsMatriz(x, y) {
        let col = Math.floor((x - this.margenX) / this.tamCasilla);
        let fila = Math.floor((y - this.margenY) / this.tamCasilla);
        if (fila >= 0 && fila < 7 && col >= 0 && col < 7 && this.grid[fila][col] !== -1) {
            return { fila, col };
        }
        return null;
    }

    getCoordsPixeles(fila, col) {
        return {
            x: this.margenX + col * this.tamCasilla + this.tamCasilla / 2,
            y: this.margenY + fila * this.tamCasilla + this.tamCasilla / 2
        };
    }

    obtenerMovimientosValidos(ficha) {
        const direcciones = [
            { df: -2, dc: 0, mf: -1, mc: 0 },
            { df: 2,  dc: 0, mf: 1,  mc: 0 },
            { df: 0, dc: -2, mf: 0, mc: -1 },
            { df: 0, dc: 2,  mf: 0, mc: 1 }
        ];

        let validos = [];
        let r = ficha.fila;
        let c = ficha.col;

        direcciones.forEach(d => {
            let rf = r + d.df;
            let cf = c + d.dc;
            let rm = r + d.mf;
            let cm = c + d.mc;

            if (rf >= 0 && rf < 7 && cf >= 0 && cf < 7) {
                if (this.grid[rm] && this.grid[rm][cm] === 1 && this.grid[rf][cf] === 0) {
                    let pos = this.getCoordsPixeles(rf, cf);
                    validos.push({ fila: rf, col: cf, x: pos.x, y: pos.y, medioFila: rm, medioCol: cm });
                }
            }
        });
        return validos;
    }

    // Fondo fijo: cubre TODO el canvas una sola vez, centrado y sin distorsión
    // (mismo encuadre que hacía la portada con object-fit: cover)
    dibujarFondo() {
        const img = this.imgFondo;
        const ancho = this.ctx.canvas.width;
        const alto = this.ctx.canvas.height;

        if (img && img.complete && img.naturalWidth !== 0) {
            // Escala mínima que cubre todo el lienzo, manteniendo la proporción de la imagen
            const escala = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight);
            const imgAncho = img.naturalWidth * escala;
            const imgAlto = img.naturalHeight * escala;
            this.ctx.drawImage(img, (ancho - imgAncho) / 2, (alto - imgAlto) / 2, imgAncho, imgAlto);
        } else {
            // Respaldo mientras carga la imagen (o si falta el archivo)
            this.ctx.fillStyle = '#0b0e1a';
            this.ctx.fillRect(0, 0, ancho, alto);
        }
    }

    dibujar(tiempo) {
        // 1. Fondo fijo del tablero (una sola imagen, ocupa todo el reproductor)
        this.dibujarFondo();

        // 2. Fichas normales
        this.fichas.forEach(f => {
            if (f !== this.fichaSeleccionada) f.dibujar(this.ctx);
        });

        // 3. Hints Animados
        if (this.fichaSeleccionada && this.movimientosValidos.length > 0) {
            this.animOffset += 0.08;
            let pulso = Math.sin(this.animOffset) * 6;

            this.movimientosValidos.forEach(m => {
                this.ctx.fillStyle = '#ffd23f';
                this.ctx.strokeStyle = '#d97706';
                this.ctx.lineWidth = 2;

                let x = m.x;
                let y = m.y - this.tamCasilla * 0.4 + pulso;

                this.ctx.beginPath();
                this.ctx.moveTo(x, y + 10);
                this.ctx.lineTo(x - 10, y - 5);
                this.ctx.lineTo(x + 10, y - 5);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
            });
        }

        // 4. Ficha seleccionada (arriba de todo)
        if (this.fichaSeleccionada) {
            this.fichaSeleccionada.dibujar(this.ctx);
        }
    }

    onMouseDown(x, y) {
        // La partida terminó (tiempo agotado o sin movimientos): no se aceptan más clics
        if (this.partidaTerminada) return;
        // Zona de agarre: subí/bajá este porcentaje si querés que se
        // agarre más fácil o más difícil
        const margenAgarre = this.tamCasilla * 0.27;
        for (let i = this.fichas.length - 1; i >= 0; i--) {
            let f = this.fichas[i];
            if (f.containsPoint(x, y, margenAgarre)) {
                this.fichaSeleccionada = f;
                f.seleccionar();
                this.movimientosValidos = this.obtenerMovimientosValidos(f);
                break;
            }
        }
    }

    onMouseMove(x, y) {
        if (this.fichaSeleccionada) {
            this.fichaSeleccionada.setPosition(x, y);
        }
    }

    onMouseUp(x, y) {
        if (!this.fichaSeleccionada) return;

        let destinoMatriz = this.getCoordsMatriz(x, y);
        let movimientoExitoso = false;

        if (destinoMatriz) {
            let movValido = this.movimientosValidos.find(
                m => m.fila === destinoMatriz.fila && m.col === destinoMatriz.col
            );

            if (movValido) {
                this.grid[this.fichaSeleccionada.fila][this.fichaSeleccionada.col] = 0;
                this.grid[movValido.medioFila][movValido.medioCol] = 0;
                this.grid[destinoMatriz.fila][destinoMatriz.col] = 1;

                this.fichas = this.fichas.filter(
                    f => !(f.fila === movValido.medioFila && f.col === movValido.medioCol)
                );

                let nuevaPos = this.getCoordsPixeles(destinoMatriz.fila, destinoMatriz.col);
                this.fichaSeleccionada.ubicarEn(destinoMatriz.fila, destinoMatriz.col, nuevaPos.x, nuevaPos.y);

                this.movimientos++; // un salto válido = un movimiento más para el panel de estado
                movimientoExitoso = true;
            }
        }

        if (!movimientoExitoso) {
            let posOrig = this.getCoordsPixeles(this.fichaSeleccionada.fila, this.fichaSeleccionada.col);
            this.fichaSeleccionada.setPosition(posOrig.x, posOrig.y);
        }

        this.fichaSeleccionada.soltar();
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];

        if (movimientoExitoso && this.verificarFinJuego()) {
            /* Fin de partida controlado (sin alert bloqueante): bloquea el tablero
               y muestra el panel con el botón de reiniciar.
               Tres motivos distintos:
                 - 'victoria-perfecta' -> quedó UNA sola ficha, exactamente en el centro (3,3)
                 - 'victoria'          -> quedó UNA sola ficha en cualquier otra casilla
                 - 'sin-movimientos'   -> quedaron varias fichas y ninguna tiene saltos posibles */
            this.finalizarPartida();
            let motivo = 'sin-movimientos';
            if (this.fichas.length === 1) {
                const ultima = this.fichas[0];
                motivo = (ultima.fila === 3 && ultima.col === 3) ? 'victoria-perfecta' : 'victoria';
            }
            if (this.alFinalizar) this.alFinalizar(motivo);
        }
    }

    // Cancela el arrastre sin soltar: la ficha vuelve a su casilla
    cancelarArrastre() {
        if (!this.fichaSeleccionada) return;
        const posOrig = this.getCoordsPixeles(this.fichaSeleccionada.fila, this.fichaSeleccionada.col);
        this.fichaSeleccionada.setPosition(posOrig.x, posOrig.y);
        this.fichaSeleccionada.soltar();
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];
    }

    verificarFinJuego() {
        for (let f of this.fichas) {
            let movs = this.obtenerMovimientosValidos(f);
            if (movs.length > 0) return false;
        }
        return true;
    }
}

// ==========================================
// 4. TEMPORIZADOR (límite de tiempo de la partida)
// ==========================================
/* Cuenta regresiva con límite. Se actualiza en cada frame del bucle de render
   usando el timestamp de requestAnimationFrame, así que no necesita setInterval
   propio y se pausa solo si la pestaña queda en segundo plano. */
class Temporizador {
    constructor(segundosLimite) {
        this.segundosLimite = segundosLimite;   // límite configurable (120 = 2 minutos)
        this.segundosRestantes = segundosLimite;
        this.activo = false;                   // está corriendo la cuenta regresiva
        this.agotado = false;                  // llegó a cero
        this.ultimoTs = null;                  // timestamp del frame anterior
    }

    // Arranca (o reanuda) la cuenta desde donde esté
    iniciar() {
        this.activo = true;
        this.ultimoTs = null; // evita un salto de tiempo enorme en el primer frame
    }

    detener() {
        this.activo = false;
    }

    // Vuelve al límite completo y apaga los estados (para reiniciar la partida)
    reiniciar() {
        this.segundosRestantes = this.segundosLimite;
        this.agotado = false;
        this.activo = false;
        this.ultimoTs = null;
    }

    /* Se ejecuta en cada frame. Devuelve true SOLO en el frame en que se agota,
       para que el juego reaccione una única vez. */
    actualizar(ts) {
        if (!this.activo || this.agotado) return false;

        if (this.ultimoTs === null) {
            this.ultimoTs = ts;
            return false;
        }

        const deltaSegundos = (ts - this.ultimoTs) / 1000;
        this.ultimoTs = ts;
        this.segundosRestantes = Math.max(0, this.segundosRestantes - deltaSegundos);

        if (this.segundosRestantes <= 0) {
            this.segundosRestantes = 0;
            this.agotado = true;
            this.activo = false;
            return true;
        }
        return false;
    }

    // ¿Faltan 10 segundos o menos? (para el aviso visual del display)
    enRiesgo(umbralSegundos = 10) {
        return this.activo && this.segundosRestantes <= umbralSegundos;
    }

    // Texto "01:59" (redondea hacia arriba para que muestre 02:00 al inicio)
    obtenerTexto() {
        const total = Math.ceil(this.segundosRestantes);
        const minutos = Math.floor(total / 60);
        const segundos = total % 60;
        return String(minutos).padStart(2, '0') + ':' + String(segundos).padStart(2, '0');
    }
}

// ==========================================
// 5. CLASE PARTIDA (coordina todo el juego)
// ==========================================
/* Dueña del ciclo de vida del juego. Concentra lo que antes eran funciones
   sueltas (iniciarJuego, gameLoop, reiniciarPartida, manejarFinPartida, ...) y
   las globales (juego, rafActivo, temporizador, textoTiempoMostrado, ctx):
   son ahora atributos y métodos de esta clase. */
class Partida {
    // segundosLimite: 120 = 2 minutos. Cambiar acá cambia el límite del juego.
    constructor(canvas, segundosLimite = 120) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.temporizador = new Temporizador(segundosLimite);
        this.tablero = null;                 // se crea en iniciar()

        this.rafActivo = null;               // id del requestAnimationFrame en curso
        this.textoTiempoMostrado = null;     // último texto pintado (evita tocar el DOM de más)
        this.fichasMostradas = null;         // último contador de fichas pintado en el panel
        this.movimientosMostrados = null;    // último contador de movimientos pintado

        // Imágenes del tablero: se cargan una sola vez para toda la partida
        this.imgFondo = new Image();
        this.imgFondo.src = 'img/Peg Tablero.jpg';
        // Usamos 'onerror' para que no rompa la ejecución si no encuentra los archivos
        this.imgFondo.onerror = () => console.warn("Aviso: No se encontró la imagen de fondo. Se usará un fondo plano.");

        this.imgFicha = new Image();
        this.imgFicha.src = 'img/ficha.png';
        this.imgFicha.onerror = () => console.warn("Aviso: No se encontró la imagen de ficha. Se usarán círculos.");

        // El bucle se ata a esta instancia: si no, perdería el "this" al ejecutarse
        this.bucle = this.bucle.bind(this);

        this.registrarEventos();
    }

    // ---------- Ciclo de vida de la partida ----------

    // Arranca una partida: crea el tablero, prende el temporizador y enciende
    // el bucle de render (con guardia: nunca dos cadenas de frames en paralelo)
    iniciar() {
        // Grilla calibrada contra los huecos reales de img/Peg Tablero.jpg (medidos con la
        // imagen escalada en "cover" al canvas 755x472):
        //   paso real de los huecos = 53.1px (horizontal) / 52.1px (vertical) -> promedio 52.6
        //   centro del primer hueco = (211.9, 82.2)  ->  margen = centro - paso/2
        // El 50 / 195 / 64 anteriores dejaban la ficha corrida hasta ~10px en los bordes.
        this.tablero = new TableroJuego(this.ctx, 185.6, 55.9, 52.6, this.imgFondo, this.imgFicha);
        // El tablero avisa cuando la partida termina por quedarse sin movimientos
        this.tablero.alFinalizar = (motivo) => this.manejarFinPartida(motivo);
        this.canvas.style.touchAction = 'none'; // permite arrastrar con el dedo sin scrollear la página

        // Nueva partida: el temporizador vuelve al límite y empieza a correr
        this.temporizador.reiniciar();
        this.temporizador.iniciar();
        this.ocultarPanelFin();
        this.pintarTiempo(true);
        this.pintarEstado(true);   // panel de estado: 32 fichas / 0 movimientos

        // Solo arranca el bucle si todavía no está corriendo (si no, cada llamada
        // acumulaba una cadena nueva de frames y corrían varias en paralelo)
        if (this.rafActivo === null) {
            this.rafActivo = requestAnimationFrame(this.bucle);
        }
    }

    /* Reinicio de la partida: tablero nuevo, temporizador de vuelta al límite y
       panel de fin oculto. Si todavía no se había empezado, arranca desde cero. */
    reiniciar() {
        if (!this.tablero) {
            const playBtn = document.getElementById('playBtn');
            if (playBtn) playBtn.click();
            return;
        }

        this.tablero.reiniciar();
        this.temporizador.reiniciar();
        this.temporizador.iniciar();
        this.ocultarPanelFin();
        this.pintarTiempo(true);
        this.pintarEstado(true);   // vuelve a 32 fichas / 0 movimientos
    }

    // ---------- Bucle de render ----------

    bucle(tiempo) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.tablero) {
            // La cuenta regresiva avanza con cada frame; al agotarse se termina la partida
            if (this.temporizador.actualizar(tiempo)) {
                this.tablero.finalizarPartida();
                this.manejarFinPartida('tiempo');
            }
            this.pintarTiempo();
            this.pintarEstado();
            this.tablero.dibujar(tiempo / 1000);
        }
        this.rafActivo = requestAnimationFrame(this.bucle);
    }

    // ---------- Interfaz (display del timer y panel de fin) ----------

    // Escribe el tiempo restante en el display. Solo toca el DOM cuando cambia
    // el segundo visible (se llama en cada frame del bucle).
    pintarTiempo(forzar = false) {
        const texto = 'Tiempo: ' + this.temporizador.obtenerTexto();
        if (!forzar && texto === this.textoTiempoMostrado) return;
        this.textoTiempoMostrado = texto;

        showTimer(true, texto); // helper compartido de script.js (muestra el display)
        const el = document.getElementById('timer-display');
        if (el) el.classList.toggle('timer-display--urgente', this.temporizador.enRiesgo());
    }

    /* Panel de estado: fichas restantes y movimientos realizados de la partida.
       Muestra en pantalla que la lógica del juego está viva (incisos 4 y 5) y le
       indica al jugador cómo le va. Solo toca el DOM cuando un valor cambió. */
    pintarEstado(forzar = false) {
        if (!this.tablero) return;
        const fichas = this.tablero.fichas.length;
        const movimientos = this.tablero.movimientos;

        if (forzar || fichas !== this.fichasMostradas) {
            const el = document.getElementById('fichasRestantes');
            if (el) el.textContent = fichas;
            this.fichasMostradas = fichas;
        }
        if (forzar || movimientos !== this.movimientosMostrados) {
            const el = document.getElementById('movimientosRealizados');
            if (el) el.textContent = movimientos;
            this.movimientosMostrados = movimientos;
        }

        // Mostrar el display solo mientras hay una partida en curso
        const panel = document.getElementById('estado-display');
        if (panel) panel.classList.add('visible');
    }

    // Fin de partida controlado: detiene el timer y muestra el panel con el
    // resultado y el botón de reiniciar. Reemplaza al alert() bloqueante.
    manejarFinPartida(motivo) {
        this.temporizador.detener();
        this.pintarTiempo(true);
        this.pintarEstado(true);   // el resumen del panel refleja el estado final

        /* Tres motivos de fin posibles:
           - 'victoria-perfecta' -> una sola ficha, exactamente en el centro del tablero
           - 'victoria'          -> una sola ficha, en cualquier casilla
           - 'sin-movimientos'   -> quedaron fichas pero ningún salto posible
           - 'tiempo'            -> se agotó el límite de tiempo               */
        const mensajes = {
            'victoria-perfecta': '¡Victoria Perfecta! ✨',
            'victoria': '¡Victoria! 🏆 ¡Ganaste!',
            'sin-movimientos': '¡Juego terminado! No quedan movimientos posibles.',
            'tiempo': '¡Tiempo agotado!'
        };
        this.mostrarPanelFin(mensajes[motivo] || mensajes['sin-movimientos'], motivo);
    }

    /* Muestra el panel de fin con el mensaje, la línea de resumen
       (fichas restantes | movimientos) y, si ganó, el estilo de victoria. */
    mostrarPanelFin(motivoTexto, motivo = 'sin-movimientos') {
        const panel = document.getElementById('finPartida');
        const msg = document.getElementById('finPartidaMensaje');
        const linea = document.getElementById('finPartidaLinea');
        if (msg) msg.textContent = motivoTexto;
        if (linea && this.tablero) {
            linea.textContent = 'Fichas restantes: ' + this.tablero.fichas.length +
                                ' | Movimientos: ' + this.tablero.movimientos;
        }
        if (panel) {
            // Cualquier victoria usa el estilo verde; la perfecta suma su propio brillo
            panel.classList.toggle('fin-partida--victoria', motivo.startsWith('victoria'));
            panel.classList.toggle('fin-partida--perfecta', motivo === 'victoria-perfecta');
            panel.classList.add('visible');
        }
    }

    ocultarPanelFin() {
        const panel = document.getElementById('finPartida');
        if (panel) {
            panel.classList.remove('visible');
            panel.classList.remove('fin-partida--victoria');
            panel.classList.remove('fin-partida--perfecta');
        }
    }

    // ---------- Entrada: eventos del puntero ----------

    registrarEventos() {
        this.canvas.addEventListener('pointerdown', (e) => this.manejarPunteroAbajo(e));
        this.canvas.addEventListener('pointermove', (e) => this.manejarPunteroMover(e));
        this.canvas.addEventListener('pointerup', (e) => this.manejarPunteroSoltar(e));

        // Red de seguridad por si la captura de puntero no estuvo disponible: el
        // pointerup que llega a window (porque se soltó FUERA del canvas) también
        // finaliza el arrastre. Soltar es idempotente: si ya no hay ficha
        // seleccionada no hace nada, así que no se duplica ningún movimiento.
        window.addEventListener('pointerup', (e) => {
            if (!this.tablero || !this.tablero.fichaSeleccionada) return;
            this.manejarPunteroSoltar(e);
        });

        // Si el arrastre se interrumpe (se suelta fuera del canvas, cambia de
        // ventana, etc.), la ficha vuelve a su casilla en vez de quedar "pegada"
        const cancelarSeguro = () => { if (this.tablero) this.tablero.cancelarArrastre(); };
        this.canvas.addEventListener('pointercancel', cancelarSeguro);
        window.addEventListener('pointercancel', cancelarSeguro);
    }

    // Convierte las coordenadas del puntero a pixels internos del canvas.
    // El lienzo se estira con CSS (755x472 -> tamaño del reproductor), así que sin
    // esta escala el clic se detectaba corrido: se agarraba solo el centro/arriba de la ficha.
    obtenerPosicionCanvas(e) {
        const rect = this.canvas.getBoundingClientRect();
        const escalaX = this.canvas.width / (rect.width || this.canvas.width);
        const escalaY = this.canvas.height / (rect.height || this.canvas.height);
        return {
            x: (e.clientX - rect.left) * escalaX,
            y: (e.clientY - rect.top) * escalaY
        };
    }

    manejarPunteroAbajo(e) {
        if (!this.tablero) return;
        // Captura el puntero: si se suelta FUERA del canvas, pointermove/pointerup
        // llegan igual acá y la ficha vuelve a su casilla, en vez de quedar colgada
        // siguiendo al cursor. (try/catch: con punteros sintéticos no hay captura)
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* aplica el fallback de window */ }
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseDown(pos.x, pos.y);
    }

    manejarPunteroMover(e) {
        if (!this.tablero) return;
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseMove(pos.x, pos.y);
    }

    manejarPunteroSoltar(e) {
        if (!this.tablero) return;
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseUp(pos.x, pos.y);
        this.pintarEstado(); // actualiza fichas/movimientos apenas se concreta el salto
    }
}

// ==========================================
// 6. PUNTO DE ENTRADA
// ==========================================
// Único objeto global del juego: toda la coordinación vive dentro de Partida
const partida = new Partida(document.getElementById('canvas'), 120);
