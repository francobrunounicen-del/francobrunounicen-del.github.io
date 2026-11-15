document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const btnComenzar = document.getElementById('comenzarBtn');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playBtn.classList.add('is-playing');
            canvas.style.display = 'block';
        });
    }

});

//codigo de imagenes!!!!!!!
//-------------------------------------------------------------------------------------------------------------


//El DOM solo muestra
function dibujar() {
    const ang = limitar(pajero.vy / ..., -0.7, 0.7);
    pajero.el.style.transform =
        `translate(${pajero.x}px, ${pajero.y}px)
        rotate(${ang}rad)`;
}

//El evento anota, el loop decide
const entrada = { impulso: false };

document.addEventListener("keydown", e => {
    if (e.code === "Space" && !e.repeat) {
        entrada.impulso = true;
    }
});

function actualizar(dt) {
    if (entrada.impulso) {
        pajaro.impulsar();
        entrada.impulso = false;
    }
}

//Menu, juego, fin
function frame(ahora) {
    // ... dt
    switch (juego.estado) {
        case 'menu':
            if (entrada.impulso) empezar();
            break;
        case 'jugando':
            actualizar(dt);
            if (juego.vidas === 0) juego.estado = 'fin';
            break;
        case 'fin':
            if (entrada.impulso) reiniciar();
            break;
    }
    entrada.impulso = false;
    dibujar();
    requestAnimationFrame(frame);
}

//generar tubos
function crearTubo() {
    const hueco = Math.max(HUECO_MIN, HUECO_INICIAL - tiempo * 5)
        + azar(-20, 20); // se achica y varía
    const centro = azar(TECHO + hueco / 2, PISO - hueco / 2);
    const el = crearDivs(centro, hueco);
    tubos.push({ x: ANCHO, centro, hueco, el });
    distancia = azar(200, 500); // hasta el próximo
}

function actualizar(dt) {
    distancia -= vel * dt;
    if (distancia < 0) crearTubo();
    for (const t of tubos) t.x -= vel * dt;
}

//Se chocan dos cajas??
function choca(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
        a.y < b.y + b.h && a.y + a.h > b.y;
}

const caja = pajaro.hitbox(); // más chica que el dibujo
for (const t of tubos) {
    if (choca(caja, t.arriba()) || choca(caja, t.abajo())) {
        pajaro.chocar();
    }
}

//El fondo sigue al jugador
const FACTORES = [0.1, 0.25, 0.5, 1]; // o similar + suelo + tubos

function actualizar(dt) {
    capas.forEach((c, i) => {
        c.x = (c.x + vel * FACTORES[i] * dt) % ANCHO_TILE;
    });
}

function dibujar() {
    for (const c of capas) {
        c.el.style.backgroundPositionX = -c.x + 'px';
    }
}

//Bonus y obstaculos
const EFECTOS = {
    moneda: juego => juego.puntos += 1,
    murcielago: juego => juego.turbo += 1
};

for (const item of items) {
    if (!item.tomado && choca(pajaro.hitbox(), item.caja())) {
        item.tomado = true;
        EFECTOS[item.tipo](juego);
        item.el.classList.add('tomado');
    }
}

//Cada estado, una clase
chocar() {
    if (this.invulnerable > 0) return;
    this.vidas--;
    this.invulnerable = 1.5;
    this.ponerEstado('choca');
}

ponerEstado(nombre) {
    this.el.classList.remove('vuela', 'impulso', 'choca');
    void this.el.offsetWidth; // truco para reiniciar animación CSS
    this.el.classList.add(nombre);
}

// si la animación de una vez avisa cuando termina...
this.el.addEventListener('animationend',
    () => this.ponerEstado('vuela'));


//lo que sale se borra, sino los tubos se quedan en el dom y el juego se relentizan
while (tubos.length && tubos[0].x < -ANCHO_TUBO) {
    let t = tubos.shift();
    t.el.remove();
}

//Gravedad e impulso
const GRAVEDAD = 1400; // px/s²
const IMPULSO = 500;  // px/s

function actualizar(dt) {
    if (entrada.impulso) {
        pajaro.vy = -IMPULSO; // hacia arriba
        entrada.impulso = false;
    }
    pajaro.vy += GRAVEDAD * dt; // acelera
    pajaro.y += pajaro.vy * dt;
}