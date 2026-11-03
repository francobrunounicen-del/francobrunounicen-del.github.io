// ==========================================
// PEGS ON NEON - Solitario de clavijas
// Clases: Figura, Ficha, TableroJuego, Temporizador y Partida
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const canvas = document.getElementById('canvas');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playBtn.classList.add('is-playing');
            canvas.style.display = 'block';
            partida.iniciar();
        });
    }

    // El reinicio se hace solo desde el panel de fin de partida
    const btnReiniciar = document.getElementById('reiniciarPartidaBtn');
    if (btnReiniciar) btnReiniciar.addEventListener('click', () => partida.reiniciar());
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

    // Cada subclase define cómo se dibuja
    dibujar(contexto) {}

    // Devuelve true si el punto (px, py) cae dentro de la figura.
    // margen: tolerancia extra para facilitar el agarre con el mouse
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
    // Radio visible, imagen y celda (fila, col) que ocupa en la grilla
    constructor(x, y, radio, imagen, fila, col) {
        super(x, y);
        this.radio = radio;
        this.imagen = imagen;
        this.fila = fila;
        this.col = col;
        this.isDragging = false;
    }

    // Dibuja la esfera recortando la imagen en un círculo.
    // Si se está arrastrando suma un brillo cyan y, si la imagen no cargó, dibuja un círculo
    dibujar(contexto) {
        contexto.save();
        if (this.isDragging) {
            contexto.shadowColor = '#00ffff';
            contexto.shadowBlur = 18;
            contexto.shadowOffsetX = 0;
            contexto.shadowOffsetY = 0;
        }

        if (this.imagen && this.imagen.complete && this.imagen.naturalWidth !== 0) {
            contexto.beginPath();
            contexto.arc(this.x, this.y, this.radio, 0, Math.PI * 2);
            contexto.closePath();
            contexto.clip();
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
            contexto.fillStyle = '#1e88e5';
            contexto.fill();
            contexto.strokeStyle = '#0d47a1';
            contexto.lineWidth = 3;
            contexto.stroke();
            contexto.closePath();
        }
        contexto.restore();
    }

    // Mueve la ficha a una nueva posición en píxeles
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    // --- Cambios de estado de la ficha ---

    // Marca la ficha como seleccionada (enciende el brillo)
    seleccionar() {
        this.isDragging = true;
    }

    // Suelta la ficha
    soltar() {
        this.isDragging = false;
    }

    // Ubica la ficha en una celda (matriz) y en su centro en píxeles
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
    // Recibe el contexto, la geometría del tablero y las imágenes
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
        this.movimientos = 0;          // saltos válidos de la partida
        this.partidaTerminada = false; // bloquea el tablero al terminar
        this.alFinalizar = null;       // lo asigna Partida

        this.inicializarFichas();
    }

    // Grilla inicial: 1 = ficha, 0 = casilla vacía, -1 = casilla que no existe
    static grillaInicial() {
        return [
            [-1, -1,  1,  1,  1, -1, -1],
            [-1, -1,  1,  1,  1, -1, -1],
            [ 1,  1,  1,  1,  1,  1,  1],
            [ 1,  1,  1,  0,  1,  1,  1], // centro vacío
            [ 1,  1,  1,  1,  1,  1,  1],
            [-1, -1,  1,  1,  1, -1, -1],
            [-1, -1,  1,  1,  1, -1, -1]
        ];
    }

    // Vuelve al estado inicial de una nueva partida
    reiniciar() {
        this.grid = TableroJuego.grillaInicial();
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];
        this.animOffset = 0;
        this.movimientos = 0;
        this.partidaTerminada = false;
        this.inicializarFichas();
    }

    // Bloquea el tablero cuando termina la partida
    finalizarPartida() {
        this.partidaTerminada = true;
        this.cancelarArrastre();
    }

    // Crea una ficha por cada casilla ocupada, en el centro de su celda
    inicializarFichas() {
        this.fichas = [];
        const RADIO_VISIBLE = 37.7 / 2;
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

    // Pasa de píxeles a fila/col de la grilla (null si no es una casilla válida)
    getCoordsMatriz(x, y) {
        let col = Math.floor((x - this.margenX) / this.tamCasilla);
        let fila = Math.floor((y - this.margenY) / this.tamCasilla);
        if (fila >= 0 && fila < 7 && col >= 0 && col < 7 && this.grid[fila][col] !== -1) {
            return { fila, col };
        }
        return null;
    }

    // Pasa de fila/col al centro de esa casilla en píxeles
    getCoordsPixeles(fila, col) {
        return {
            x: this.margenX + col * this.tamCasilla + this.tamCasilla / 2,
            y: this.margenY + fila * this.tamCasilla + this.tamCasilla / 2
        };
    }

    // Inciso 4: saltos válidos de la ficha en las 4 direcciones.
    // El destino tiene que estar vacío y la casilla del medio ocupada (esa ficha se captura)
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

    // Dibuja el fondo ocupando todo el canvas, centrado y sin deformar
    dibujarFondo() {
        const img = this.imgFondo;
        const ancho = this.ctx.canvas.width;
        const alto = this.ctx.canvas.height;

        if (img && img.complete && img.naturalWidth !== 0) {
            const escala = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight);
            const imgAncho = img.naturalWidth * escala;
            const imgAlto = img.naturalHeight * escala;
            this.ctx.drawImage(img, (ancho - imgAncho) / 2, (alto - imgAlto) / 2, imgAncho, imgAlto);
        } else {
            this.ctx.fillStyle = '#0b0e1a';
            this.ctx.fillRect(0, 0, ancho, alto);
        }
    }

    // Dibuja fondo, fichas, hints de los destinos válidos y la ficha seleccionada arriba de todo
    dibujar(tiempo) {
        this.dibujarFondo();

        this.fichas.forEach(f => {
            if (f !== this.fichaSeleccionada) f.dibujar(this.ctx);
        });

        // Hints animados (flechas)
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

        // La ficha seleccionada se dibuja última
        if (this.fichaSeleccionada) {
            this.fichaSeleccionada.dibujar(this.ctx);
        }
    }

    // Inciso 6 - mousedown: busca la ficha bajo el cursor, la selecciona
    // y calcula sus movimientos válidos
    onMouseDown(x, y) {
        if (this.partidaTerminada) return;
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

    // Inciso 6 - mousemove: la ficha seleccionada sigue al mouse
    onMouseMove(x, y) {
        if (this.fichaSeleccionada) {
            this.fichaSeleccionada.setPosition(x, y);
        }
    }

    // Inciso 6 - mouseup: si el destino es un salto válido lo hace; si no, la ficha vuelve.
    // Después revisa si la partida terminó (inciso 5)
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

                this.movimientos++;
                movimientoExitoso = true;
            }
        }

        // Si no fue un salto válido, la ficha vuelve a su casilla
        if (!movimientoExitoso) {
            let posOrig = this.getCoordsPixeles(this.fichaSeleccionada.fila, this.fichaSeleccionada.col);
            this.fichaSeleccionada.setPosition(posOrig.x, posOrig.y);
        }

        this.fichaSeleccionada.soltar();
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];

        if (movimientoExitoso && this.verificarFinJuego()) {
            this.finalizarPartida();
            let motivo = 'sin-movimientos';
            if (this.fichas.length === 1) {
                const ultima = this.fichas[0];
                motivo = (ultima.fila === 3 && ultima.col === 3) ? 'victoria-perfecta' : 'victoria';
            }
            if (this.alFinalizar) this.alFinalizar(motivo);
        }
    }

    // Cancela el arrastre y devuelve la ficha a su casilla
    cancelarArrastre() {
        if (!this.fichaSeleccionada) return;
        const posOrig = this.getCoordsPixeles(this.fichaSeleccionada.fila, this.fichaSeleccionada.col);
        this.fichaSeleccionada.setPosition(posOrig.x, posOrig.y);
        this.fichaSeleccionada.soltar();
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];
    }

    // Inciso 5: se llama después de cada movimiento.
    // Devuelve true si ninguna ficha tiene saltos posibles
    verificarFinJuego() {
        for (let f of this.fichas) {
            let movs = this.obtenerMovimientosValidos(f);
            if (movs.length > 0) return false;
        }
        return true;
    }
}

