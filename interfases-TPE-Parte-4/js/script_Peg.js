document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const canvas = document.getElementById('canvas');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playBtn.classList.add('is-playing');
            // El fondo del tablero se dibuja UNA sola vez dentro del canvas,
            // por eso ya no se reemplaza la imagen de portada (era la copia duplicada)
            canvas.style.display = 'block';
            iniciarJuego();
        });
    }
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
            contexto.shadowColor = 'rgba(0, 0, 0, 0.6)';
            contexto.shadowBlur = 15;
            contexto.shadowOffsetY = 8;
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

        this.grid = [
            [-1, -1,  1,  1,  1, -1, -1],
            [-1, -1,  1,  1,  1, -1, -1],
            [ 1,  1,  1,  1,  1,  1,  1],
            [ 1,  1,  1,  0,  1,  1,  1], // Centro vacío
            [ 1,  1,  1,  1,  1,  1,  1],
            [-1, -1,  1,  1,  1, -1, -1],
            [-1, -1,  1,  1,  1, -1, -1]
        ];

        this.fichas = [];
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];
        this.animOffset = 0;

        this.inicializarFichas();
    }

    inicializarFichas() {
        this.fichas = [];
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (this.grid[r][c] === 1) {
                    let posX = this.margenX + c * this.tamCasilla + this.tamCasilla / 2;
                    let posY = this.margenY + r * this.tamCasilla + this.tamCasilla / 2;
                    this.fichas.push(new Ficha(posX, posY, this.tamCasilla * 0.4, this.imgFicha, r, c));
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
        // Zona de agarre más generosa que el dibujo de la ficha:
        // subí/bajá este porcentaje si querés que se agarre más fácil o más difícil
        const margenAgarre = this.tamCasilla * 0.08;
        for (let i = this.fichas.length - 1; i >= 0; i--) {
            let f = this.fichas[i];
            if (f.containsPoint(x, y, margenAgarre)) {
                this.fichaSeleccionada = f;
                f.isDragging = true;
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

                this.fichaSeleccionada.fila = destinoMatriz.fila;
                this.fichaSeleccionada.col = destinoMatriz.col;
                let nuevaPos = this.getCoordsPixeles(destinoMatriz.fila, destinoMatriz.col);
                this.fichaSeleccionada.setPosition(nuevaPos.x, nuevaPos.y);

                movimientoExitoso = true;
            }
        }

        if (!movimientoExitoso) {
            let posOrig = this.getCoordsPixeles(this.fichaSeleccionada.fila, this.fichaSeleccionada.col);
            this.fichaSeleccionada.setPosition(posOrig.x, posOrig.y);
        }

        this.fichaSeleccionada.isDragging = false;
        this.fichaSeleccionada = null;
        this.movimientosValidos = [];

        if (movimientoExitoso && this.verificarFinJuego()) {
            setTimeout(() => alert("¡Juego terminado! No hay más movimientos posibles."), 100);
        }
    }

    // Cancela el arrastre sin soltar: la ficha vuelve a su casilla
    cancelarArrastre() {
        if (!this.fichaSeleccionada) return;
        const posOrig = this.getCoordsPixeles(this.fichaSeleccionada.fila, this.fichaSeleccionada.col);
        this.fichaSeleccionada.setPosition(posOrig.x, posOrig.y);
        this.fichaSeleccionada.isDragging = false;
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
// 4. INICIALIZACIÓN Y BUCLE PRINCIPAL
// ==========================================
let juego = null;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function iniciarJuego() {
    const imgFondo = new Image();
    imgFondo.src = 'img/Peg Tablero.jpg';

    const imgFicha = new Image();
    imgFicha.src = 'img/ficha.png';

    // Usamos 'img.onerror' para que no rompa la ejecución si no encuentra los archivos
    imgFondo.onerror = () => console.warn("Aviso: No se encontró la imagen de fondo. Se usará un fondo plano.");
    imgFicha.onerror = () => console.warn("Aviso: No se encontró la imagen de ficha. Se usarán círculos.");

    // Instanciamos el tablero directamente sin esperar promesas bloqueantes
    juego = new TableroJuego(ctx, 195, 64, 50, imgFondo, imgFicha);
    canvas.style.touchAction = 'none'; // permite arrastrar con el dedo sin scrollear la página
    requestAnimationFrame(gameLoop);
}

function gameLoop(tiempo) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (juego) {
        juego.dibujar(tiempo / 1000);
    }
    requestAnimationFrame(gameLoop);
}

// Convierte las coordenadas del mouse a pixels internos del canvas.
// El lienzo se estira con CSS (755x472 -> tamaño del reproductor), así que sin
// esta escala el clic se detectaba corrido: se agarraba solo el centro/arriba de la ficha.
function obtenerPosicionCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / (rect.width || canvas.width);
    const escalaY = canvas.height / (rect.height || canvas.height);
    return {
        x: (e.clientX - rect.left) * escalaX,
        y: (e.clientY - rect.top) * escalaY
    };
}

canvas.addEventListener("pointerdown", (e) => {
    if (!juego) return;
    const pos = obtenerPosicionCanvas(e);
    juego.onMouseDown(pos.x, pos.y);
});

canvas.addEventListener("pointermove", (e) => {
    if (!juego) return;
    const pos = obtenerPosicionCanvas(e);
    juego.onMouseMove(pos.x, pos.y);
});

canvas.addEventListener("pointerup", (e) => {
    if (!juego) return;
    const pos = obtenerPosicionCanvas(e);
    juego.onMouseUp(pos.x, pos.y);
});

// Si el arrastre se interrumpe (se suelta fuera del canvas, cambia de ventana, etc.),
// la ficha vuelve a su casilla en vez de quedar "pegada" al puntero
canvas.addEventListener("pointercancel", () => {
    if (juego) juego.cancelarArrastre();
});