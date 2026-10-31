document.addEventListener('DOMContentLoaded', () => {
    /* --- INTERACCIÓN BOTÓN DE PLAY EN REPRODUCTOR --- */
    const playBtn = document.getElementById('playBtn');
    const gameCover = document.querySelector('.game-cover');
    // Al presionar el botón central PLAY de la portada
    playBtn.addEventListener('click', () => {
        // Transición visual al iniciar el juego
        playBtn.classList.add('is-playing');
        gameCover.src = 'img/Peg Tablero.jpg';
        canvas.style.display='block'
        dibujarJuego();
    });
});

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ==========================================
// CLASE PADRE: Figura
// ==========================================
class Figura {
    constructor(x, y, color) {
        this.x = x;         // Posición horizontal
        this.y = y;         // Posición vertical
        this.color = color; // Color de relleno
    }

    dibujar(contexto) {
        console.warn("El método dibujar() debe ser implementado por la clase hija.");
    }
}

class Circulo extends Figura {
    constructor(x, y, color, radio) {
        super(x, y, color);
        this.radio = radio;
        this.radioFicha = radio;
        this.ctx = ctx;
    }

    // Método dibujar
    dibujar(contexto) {
        contexto.beginPath();
        contexto.arc(this.x, this.y, this.radio, 0, Math.PI * 2); // Corregido el operador '*'
        contexto.fillStyle = this.color;
        contexto.fill();
        contexto.closePath();
    }

    // Método para dibujar la ficha (extraído de las diapositivas)
    dibujarficha(tipo, x, y, levantada = false) {
        const ctx = this.ctx;
        const r = this.radioFicha;
        ctx.save();
        if (levantada) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 10;
        }
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI); // Corregido el operador '*'
        if (this.imagenes) {
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.clip();
            ctx.drawImage(this.imagenes[tipo], x - r, y - r, r * 2, r * 2); // Corregido '*'
        } else {
            ctx.fillStyle = tipo === 'roja' ? '#e53935' : '#1e88e5';
            ctx.fill();
        }
        ctx.restore();
    }

    // Método para dibujar las pistas o hints
    dibujarHints(destinos, tiempo) {
        const ctx = this.ctx;
        const pulso = (Math.sin(tiempo * 6) + 1) / 2;
        for (const d of destinos) {
            const { x, y } = this.aPixeles(d.fila, d.col);

            ctx.strokeStyle = `rgba(255, 210, 63, ${1 - pulso * 0.6})`; // Corregidos los operadores
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(x, y, this.radioFicha * (0.7 + pulso * 0.4), 0, 2 * Math.PI); // Corregido '*'
            ctx.stroke();

            const ya = y - this.radioFicha - 10 - pulso * 5; // Corregidos operadores de resta
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.moveTo(x - 8, ya - 12); // Corregido operadores
            ctx.lineTo(x + 8, ya - 12); // Corregido operadores
            ctx.lineTo(x, ya);
            ctx.fill();
        }
    }

    // Manejador de eventos de mouse
    onMouseDown(e) {
        if (this.mensaje && typeof onDismiss === 'function') onDismiss();

        // Nota: Asegúrate de que una clase padre tenga onMouseDown,
        // de lo contrario super.onMouseDown(e) arrojará un error.
        // super.onMouseDown(e);

        if (this.arrastre) {
            const ficha = this.arrastre.ficha;
            this.arrastre.destinos = this.tablero.obtenerMovimientosPosibles(ficha);
        }
    }

    // Bucle principal de animación / juego
    loop(ahora) {
        const transcurrido = (ahora - this.inicio) / 1000;
        const restante = Math.max(0, this.tiempoLimite - transcurrido);
        if (this.mensaje && restante === 0) {
            this.mensaje = '';
            this.arrastre = null;
        }
        this.vista.dibujar({
            arrastre: this.arrastre,
            tiempo: ahora / 1000,
            restante: this.mensaje ? 0 : restante,
            mensaje: this.mensaje
        });

        // Corregido: dentro de una clase, se debe llamar a la instancia con 'this.loop'
        this.raf = requestAnimationFrame((t) => this.loop(t));
    }
}


function dibujarJuego(){
    const xTablero=210;
    const yTablero=60;
    for(let x=0;x<7; x++){
        for(let y=0;y<7; y++) {
            if(x>1 && x<5 || y>1 && y<5){
            let circulo1 = new Circulo(x*55+xTablero, y*52+yTablero, '#2ecc71', 10);
            circulo1.dibujar(ctx);}
        }
    }
}