/* ===========================================================================
   PEGS ON NEON

   Figura        -> clase base: posición y detección de clics
   Ficha         -> hereda de Figura; representa una esfera de neón
   TableroJuego  -> estado de la partida (grilla, fichas) y reglas del juego
   Temporizador  -> cuenta regresiva con límite de tiempo
   Partida       -> coordina TODO: crea el tablero, arranca y reinicia la
                    partida, corre el bucle de render, traduce los eventos
                    del mouse (mousedown / mousemove / mouseup) y actualiza
                    la interfaz (timer + panel de estado/fin)
   =========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const canvas = document.getElementById('canvas');
    const selectorFichas = document.getElementById('selectorFichas');
    const btnComenzar = document.getElementById('comenzarBtn');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playBtn.classList.add('is-playing');
            // El fondo del tablero se dibuja UNA sola vez dentro del canvas,
            // por eso ya no se reemplaza la imagen de portada (era la copia duplicada)
            canvas.style.display = 'block';
            // Inciso 9: en vez de arrancar directo, se elige el tipo de ficha
            if (selectorFichas) selectorFichas.classList.add('visible');
        });
    }

    // Cada opción marca la ficha elegida y quita la marca de las demás
    if (selectorFichas) {
        selectorFichas.querySelectorAll('.selector-opcion').forEach((opcion) => {
            opcion.addEventListener('click', () => {
                selectorFichas.querySelectorAll('.selector-opcion').forEach((otra) => {
                    otra.classList.remove('is-elegida');
                    otra.setAttribute('aria-pressed', 'false');
                });
                opcion.classList.add('is-elegida');
                opcion.setAttribute('aria-pressed', 'true');
            });
        });
    }

    // Comenzar: cierra el selector y arranca la partida con la ficha elegida
    if (btnComenzar) {
        btnComenzar.addEventListener('click', () => {
            const elegida = selectorFichas && selectorFichas.querySelector('.selector-opcion.is-elegida');
            if (selectorFichas) selectorFichas.classList.remove('visible');
            partida.iniciar(elegida ? elegida.dataset.tipo : 'violeta');
        });
    }

    // Solo el panel de fin de partida ofrece reiniciar: NO hay reinicio "en cualquier
    // momento" (el botón de la barra de acciones fue eliminado). Se reinicia únicamente
    // cuando la partida termina (victoria, sin movimientos o tiempo agotado).
    const btnReiniciar = document.getElementById('reiniciarPartidaBtn');
    if (btnReiniciar) btnReiniciar.addEventListener('click', () => {
        // Inciso 9: al terminar/reiniciar, se vuelve a abrir el selector para elegir
        // la nueva variante de ficha de la próxima partida
        if (selectorFichas) selectorFichas.classList.add('visible');
    });
});

// ==========================================
// 1. CLASE PADRE: Figura
// ==========================================
class Figura {
    // Crea la figura en la posición (x, y) del canvas
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    // Método polimórfico vacío: cada subclase define cómo dibujarse en el canvas
    dibujar(contexto) {}

    // ¿El punto (px, py) cae dentro de la figura? Compara la distancia al centro
    // con el radio: sirve para detectar el clic del mouse sobre la ficha.
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
    // Crea una esfera: su radio (tamaño visible), la imagen que se recorta en
    // círculo y la celda (fila, col) que ocupa en la grilla del tablero
    constructor(x, y, radio, imagen, fila, col) {
        super(x, y);
        this.radio = radio;
        this.imagen = imagen;
        this.fila = fila;
        this.col = col;
        this.isDragging = false;
    }

    // Dibuja la esfera: crea un círculo, aplica clip y pinta la imagen dentro
    // (la esfera recortada en forma circular). Si se está arrastrando suma un
    // brillo neón cyan; si la imagen no cargó, usa un círculo de color como respaldo
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

    // Mueve la esfera a nuevas coordenadas de píxel (la sigue mientras se arrastra)
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    // --- Transiciones de estado (el tablero NO toca los atributos directamente) ---

    // Marca la ficha como seleccionada/arrastrada (enciende el brillo cyan)
    seleccionar() {
        this.isDragging = true;
    }

    // Suelta la ficha: quita el estado de arrastre
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
    // Crea el tablero con su geometría calibrada (márgenes y tamaño de casilla),
    // las imágenes de fondo y de ficha, y deja el estado inicial de la partida
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

    // Crea una ficha por cada casilla ocupada, en el centro de su celda
    inicializarFichas() {
        this.fichas = [];
        const RADIO = 19;
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (this.grid[r][c] === 1) {
                    let posX = this.margenX + c * this.tamCasilla + this.tamCasilla / 2;
                    let posY = this.margenY + r * this.tamCasilla + this.tamCasilla / 2;
                    this.fichas.push(new Ficha(posX, posY, RADIO, this.imgFicha, r, c));
                }
            }
        }
    }

    // Convierte píxeles del canvas a coordenadas de la grilla {fila, col}.
    // Devuelve null si el punto queda fuera del tablero o en una casilla inexistente (-1)
    getCoordsMatriz(x, y) {
        let col = Math.floor((x - this.margenX) / this.tamCasilla);
        let fila = Math.floor((y - this.margenY) / this.tamCasilla);
        if (fila >= 0 && fila < 7 && col >= 0 && col < 7 && this.grid[fila][col] !== -1) {
            return { fila, col };
        }
        return null;
    }

    // Inverso de getCoordsMatriz: de una celda de la grilla a su centro en píxeles
    getCoordsPixeles(fila, col) {
        return {
            x: this.margenX + col * this.tamCasilla + this.tamCasilla / 2,
            y: this.margenY + fila * this.tamCasilla + this.tamCasilla / 2
        };
    }

    /* REGLA DEL JUEGO (inciso 4): busca los saltos válidos de la ficha en las
       4 direcciones (arriba, abajo, izquierda, derecha). Un salto es válido si
       la casilla de destino está vacía (0) Y la casilla intermedia tiene otra
       ficha (1) que será capturada. Devuelve cada destino con su posición en
       píxeles y la casilla intermedia (medioFila / medioCol) */
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

    // Renderiza el tablero completo en orden: primero el fondo, después las
    // fichas, los hints animados de los destinos válidos (si hay selección)
    // y arriba de todo la ficha seleccionada
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

    /* MOUSEDOWN (TP4, inciso 6): "encontrar la figura". Recorre las fichas de
       arriba hacia abajo (la última dibujada es la que se ve encima) y busca cuál
       contiene el punto del cursor. Si la encuentra la selecciona → feedback
       visual (highlight cyan) y calcula sus saltos válidos → dibuja las flechas.
       Una ficha se puede agarrar apenas un poco más allá de su borde (margenAgarre) */
    onMouseDown(x, y) {
        // La partida terminó (tiempo agotado o sin movimientos): no se aceptan más clics
        if (this.partidaTerminada) return;
        // Zona de agarre: subí/bajá este porcentaje si querés que se
        // agarre más fácil o más difícil
        const margenAgarre = this.tamCasilla * 0.25;
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

    /* MOUSEMOVE (TP4, inciso 6): "colocarle a la figura la posición del mouse".
       Sólo mueve la ficha si hay una arrastrándose: si no hay ficha seleccionada
       el movimiento del mouse no hace nada */
    onMouseMove(x, y) {
        if (this.fichaSeleccionada) {
            this.fichaSeleccionada.setPosition(x, y);
        }
    }

    /* MOUSEUP (TP4, inciso 6): "soltar la figura". Valida el destino contra los
       saltos calculados. Si coincide, actualiza la grilla (origen vacío, destino
       ocupado), elimina la ficha capturada, ubica la que saltó y suma el
       movimiento; si no coincide, la ficha vuelve sola a su casilla. Al final
       verifica si la partida terminó (inciso 5) */
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

    // Red de seguridad: si el arrastre se interrumpe sin un mouseup (el cursor sale
    // del canvas o la ventana pierde el foco), la ficha vuelve a su casilla
    cancelarArrastre() {
        if (!this.fichaSeleccionada) return;
        const posOrig = this.getCoordsPixeles(this.fichaSeleccionada.fila, this.fichaSeleccionada.col);
        this.fichaSeleccionada.setPosition(posOrig.x, posOrig.y);
        this.fichaSeleccionada.soltar();
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];
    }

    // INCISO 5: se ejecuta tras CADA movimiento. Devuelve true si ninguna ficha
    // del tablero tiene saltos posibles (no quedan movimientos legales)
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
    // Crea la cuenta regresiva con el límite indicado en segundos (120 = 2 minutos);
    // arranca apagado (activo = false) hasta que se llame a iniciar()
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

    // Detiene la cuenta regresiva sin volverla al límite (fin de partida)
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
   las globales (juego, rafActivo, temporizador, ctx):
   son ahora atributos y métodos de esta clase. */
