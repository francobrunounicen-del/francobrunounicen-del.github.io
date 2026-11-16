document.addEventListener('DOMContentLoaded', () => {

    // -------------------------------------------------------------------------
    // 1. CONSTANTES Y CONFIGURACIÓN GLOBAL
    // -------------------------------------------------------------------------
    // ADAPTACION: el contenedor de juego usa aspect-ratio 16/10 (igual que BlockA y Peg).
    // Se leen las dimensiones reales del contenedor para no hardcodear 800x600.
    const _gc = document.getElementById('game-container');
    const ANCHO_JUEGO = (_gc && _gc.clientWidth) ? _gc.clientWidth : 800;
    const ALTO_JUEGO = (_gc && _gc.clientHeight) ? _gc.clientHeight : 500;
    const GRAVEDAD = 1400; // px/s²
    const IMPULSO = 500;   // px/s
    const HUECO_MIN = 120;
    const HUECO_INICIAL = 180;
    const ANCHO_TUBO = 60;
    const FACTORES = [0.1, 0.25, 0.5, 1]; // Factores para las 4 capas de Parallax

    // Estado general del juego
    const juego = {
        estado: 'menu', // 'menu', 'jugando', 'fin'
        vidas: 3,
        puntos: 0,
        turbo: 0
    };

    // Registro de entradas del usuario
    const entrada = { impulso: false };

    // Referencias del DOM
    const playBtn = document.getElementById('playBtn');
    const comenzarBtn = document.getElementById('comenzarBtn');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreSpan = document.getElementById('final-score');
    const scoreSpan = document.getElementById('score');

    // Variables de control de escena
    let tubos = [];
    let capas = [];
    let items = [];
    let tiempo = 0;
    let vel = 300; // velocidad de avance del escenario
    let distancia = 0;

    // -------------------------------------------------------------------------
    // 2. OBJETO PÁJARO / NAVE
    // -------------------------------------------------------------------------
    const pajaro = {
        x: 100,
        y: 300,
        vy: 0,
        w: 40,
        h: 30,
        invulnerable: 0,
        el: document.getElementById('ship'),

        impulsar() {
            this.vy = -IMPULSO; // Impulso hacia arriba
            this.ponerEstado('impulso');
        },

        chocar() {
            if (this.invulnerable > 0) return;
            juego.vidas--;
            this.invulnerable = 1.5;
            this.ponerEstado('choca');
        },

        ponerEstado(nombre) {
            if (!this.el) return;
            this.el.classList.remove('vuela', 'impulso', 'choca');
            void this.el.offsetWidth; // Truco para reiniciar animación CSS
            this.el.classList.add(nombre);
        },

        hitbox() {
            // Hitbox un poco más compacta que el sprite visual para evitar falsos positivos
            return { x: this.x + 5, y: this.y + 5, w: this.w - 10, h: this.h - 10 };
        }
    };

    // Escuchar fin de animación de golpe para volver al estado de vuelo
    if (pajaro.el) {
        pajaro.el.addEventListener('animationend', () => {
            pajaro.ponerEstado('vuela');
        });
    }

    // -------------------------------------------------------------------------
    // 3. CAPTURA DE ENTRADAS (Teclado y Botones)
    // -------------------------------------------------------------------------
    document.addEventListener("keydown", e => {
        if (e.code === "Space" && !e.repeat) {
            entrada.impulso = true;
        }
    });

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playBtn.classList.add('is-playing');
            empezar();
        });
    }

    if (comenzarBtn) {
        comenzarBtn.addEventListener('click', empezar);
    }

    function empezar() {
        juego.estado = 'jugando';
        juego.vidas = 5;
        juego.puntos = 0;
        tubos = [];
        pajaro.y = 300;
        pajaro.vy = 0;
        tiempo = 0;
        if (gameOverScreen) gameOverScreen.classList.add('hidden');
    }

    function reiniciar() {
        empezar();
    }

    // -------------------------------------------------------------------------
    // 4. FUNCIONES AUXILIARES (Matemáticas y Geometría)
    // -------------------------------------------------------------------------
    function azar(min, max) {
        return Math.random() * (max - min) + min;
    }

    function limitar(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function choca(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
            a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function crearDivs(centro, hueco) {
        const div = document.createElement('div');
        div.className = 'tubo-obstaculo';
        const container = document.getElementById('game-container');
        if (container) container.appendChild(div);
        return div;
    }

    // -------------------------------------------------------------------------
    // 5. GENERACIÓN Y ACTUALIZACIÓN DE OBSTÁCULOS / TUBOS
    // -------------------------------------------------------------------------
    function crearTubo() {
        const hueco = Math.max(HUECO_MIN, HUECO_INICIAL - tiempo * 5) + azar(-20, 20);
        const centro = azar(100, ALTO_JUEGO - hueco / 2);
        const el = crearDivs(centro, hueco);

        tubos.push({
            x: ANCHO_JUEGO, // Empieza al borde derecho del contenedor
            centro,
            hueco,
            el,
            arriba() {
                return { x: this.x, y: 0, w: ANCHO_TUBO, h: this.centro - this.hueco / 2 };
            },
            abajo() {
                return { x: this.x, y: this.centro + this.hueco / 2, w: ANCHO_TUBO, h: ALTO_JUEGO - (this.centro + this.hueco / 2) };
            }
        });
        distancia = azar(200, 500); // Distancia hasta el siguiente obstáculo
    }

    // -------------------------------------------------------------------------
    // 6. LÓGICA DE ACTUALIZACIÓN (Física, Movimiento y Colisiones)
    // -------------------------------------------------------------------------
    function actualizar(dt) {
        tiempo += dt;

        // Física de Impulso y Gravedad corregida
        if (entrada.impulso) {
            pajaro.impulsar();
            entrada.impulso = false;
        }

        pajaro.vy += GRAVEDAD * dt;    // Aceleración por gravedad
        pajaro.y += pajaro.vy * dt;    // Desplazamiento vertical

        // Limitar límites de pantalla superior e inferior
        if (pajaro.y < 0) { pajaro.y = 0; pajaro.vy = 0; }
        if (pajaro.y > ALTO_JUEGO - 40) { pajaro.chocar(); }

        // Movimiento de obstáculos
        distancia -= vel * dt;
        if (distancia < 0) crearTubo();

        for (const t of tubos) {
            t.x -= vel * dt;
            if (t.el) t.el.style.left = t.x + 'px';
        }

        // Limpieza de memoria (borrar tubos que salen de pantalla)
        while (tubos.length && tubos[0].x < -ANCHO_TUBO) {
            let t = tubos.shift();
            if (t.el) t.el.remove();
        }

        // Comprobación de colisiones con tubos
        const cajaPajaro = pajaro.hitbox();
        for (const t of tubos) {
            if (choca(cajaPajaro, t.arriba()) || choca(cajaPajaro, t.abajo())) {
                pajaro.chocar();
            }
        }

        // Gestión de ítems y bonificaciones opcionales
        const EFECTOS = {
            moneda: juego => juego.puntos += 1,
            murcielago: juego => juego.turbo += 1
        };

        for (const item of items) {
            if (!item.tomado && choca(pajaro.hitbox(), item.caja())) {
                item.tomado = true;
                if (EFECTOS[item.tipo]) EFECTOS[item.tipo](juego);
                if (item.el) item.el.classList.add('tomado');
            }
        }

        // Parallax Scrolling (movimiento de las 4 capas de fondo)
        capas.forEach((c, i) => {
            c.x = (c.x + vel * FACTORES[i] * dt) % ANCHO_JUEGO;
        });
    }

    // -------------------------------------------------------------------------
    // 7. RENDERIZADO VISUAL EN PANTALLA
    // -------------------------------------------------------------------------
    function dibujar() {
        // Rotación de la nave basada en su velocidad vertical
        const ang = limitar(pajaro.vy / 600, -0.7, 0.7);
        if (pajaro.el) {
            pajaro.el.style.transform = `translate(${pajaro.x}px, ${pajaro.y}px) rotate(${ang}rad)`;
        }

        // Dibujar desplazamiento de las capas de fondo
        for (const c of capas) {
            if (c.el) c.el.style.backgroundPositionX = -c.x + 'px';
        }

        // Actualizar HUD en tiempo real
        if (scoreSpan) scoreSpan.textContent = juego.puntos;
    }

    // -------------------------------------------------------------------------
    // 8. BUCLE PRINCIPAL DEL JUEGO (Game Loop con RequestAnimationFrame)
    // -------------------------------------------------------------------------
    let ultimoTiempo = 0;

    function frame(ahora) {
        if (!ultimoTiempo) ultimoTiempo = ahora;
        const dt = (ahora - ultimoTiempo) / 1000; // Cálculo de Delta Time (segundos)
        ultimoTiempo = ahora;

        // Máquina de estados principal
        switch (juego.estado) {
            case 'menu':
                if (entrada.impulso) empezar();
                break;
            case 'jugando':
                actualizar(dt);
                if (juego.vidas <= 0) {
                    juego.estado = 'fin';
                    if (gameOverScreen) gameOverScreen.classList.remove('hidden');
                    if (finalScoreSpan) finalScoreSpan.textContent = juego.puntos;
                }
                break;
            case 'fin':
                if (entrada.impulso) reiniciar();
                break;
        }

        entrada.impulso = false; // Consumir el input del frame actual
        dibujar();
        requestAnimationFrame(frame);
    }

    // Arrancar el ciclo de animación
    requestAnimationFrame(frame);
});