document.addEventListener('DOMContentLoaded', () => {

    // -------------------------------------------------------------------------
    // 1. CONSTANTES Y CONFIGURACIÓN GLOBAL
    // -------------------------------------------------------------------------
    const container = document.getElementById('game-container');
    const gameScreen = document.getElementById('gameScreen');

    const ANCHO_JUEGO = (container && container.clientWidth) ? container.clientWidth : 800;
    const ALTO_JUEGO = (container && container.clientHeight) ? container.clientHeight : 500;

    const GRAVEDAD = 600;       // px/s² (reducida para que sea jugable)
    const IMPULSO = 500;        // px/s (moderado)
    const HUECO_MIN = 125;      // Hueco mínimo entre tubos
    const HUECO_INICIAL = 190;  // Hueco inicial más amplio
    const ANCHO_TUBO = 60;
    const PUNTOS_OBJETIVO = 50; // Meta de puntaje para ganar (Requisito 6)

    // Estado general del juego
    const juego = {
        estado: 'menu', // 'menu', 'jugando', 'fin'
        vidas: 30,
        puntos: 0,
        velBase: 220
    };

    const entrada = { impulso: false };

    // Referencias del DOM
    const playBtn = document.getElementById('playBtn');
    const comenzarBtn = document.getElementById('comenzarBtn');
    const gameOverScreen = document.getElementById('game-over-screen');
    const gameOverTitle = gameOverScreen ? gameOverScreen.querySelector('h2') : null;
    const finalScoreSpan = document.getElementById('final-score');
    const scoreSpan = document.getElementById('score');
    const vidasSpan = document.getElementById('vidas');
    const hud = document.getElementById('hud');
    const cover = document.getElementById('coverImg');

    // Arrays de entidades activas
    let tubos = [];
    let items = [];
    let tiempo = 0;
    let vel = juego.velBase;
    let distanciaTubo = 0;
    let timerMoneda = 2.5;
    let timerEnemigo = 4.5;

    // -------------------------------------------------------------------------
    // 2. OBJETO NAVE / JUGADOR
    // -------------------------------------------------------------------------
    const nave = {
        x: 100,
        y: ALTO_JUEGO / 2,
        vy: 0,
        w: 64, // Coincide con el ancho del frame de nave.png
        h: 64, // Coincide con el alto del frame de nave.png
        invulnerable: 0,
        el: document.getElementById('ship'),

        impulsar() {
            this.vy = -IMPULSO;
            if (!this.el.classList.contains('choca')) {
                this.ponerEstado('impulso');
            }
        },

        actualizarEstadoVuelo() {
            if (this.el.classList.contains('choca')) return;
            if (this.vy > 140) {
                if (!this.el.classList.contains('cae')) this.ponerEstado('cae');
            } else if (this.vy >= -50) {
                if (!this.el.classList.contains('vuela')) this.ponerEstado('vuela');
            }
        },

        chocar() {
            if (this.invulnerable > 0) return;
            juego.vidas--;
            this.invulnerable = 1.5; // 1.5 segundos de inmunidad tras golpe
            this.ponerEstado('choca');
        },

        ponerEstado(nombre) {
            if (!this.el) return;
            this.el.classList.remove('vuela', 'impulso', 'choca', 'cae');
            void this.el.offsetWidth; // Reinicia animación CSS
            this.el.classList.add(nombre);
        },

        hitbox() {
            // Hitbox ajustada al cuerpo central de la nave
            return {
                x: this.x + 14,
                y: this.y + 18,
                w: this.w - 28,
                h: this.h - 36
            };
        }
    };

    // Volver al estado de vuelo normal al terminar animaciones puntuales (impulso o choque)
    if (nave.el) {
        nave.el.addEventListener('animationend', () => {
            if (juego.estado === 'jugando') {
                nave.ponerEstado('vuela');
            }
        });
    }

    // -------------------------------------------------------------------------
    // 3. CONTROL DEL PARALLAX CSS
    // -------------------------------------------------------------------------
    // Crear las 4 capas de parallax (antes vivían en un <script> inline del HTML)
    if (container) {
        for (let i = 1; i <= 4; i++) {
            const capa = document.createElement('div');
            capa.className = 'parallax-layer l' + i;
            container.appendChild(capa);
        }
    }

    function pausarParallax(pausar) {
        const capas = document.querySelectorAll('.parallax-layer');
        capas.forEach(capa => {
            capa.style.animationPlayState = pausar ? 'paused' : 'running';
        });
    }

    // -------------------------------------------------------------------------
    // 4. CAPTURA DE ENTRADAS (Teclado y Clic)
    // -------------------------------------------------------------------------
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!e.repeat) entrada.impulso = true;
        }
    });

    if (gameScreen) {
        gameScreen.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'BUTTON' && juego.estado === 'jugando') {
                entrada.impulso = true;
            }
        });
    }

    if (playBtn) playBtn.addEventListener('click', empezar);
    if (comenzarBtn) comenzarBtn.addEventListener('click', empezar);

    function limpiarEscena() {
        tubos.forEach(t => {
            if (t.elArriba) t.elArriba.remove();
            if (t.elAbajo) t.elAbajo.remove();
        });
        items.forEach(it => {
            if (it.el) it.el.remove();
        });
        tubos = [];
        items = [];
    }

    function empezar() {
        limpiarEscena();
        juego.estado = 'jugando';
        juego.vidas = 3;
        juego.puntos = 0;
        tiempo = 0;
        vel = juego.velBase;
        distanciaTubo = 150;
        timerMoneda = 2.0;
        timerEnemigo = 3.5;

        nave.y = ALTO_JUEGO / 2 - 32;
        nave.vy = 0;
        nave.invulnerable = 0;
        nave.ponerEstado('vuela');
        // Mostrar nave al iniciar el juego
        if (nave.el) nave.el.style.display = 'block';

        // Ocultar portada y botón de play, mostrar HUD
        if (cover) cover.style.display = 'none';
        if (playBtn) playBtn.style.display = 'none';
        if (hud) hud.style.display = 'block';

        if (gameOverScreen) gameOverScreen.classList.add('hidden');
        pausarParallax(false);
    }

    // -------------------------------------------------------------------------
    // 5. FUNCIONES AUXILIARES
    // -------------------------------------------------------------------------
    function azar(min, max) {
        return Math.random() * (max - min) + min;
    }

    function choca(a, b) {
        return a.x < b.x + b.w &&
               a.x + a.w > b.x &&
               a.y < b.y + b.h &&
               a.y + a.h > b.y;
    }

    // -------------------------------------------------------------------------
    // 6. GENERACIÓN DE OBSTÁCULOS (TUBOS) E ÍTEMS ANIMADOS
    // -------------------------------------------------------------------------
    function crearTubo() {
        const hueco = Math.max(HUECO_MIN, HUECO_INICIAL - tiempo * 3.5) + azar(-10, 10);
        const margen = 60;
        const centro = azar(margen + hueco / 2, ALTO_JUEGO - margen - hueco / 2);

        const altoArriba = centro - hueco / 2;
        const topAbajo = centro + hueco / 2;
        const altoAbajo = ALTO_JUEGO - topAbajo;

        const elArriba = document.createElement('div');
        elArriba.className = 'tubo-obstaculo tubo-arriba';
        elArriba.style.left = ANCHO_JUEGO + 'px';
        elArriba.style.top = '0px';
        elArriba.style.height = altoArriba + 'px';

        const elAbajo = document.createElement('div');
        elAbajo.className = 'tubo-obstaculo tubo-abajo';
        elAbajo.style.left = ANCHO_JUEGO + 'px';
        elAbajo.style.top = topAbajo + 'px';
        elAbajo.style.height = altoAbajo + 'px';

        if (container) {
            container.appendChild(elArriba);
            container.appendChild(elAbajo);
        }

        tubos.push({
            x: ANCHO_JUEGO,
            centro,
            hueco,
            superado: false,
            elArriba,
            elAbajo,
            arriba() {
                return { x: this.x, y: 0, w: ANCHO_TUBO, h: altoArriba };
            },
            abajo() {
                return { x: this.x, y: topAbajo, w: ANCHO_TUBO, h: altoAbajo };
            }
        });

        distanciaTubo = azar(240, 460);
    }

    function crearItem(tipo) {
        const el = document.createElement('div');
        el.className = 'item ' + tipo;
        const posY = azar(60, ALTO_JUEGO - 80);
        el.style.left = ANCHO_JUEGO + 'px';
        el.style.top = posY + 'px';

        if (container) container.appendChild(el);

        items.push({
            tipo,
            x: ANCHO_JUEGO,
            y: posY,
            w: 32,
            h: 32,
            tomado: false,
            el,
            caja() {
                return { x: this.x, y: this.y, w: this.w, h: this.h };
            }
        });
    }

    // -------------------------------------------------------------------------
    // 7. ACTUALIZACIÓN DE FÍSICA Y COLISIONES
    // -------------------------------------------------------------------------
    function actualizar(dt) {
        tiempo += dt;
        vel = juego.velBase; // Velocidad constante (Requisito 1)

        if (nave.invulnerable > 0) {
            nave.invulnerable -= dt;
        }

        if (entrada.impulso) {
            nave.impulsar();
            entrada.impulso = false;
        }

        nave.vy += GRAVEDAD * dt;
        nave.y += nave.vy * dt;
        nave.actualizarEstadoVuelo();

        const MARGEN_Y = 18; // el mismo que usa hitbox()

        if (nave.y < -MARGEN_Y) {
            nave.y = -MARGEN_Y;
            nave.vy = 0;
        }
        if (nave.y > ALTO_JUEGO - nave.h + MARGEN_Y) {
            nave.y = ALTO_JUEGO - nave.h + MARGEN_Y;
            nave.vy = -250;
            nave.chocar();
        }

        distanciaTubo -= vel * dt;
        if (distanciaTubo <= 0) crearTubo();

        const cajaNave = nave.hitbox();

        for (const t of tubos) {
            t.x -= vel * dt;
            t.elArriba.style.left = t.x + 'px';
            t.elAbajo.style.left = t.x + 'px';

            if (!t.superado && t.x + ANCHO_TUBO < nave.x) {
                t.superado = true;
                juego.puntos += 1;
            }

            if (choca(cajaNave, t.arriba()) || choca(cajaNave, t.abajo())) {
                nave.chocar();
            }
        }

        while (tubos.length && tubos[0].x < -ANCHO_TUBO) {
            const t = tubos.shift();
            t.elArriba.remove();
            t.elAbajo.remove();
        }

        timerMoneda -= dt;
        if (timerMoneda <= 0) {
            crearItem('moneda');
            timerMoneda = azar(2.5, 4.5);
        }

        timerEnemigo -= dt;
        if (timerEnemigo <= 0) {
            crearItem('murcielago');
            timerEnemigo = azar(3.5, 6.0);
        }

        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            it.x -= (vel * 1.15) * dt;
            it.el.style.left = it.x + 'px';

            if (!it.tomado && choca(cajaNave, it.caja())) {
                it.tomado = true;
                it.el.classList.add('tomado');

                if (it.tipo === 'moneda') {
                    juego.puntos += 5;
                } else if (it.tipo === 'murcielago') {
                    // Elemento 2: resta puntos y frena la nave (NO termina el juego)
                    juego.puntos = Math.max(0, juego.puntos - 3);
                    nave.vy = Math.max(nave.vy, 0);
                }

                setTimeout(() => { if (it.el) it.el.remove(); }, 400);
                items.splice(i, 1);
                continue;
            }

            if (it.x < -50) {
                it.el.remove();
                items.splice(i, 1);
            }
        }

        if (juego.vidas <= 0) {
            finalizarJuego('¡NAVE DESTRUIDA!');
        } else if (juego.puntos >= PUNTOS_OBJETIVO) {
            finalizarJuego('¡MISIÓN CUMPLIDA!');
        }
    }

    function finalizarJuego(mensaje) {
        juego.estado = 'fin';
        pausarParallax(true);
        if (hud) hud.style.display = 'none'; // se oculta al terminar la partida
        if (gameOverTitle) gameOverTitle.textContent = mensaje;
        if (finalScoreSpan) finalScoreSpan.textContent = juego.puntos;
        if (gameOverScreen) gameOverScreen.classList.remove('hidden');
    }

    // -------------------------------------------------------------------------
    // 8. RENDERIZADO EN EL DOM
    // -------------------------------------------------------------------------
    function dibujar() {
        if (nave.el) {
            nave.el.style.left = nave.x + 'px';
            nave.el.style.top = nave.y + 'px';
        }
        if (scoreSpan) scoreSpan.textContent = juego.puntos;
        if (vidasSpan) vidasSpan.textContent = Math.max(0, juego.vidas);
    }

    // -------------------------------------------------------------------------
    // 9. BUCLE PRINCIPAL (Game Loop)
    // -------------------------------------------------------------------------
    let ultimoTiempo = 0;
    pausarParallax(true);

    function frame(ahora) {
        if (!ultimoTiempo) ultimoTiempo = ahora;
        const dt = Math.min((ahora - ultimoTiempo) / 1000, 0.1);
        ultimoTiempo = ahora;

        if (juego.estado === 'jugando') {
            actualizar(dt);
        }

        entrada.impulso = false;
        dibujar();
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
});