// ==========================================
// 4. TEMPORIZADOR
// ==========================================
class Temporizador {
    // Límite en segundos (120 = 2 minutos); arranca detenido
    constructor(segundosLimite) {
        this.segundosLimite = segundosLimite;
        this.segundosRestantes = segundosLimite;
        this.activo = false;
        this.agotado = false;
        this.ultimoTs = null;
    }

    // Arranca la cuenta regresiva
    iniciar() {
        this.activo = true;
        this.ultimoTs = null;
    }

    // Detiene la cuenta regresiva (fin de partida)
    detener() {
        this.activo = false;
    }

    // Vuelve al límite y apaga los estados (reinicio)
    reiniciar() {
        this.segundosRestantes = this.segundosLimite;
        this.agotado = false;
        this.activo = false;
        this.ultimoTs = null;
    }

    // Se llama en cada frame. Devuelve true solo en el frame en que se agota
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

    // true si quedan 10 segundos o menos
    enRiesgo(umbralSegundos = 10) {
        return this.activo && this.segundosRestantes <= umbralSegundos;
    }

    // Texto del tiempo en formato 00:00
    obtenerTexto() {
        const total = Math.ceil(this.segundosRestantes);
        const minutos = Math.floor(total / 60);
        const segundos = total % 60;
        return String(minutos).padStart(2, '0') + ':' + String(segundos).padStart(2, '0');
    }
}

