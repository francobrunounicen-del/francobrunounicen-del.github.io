document.addEventListener('DOMContentLoaded', () => {

    // -------------------------------------------------------------------------
    // 1. CONSTANTES Y CONFIGURACIÓN GLOBAL
    // -------------------------------------------------------------------------
    const container = document.getElementById('game-container');
    const gameScreen = document.getElementById('gameScreen');

    // El tamaño se mide al cargar y se vuelve a medir si cambia el tamaño de la
    // ventana o se entra/sale de pantalla completa. Por eso son 'let' y no 'const'.
    let ANCHO_JUEGO = 800;
    let ALTO_JUEGO = 500;

    function medirCampo() {
        ANCHO_JUEGO = (container && container.clientWidth) ? container.clientWidth : 800;
        ALTO_JUEGO = (container && container.clientHeight) ? container.clientHeight : 500;
    }
    medirCampo();

    window.addEventListener('resize', medirCampo);
    document.addEventListener('fullscreenchange', medirCampo);

    const GRAVEDAD = 600;       // px/s² (reducida para que sea jugable)
    const IMPULSO = 250;        // px/s (moderado)
    const HUECO_MIN = 125;      // Hueco mínimo entre tubos
    const MARGEN_Y = 18;        // Margen vertical para los límites de pantalla
    const HUECO_INICIAL = 190;  // Hueco inicial más amplio
    const ANCHO_TUBO = 18;
    const PUNTOS_OBJETIVO = 100; // Meta de puntaje para ganar (Requisito 6)

    // Estado general del juego
    const juego = {
        estado: 'menu', // 'menu', 'jugando', 'fin'
        vidas: 10,
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
    const vel = juego.velBase; // Velocidad constante (Requisito 1)
    let factorFreno = 1;       // 1 = ritmo normal; baja al chocar un asteroide
    let distanciaTubo = 0;
    let timerEscudo = 2.5;
    let timerAsteroide = 4.5;

    // -------------------------------------------------------------------------
    // 2. OBJETO NAVE / JUGADOR
    // -------------------------------------------------------------------------
    const nave = {
        x: 100,
        y: ALTO_JUEGO / 2,
        vy: 0,
        h: 42, // Coincide con el alto del frame de nave.png
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
            // Feedback visual: la misma aura que usa el escudo, para que se entienda
            // que la nave sigue protegida mientras dura la invulnerabilidad.
            if (this.el) this.el.classList.add('invulnerable');
        },

        ponerEstado(nombre) {
            if (!this.el) return;
            this.el.classList.remove('vuela', 'impulso', 'choca', 'cae');
            void this.el.offsetWidth; // Reinicia animación CSS
            this.el.classList.add(nombre);
        },

        hitbox() {
            // Hitbox ajustada al dibujo real de la nave dentro del frame de 74x42.
            // El sprite tiene margenes transparentes: la nave se ve aprox. en x=14..56, y=11..34.
            return {
                x: this.x + 13,
                y: this.y + 11,
                w: 44,
                h: 24
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

    // ADAPTACION (Requisito 3): la velocidad de cada capa depende de la velocidad del juego.
    // Duracion = distancia / (velocidad del juego * factor de profundidad).
    function ajustarVelocidadParallax() {
        const capas = document.querySelectorAll('.parallax-layer');
        const FACTORES = [0.1, 0.25, 0.5, 1]; // l1 lejos ... l4 cerca
        const ANCHOS_TILE = [512, 160, 512, 512];
        capas.forEach((capa, i) => {
            // l2 (agujero negro) cruza 2 anchos de pantalla; las demas, 1 tile.
            const distancia = i === 1 ? ANCHO_JUEGO * 2 : ANCHOS_TILE[i];
            const duracion = distancia / (vel * FACTORES[i]);
            capa.style.animationDuration = duracion + 's';
        });
    }

    // Si cambia el tamaño del cuadro, l2 debe recalcular su distancia.
    window.addEventListener('resize', () => ajustarVelocidadParallax());
    document.addEventListener('fullscreenchange', () => ajustarVelocidadParallax());

    // -------------------------------------------------------------------------
    // 4. CAPTURA DE ENTRADAS (Teclado y Clic)
    // -------------------------------------------------------------------------
    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Space') return;

        // Si el usuario está escribiendo en un campo, el espacio debe escribir
        // un espacio normal y no impulsar la nave.
        const activo = document.activeElement;
        const escribiendo = activo && (
            activo.tagName === 'INPUT' ||
            activo.tagName === 'TEXTAREA' ||
            activo.tagName === 'SELECT' ||
            activo.isContentEditable
        );
        if (escribiendo) return;

        // Fuera de la partida tampoco interceptamos el espacio (así, por
        // ejemplo, funciona el botón de Play cuando tiene el foco).
        if (juego.estado !== 'jugando') return;

        e.preventDefault(); // evita que la página se desplace
        if (!e.repeat) entrada.impulso = true;
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
        juego.vidas = 10;
        juego.puntos = 0;
        tiempo = 0;
        factorFreno = 1;
        distanciaTubo = 150;
        timerEscudo = 2.0;
        timerAsteroide = 3.5;

        nave.y = ALTO_JUEGO / 2 - 32;
        nave.vy = 0;
        nave.invulnerable = 0;
        // Limpiar el aura por si la partida anterior terminó durante la invulnerabilidad.
        if (nave.el) nave.el.classList.remove('invulnerable');
        nave.ponerEstado('vuela');
        // Mostrar nave al iniciar el juego
        if (nave.el) nave.el.style.display = 'block';

        // Ocultar portada y botón de play, mostrar HUD
        if (cover) cover.style.display = 'none';
        if (playBtn) playBtn.style.display = 'none';
        if (hud) hud.style.display = 'block';

        if (gameOverScreen) gameOverScreen.classList.add('hidden');
        ajustarVelocidadParallax();
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

        // Tamaños reales de cada sprite (deben coincidir con el CSS)
        const esAsteroide = tipo === 'asteroide';
        const ancho = esAsteroide ? 64 : 40;
        const alto  = esAsteroide ? 64 : 51;

        // El asteroide tiene mucho margen transparente en su frame:
        // la roca visible ocupa aprox. x=19..44, y=21..43 dentro del frame de 64x64.
        const hitX = esAsteroide ? 18 : 0;
        const hitY = esAsteroide ? 20 : 0;
        const hitW = esAsteroide ? 28 : ancho;
        const hitH = esAsteroide ? 24 : alto;

        items.push({
            tipo,
            x: ANCHO_JUEGO,
            y: posY,
            hitX,
            hitY,
            hitW,
            hitH,
            tomado: false,
            el,
            caja() {
                return {
                    x: this.x + this.hitX,
                    y: this.y + this.hitY,
                    w: this.hitW,
                    h: this.hitH
                };
            }
        });
    }

    // -------------------------------------------------------------------------
    // 7. ACTUALIZACIÓN DE FÍSICA Y COLISIONES
    // -------------------------------------------------------------------------
    function actualizar(dt) {
        tiempo += dt;

        // El freno del asteroide se recupera solo en menos de un segundo.
        if (factorFreno < 1) {
            factorFreno = Math.min(1, factorFreno + dt * 0.5);
        }

        if (nave.invulnerable > 0) {
            nave.invulnerable = Math.max(0, nave.invulnerable - dt);
            if (nave.invulnerable === 0 && nave.el) {
                nave.el.classList.remove('invulnerable');
            }
        }

        if (entrada.impulso) {
            nave.impulsar();
        }

        nave.vy += GRAVEDAD * dt;
        nave.y += nave.vy * dt;
        nave.actualizarEstadoVuelo();

        if (nave.y < -MARGEN_Y) {
            nave.y = -MARGEN_Y;
            nave.vy = 0;
        }
        if (nave.y > ALTO_JUEGO - nave.h + MARGEN_Y) {
            nave.y = ALTO_JUEGO - nave.h + MARGEN_Y;
            nave.vy = -250;
            nave.chocar();
        }

        distanciaTubo -= vel * factorFreno * dt;
        if (distanciaTubo <= 0) crearTubo();

        const cajaNave = nave.hitbox();

        for (const t of tubos) {
            t.x -= vel * factorFreno * dt;
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

        timerEscudo -= dt;
        if (timerEscudo <= 0) {
            crearItem('escudo');
            timerEscudo = azar(5.5, 10.5);
        }

        timerAsteroide -= dt;
        if (timerAsteroide <= 0) {
            crearItem('asteroide');
            timerAsteroide = azar(3.5, 6.0);
        }

        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            it.x -= (vel * factorFreno * 1.15) * dt;
            it.el.style.left = it.x + 'px';

            if (!it.tomado && choca(cajaNave, it.caja())) {
                it.tomado = true;
                it.el.classList.add('tomado');

                if (it.tipo === 'escudo') {
                    juego.puntos += 5;
                    nave.invulnerable = 4; // 4 segundos de invulnerabilidad
                    if (nave.el) nave.el.classList.add('invulnerable');
                } else if (it.tipo === 'asteroide') {
                    // Elemento 2: resta puntos y frena la nave (NO termina el juego)
                    juego.puntos = Math.max(0, juego.puntos - 3);
                    nave.vy = Math.max(nave.vy, 0); // corta el impulso hacia arriba
                    factorFreno = 0.7;              // y frena el avance ~0,6s

                    // Feedback: el marcador se pone rojo un instante para que se
                    // note la bajada de puntos. Se reinicia la animación por si
                    // el jugador toca otro asteroide poco después.
                    if (scoreSpan) {
                        scoreSpan.classList.remove('baja');
                        void scoreSpan.offsetWidth;
                        scoreSpan.classList.add('baja');
                    }
                }

                // Cada animación dura distinto: escudo 0.4s, asteroide 0.5s.
                const duracionAnim = it.tipo === 'asteroide' ? 500 : 400;
                setTimeout(() => { if (it.el) it.el.remove(); }, duracionAnim);
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