class Partida {
    // segundosLimite: 120 = 2 minutos. Cambiar acá cambia el límite del juego.
    constructor(canvas, segundosLimite = 120) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.temporizador = new Temporizador(segundosLimite);
        this.tablero = null;                 // se crea en iniciar()

        this.rafActivo = null;               // id del requestAnimationFrame en curso

        // Imágenes del tablero: se cargan una sola vez para toda la partida
        this.imgFondo = new Image();
        this.imgFondo.src = 'img/Peg Tablero.jpg';
        // Usamos 'onerror' para que no rompa la ejecución si no encuentra los archivos
        this.imgFondo.onerror = () => console.warn("Aviso: No se encontró la imagen de fondo. Se usará un fondo plano.");

        // Variantes de ficha (inciso 9): se cargan las 3 una sola vez
        this.imgFichas = {
            violeta: new Image(),
            rosa: new Image(),
            verde: new Image()
        };
        this.imgFichas.violeta.src = 'img/ficha.png';
        this.imgFichas.rosa.src = 'img/ficha-rosa.png';
        this.imgFichas.verde.src = 'img/ficha-verde.png';
        // Usamos 'onerror' para que no rompa la ejecución si no encuentra los archivos
        this.imgFichas.violeta.onerror = () => console.warn("Aviso: No se encontró la imagen de ficha. Se usarán círculos.");
        this.imgFichas.rosa.onerror = () => console.warn("Aviso: No se encontró la imagen de ficha rosa. Se usará un círculo.");
        this.imgFichas.verde.onerror = () => console.warn("Aviso: No se encontró la imagen de ficha verde. Se usará un círculo.");
        this.imgFicha = this.imgFichas.violeta;   // la que usa el tablero (la elige el jugador)