// ==========================================
// 5. CLASE PARTIDA
// ==========================================
class Partida {
    // segundosLimite: 120 = 2 minutos
    constructor(canvas, segundosLimite = 120) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.temporizador = new Temporizador(segundosLimite);
        this.tablero = null;

        this.rafActivo = null;
        this.textoTiempoMostrado = null;
        this.fichasMostradas = null;
        this.movimientosMostrados = null;

        // Imágenes: se cargan una sola vez
        this.imgFondo = new Image();
        this.imgFondo.src = 'img/Peg Tablero.jpg';
        this.imgFondo.onerror = () => console.warn("No se encontró la imagen de fondo. Se usa un fondo plano.");

        this.imgFicha = new Image();
        this.imgFicha.src = 'img/ficha.png';
        this.imgFicha.onerror = () => console.warn("No se encontró la imagen de ficha. Se usan círculos.");

        this.bucle = this.bucle.bind(this);

        this.registrarEventos();
    }

    // ---------- Ciclo de vida ----------

    // Crea el tablero, arranca el temporizador y el bucle de render
    iniciar() {
        // Geometría medida sobre img/Peg Tablero.jpg:
        // paso de los huecos = 52.6 px y centro del primero en (211.9, 82.2)
        this.tablero = new TableroJuego(this.ctx, 185.6, 55.9, 52.6, this.imgFondo, this.imgFicha);
        this.tablero.alFinalizar = (motivo) => this.manejarFinPartida(motivo);
        this.canvas.style.touchAction = 'none';

        this.temporizador.reiniciar();
        this.temporizador.iniciar();
        this.ocultarPanelFin();
        this.pintarTiempo(true);
        this.pintarEstado(true);

        // Evita tener dos cadenas de frames corriendo a la vez
        if (this.rafActivo === null) {
            this.rafActivo = requestAnimationFrame(this.bucle);
        }
    }

    // Reinicia la partida desde el panel de fin
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
        this.pintarEstado(true);
    }

    // ---------- Bucle de render ----------

    // Limpia el canvas, actualiza el temporizador, pinta los displays y dibuja el tablero
    bucle(tiempo) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.tablero) {
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

    // ---------- Interfaz ----------

    // Muestra el tiempo restante (solo toca el DOM si cambió el texto)
    pintarTiempo(forzar = false) {
        const texto = 'Tiempo: ' + this.temporizador.obtenerTexto();
        if (!forzar && texto === this.textoTiempoMostrado) return;
        this.textoTiempoMostrado = texto;

        showTimer(true, texto);
        const el = document.getElementById('timer-display');
        if (el) el.classList.toggle('timer-display--urgente', this.temporizador.enRiesgo());
    }

    // Muestra fichas restantes y movimientos
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

        const panel = document.getElementById('estado-display');
        if (panel) panel.classList.add('visible');
    }

    // Detiene el temporizador y muestra el panel de fin con el resultado
    manejarFinPartida(motivo) {
        this.temporizador.detener();
        this.pintarTiempo(true);
        this.pintarEstado(true);

        // victoria-perfecta: una ficha en el centro | victoria: una ficha en otra casilla
        // sin-movimientos: quedan fichas pero no hay saltos | tiempo: se agotó el tiempo
        const mensajes = {
            'victoria-perfecta': '¡Victoria Perfecta! ✨',
            'victoria': '¡Victoria! 🏆 ¡Ganaste!',
            'sin-movimientos': '¡Juego terminado! No quedan movimientos posibles.',
            'tiempo': '¡Tiempo agotado!'
        };
        this.mostrarPanelFin(mensajes[motivo] || mensajes['sin-movimientos'], motivo);
    }

    // Muestra el panel de fin con el mensaje y el resumen de la partida
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
            panel.classList.toggle('fin-partida--victoria', motivo.startsWith('victoria'));
            panel.classList.toggle('fin-partida--perfecta', motivo === 'victoria-perfecta');
            panel.classList.add('visible');
        }
    }

    // Oculta el panel de fin
    ocultarPanelFin() {
        const panel = document.getElementById('finPartida');
        if (panel) {
            panel.classList.remove('visible');
            panel.classList.remove('fin-partida--victoria');
            panel.classList.remove('fin-partida--perfecta');
        }
    }

    // ---------- Eventos del mouse ----------

    // mouseDown, mouseMove y mouseUp sobre el canvas.
    // El mouseup también se escucha en window por si se suelta fuera del canvas
    registrarEventos() {
        this.canvas.addEventListener('mousedown', (e) => this.manejarMouseAbajo(e));
        this.canvas.addEventListener('mousemove', (e) => this.manejarMouseMover(e));
        this.canvas.addEventListener('mouseup', (e) => this.manejarMouseSoltar(e));

        window.addEventListener('mouseup', (e) => {
            if (!this.tablero || !this.tablero.fichaSeleccionada) return;
            this.manejarMouseSoltar(e);
        });

        // Si el cursor sale del canvas o la ventana pierde el foco, la ficha vuelve a su lugar
        const cancelarSeguro = () => { if (this.tablero) this.tablero.cancelarArrastre(); };
        this.canvas.addEventListener('mouseleave', cancelarSeguro);
        window.addEventListener('blur', cancelarSeguro);
    }

    // Pasa las coordenadas del mouse a píxeles internos del canvas.
    // Se usa getBoundingClientRect porque el canvas se estira con CSS
    obtenerPosicionCanvas(e) {
        const rect = this.canvas.getBoundingClientRect();
        const escalaX = this.canvas.width / (rect.width || this.canvas.width);
        const escalaY = this.canvas.height / (rect.height || this.canvas.height);
        return {
            x: (e.clientX - rect.left) * escalaX,
            y: (e.clientY - rect.top) * escalaY
        };
    }

    // mousedown: avisa al tablero qué ficha se agarró
    manejarMouseAbajo(e) {
        if (!this.tablero) return;
        this.canvas.focus();
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseDown(pos.x, pos.y);
    }

    // mousemove: pasa la posición del mouse al tablero
    manejarMouseMover(e) {
        if (!this.tablero) return;
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseMove(pos.x, pos.y);
    }

    // mouseup: resuelve el movimiento y actualiza el panel de estado
    manejarMouseSoltar(e) {
        if (!this.tablero) return;
        const pos = this.obtenerPosicionCanvas(e);
        this.tablero.onMouseUp(pos.x, pos.y);
        this.pintarEstado();
    }
}

// ==========================================
// 6. PUNTO DE ENTRADA
// ==========================================
const partida = new Partida(document.getElementById('canvas'), 120);