        // El bucle se ata a esta instancia: si no, perdería el "this" al ejecutarse
        this.bucle = this.bucle.bind(this);

        this.registrarEventos();
    }

    // ---------- Ciclo de vida de la partida ----------

    // Arranca una partida con la ficha elegida en el selector: crea el tablero,
    // prende el temporizador y enciende el bucle de render (con guardia: nunca
    // dos cadenas de frames en paralelo)
    iniciar(tipoFicha = 'violeta') {
        // Inciso 9: el tablero se dibuja con el tipo de ficha que eligió el jugador
        this.imgFicha = this.imgFichas[tipoFicha] || this.imgFichas.violeta;
        this.tablero = new TableroJuego(this.ctx, 185, 56, 53, this.imgFondo, this.imgFicha);
        // El tablero avisa cuando la partida termina por quedarse sin movimientos
        this.tablero.alFinalizar = (motivo) => this.manejarFinPartida(motivo);
        this.canvas.style.touchAction = 'none'; // sin scroll accidental al arrastrar sobre el tablero

        // Nueva partida: el temporizador vuelve al límite y empieza a correr
        this.temporizador.reiniciar();
        this.temporizador.iniciar();
        this.ocultarPanelFin();
        this.pintarTiempo();
        this.pintarEstado();   // panel de estado: 32 fichas / 0 movimientos

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
        this.pintarTiempo();
        this.pintarEstado();   // vuelve a 32 fichas / 0 movimientos
    }

    // ---------- Bucle de render ----------

    /* Bucle principal (requestAnimationFrame): en cada frame limpia el lienzo,
       avanza el temporizador (si se agota termina la partida), pinta los
       displays (tiempo + panel de estado) y dibuja el tablero. Al final se
       reprograma a sí mismo y guarda el id en rafActivo para no duplicar cadenas */
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

    // Muestra el tiempo restante en el display
    pintarTiempo() {
        const texto = 'Tiempo: ' + this.temporizador.obtenerTexto();
        showTimer(true, texto);
        const el = document.getElementById('timer-display');
        if (el) el.classList.toggle('timer-display--urgente', this.temporizador.enRiesgo());
    }

    // Muestra fichas restantes y movimientos
    pintarEstado() {
        if (!this.tablero) return;
        const fichas = document.getElementById('fichasRestantes');
        const movimientos = document.getElementById('movimientosRealizados');
        if (fichas) fichas.textContent = this.tablero.fichas.length;
        if (movimientos) movimientos.textContent = this.tablero.movimientos;

        const panel = document.getElementById('estado-display');
        if (panel) panel.classList.add('visible');
    }

    // Fin de partida controlado: detiene el timer y muestra el panel con el
    // resultado y el botón de reiniciar. Reemplaza al alert() bloqueante.
    manejarFinPartida(motivo) {
        this.temporizador.detener();
        this.pintarTiempo();
        this.pintarEstado();   // el resumen del panel refleja el estado final

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

    // Oculta el panel de fin y le quita las clases de victoria y de victoria perfecta
    ocultarPanelFin() {
        const panel = document.getElementById('finPartida');
        if (panel) {
            panel.classList.remove('visible');
            panel.classList.remove('fin-partida--victoria');
            panel.classList.remove('fin-partida--perfecta');
        }
    }

    // ---------- Entrada: eventos del mouse ----------

    // TP4 (Tema 4 - Parte B): MouseDown -> encontrar la figura bajo el cursor y
    // darle feedback (highlight); MouseMove -> moverla SÓLO si se está arrastrando;
    // MouseUp -> resolver el salto. Se registran los tres eventos del mouse y,
    // como red de seguridad, su versión en window / salida del canvas.
    registrarEventos() {
        this.canvas.addEventListener('mousedown', (e) => this.manejarMouseAbajo(e));
        this.canvas.addEventListener('mousemove', (e) => this.manejarMouseMover(e));
        this.canvas.addEventListener('mouseup', (e) => this.manejarMouseSoltar(e));

        // Red de seguridad: el mouseup que llega a window (porque se soltó FUERA
        // del canvas) también finaliza el arrastre. Soltar es idempotente: si ya
        // no hay ficha seleccionada no hace nada, así que no se duplica ningún movimiento.
        window.addEventListener('mouseup', (e) => {
            if (!this.tablero || !this.tablero.fichaSeleccionada) return;
            this.manejarMouseSoltar(e);
        });

        // Si el arrastre se interrumpe (el cursor abandona el canvas o la ventana),
        // la ficha vuelve a su casilla en vez de quedar "pegada" al mouse
        const cancelarSeguro = () => { if (this.tablero) this.tablero.cancelarArrastre(); };
        this.canvas.addEventListener('mouseleave', cancelarSeguro);
        window.addEventListener('blur', cancelarSeguro);
    }

    // Convierte las coordenadas del mouse a pixels internos del canvas.
    // Usa clientX/clientY (relativas a la pantalla) llevadas al rectángulo del canvas
    // con getBoundingClientRect(), en lugar de offsetX/offsetY, que quedan deprecated
    // (como se aclaró en clase: "ojo con compatibilidad, Chrome, etc").
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

    // MOUSEDOWN (TP4): escala las coordenadas al lienzo y avisa al tablero, que
    // busca la figura bajo el cursor. Si la encuentra la marca como seleccionada
    // (feedback: brillo cyan) y calcula sus destinos válidos (flechas animadas).
    manejarMouseAbajo(e) {
        if (!this.tablero) return;
        this.canvas.focus(); // para poder jugar también con el teclado
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseDown(pos.x, pos.y);
    }

    // MOUSEMOVE (TP4): escala las coordenadas y le pasa la posición del mouse a
    // la figura que se está arrastrando (si no hay ninguna, el tablero no hace nada)
    manejarMouseMover(e) {
        if (!this.tablero) return;
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseMove(pos.x, pos.y);
    }

    // MOUSEUP (TP4): suelta la figura y resuelve el movimiento: si el destino es
    // un salto válido lo concreta (captura la ficha del medio), si no vuelve a su
    // casilla. Además refresca el panel de estado apenas se concreta el salto
    manejarMouseSoltar(e) {
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
