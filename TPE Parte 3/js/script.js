
// 0. Menu desplegable de usuario
document.querySelectorAll('.btn-logout').forEach((btn) => {
  btn.addEventListener('click', () => {
    window.location.href = "login.html";
  });
});

// 1. Carruseles: desplazamiento proporcional al ancho visible + estado de flechas
function scrollCarousel(carouselId, direction) {
  const track = document.getElementById(carouselId);
  if (!track) return;
  const amount = Math.max(track.clientWidth * 0.8, 200);
  track.scrollBy({ left: direction * amount, behavior: 'smooth' });
}

function updateCarouselButtons(track) {
  if (!track) return;
  const wrapper = track.closest('.carousel-wrapper');
  if (!wrapper) return;
  const prev = wrapper.querySelector('.carousel-btn.prev');
  const next = wrapper.querySelector('.carousel-btn.next');
  const max = track.scrollWidth - track.clientWidth - 4;
  if (prev) prev.classList.toggle('is-hidden', track.scrollLeft <= 4);
  if (next) next.classList.toggle('is-hidden', track.scrollLeft >= max);
}

function initCarousels() {
  document.querySelectorAll('.carousel-track').forEach((track) => {
    updateCarouselButtons(track);
    track.addEventListener('scroll', () => updateCarouselButtons(track), { passive: true });
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.carousel-track').forEach(updateCarouselButtons);
  });
  initSkewOnScroll();
}

/* Skew fluido y sin vibraciones/parpadeos al scrollear */
function initSkewOnScroll() {
  document.querySelectorAll('.carousel-track').forEach((track) => {
    let lastX = track.scrollLeft;
    let raf = null;
    let resetTimer = null;

    track.addEventListener('scroll', () => {
      const currentX = track.scrollLeft;
      const vel = currentX - lastX;
      lastX = currentX;

      if (Math.abs(vel) < 1.5) return;

      const skew = Math.max(-10, Math.min(10, vel * 0.25));
      const stretch = 1 + Math.abs(skew) / 100;

      if (raf) cancelAnimationFrame(raf);

      raf = requestAnimationFrame(() => {
        const cards = track.querySelectorAll('.game-card');
        cards.forEach((c) => {
          c.style.transition = 'transform 0.05s ease-out';
          c.style.transform = 'skewX(' + (-skew) + 'deg) scaleX(' + stretch + ') translateZ(0)';
        });
      });

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        const cards = track.querySelectorAll('.game-card');
        cards.forEach((c) => {
          c.style.transition = 'transform 0.25s ease-out';
          c.style.transform = 'skewX(0deg) scaleX(1) translateZ(0)';
        });
      }, 80);
    }, { passive: true });
  });
}

// 2. Controladores de eventos e interacción al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {

  /* --- INTERACCIÓN BOTÓN DE PLAY EN REPRODUCTOR --- */
  const playBtn = document.getElementById('playBtn');
  const gameCover = document.querySelector('.game-cover');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      // Transición visual al iniciar el juego
      playBtn.classList.add('is-playing');
      // Opcional: Feedback visual en la portada
      if (gameCover) {
        gameCover.style.transition = 'filter 4s ease';
        //gameCover.style.filter = 'brightness(0.7)';
        gameCover.src = "img/blockA_fondo_menu.jpg";
      }
    });
  }

  /* --- VALIDACIÓN DE REGISTRO Y ANIMACIÓN EN 2 PASOS (SPINNER -> ÉXITO) --- */
  const formRegister = document.getElementById('formRegister');
  if (formRegister) {
    formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = document.getElementById('reg-pass');
      const pass2 = document.getElementById('reg-repeat-pass');
      const captcha = document.getElementById('captchaCheck');

      if (pass && pass2 && pass.value !== pass2.value) {
        pass2.setCustomValidity('Las contraseñas no coinciden');
        pass2.reportValidity();
        return;
      }
      if (pass2) pass2.setCustomValidity('');

      if (captcha && !captcha.checked) {
        captcha.reportValidity();
        return;
      }

      const btn = formRegister.querySelector('.btn-submit-register');
      const loadingContent = btn ? btn.querySelector('.btn-loading-content') : null;
      const successContent = btn ? btn.querySelector('.btn-success-content') : null;

      if (!btn) return;

      // PASO 1: Iniciar estado de Carga (Spinner)
      btn.classList.add('is-loading');
      if (loadingContent) loadingContent.setAttribute('aria-hidden', 'false');

      // PASO 2: Después de 600ms pasa a estado de Éxito (Cian + Check Trazado)
      setTimeout(() => {
        btn.classList.remove('is-loading');
        if (loadingContent) loadingContent.setAttribute('aria-hidden', 'true');

        btn.classList.add('is-success');
        if (successContent) successContent.setAttribute('aria-hidden', 'false');

        // Mantiene el estado de éxito durante 2 segundos y redirige
        setTimeout(() => {
          btn.classList.remove('is-success');
          if (successContent) successContent.setAttribute('aria-hidden', 'true');

          formRegister.reset();
          window.location.href = 'index.html';
        }, 2000);

      }, 600);
    });
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // Simula el ingreso y redirige a la home
      window.location.href = 'index.html';
    });
  }

  initCarousels();
  cargarJuegosDesdeAPI();

  /* --- PUBLICAR COMENTARIOS EN PAGINA DE JUEGO --- */
  const sendCommentBtn = document.getElementById('sendCommentBtn');
  const commentInput = document.getElementById('newComment');
  const commentsList = document.getElementById('commentsList');

  if (sendCommentBtn && commentInput && commentsList) {
    const postComment = () => {
      const text = commentInput.value.trim();
      if (text === '') return;

      const newCommentHTML = `
        <div class="comment-card">
          <div class="comment-avatar">👤</div>
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author">Usuario</span>
              <span class="comment-time">Hace un momento</span>
            </div>
            <p class="comment-text">${text}</p>
          </div>
        </div>
      `;

      commentsList.insertAdjacentHTML('afterbegin', newCommentHTML);
      commentInput.value = '';
    };

    sendCommentBtn.addEventListener('click', postComment);
    commentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') postComment();
    });
  }

});

// SOPORTE PARA PANTALLA COMPLETA EN EL JUEGO
const fullscreenBtn = document.getElementById('fullscreenBtn');
const gameScreen = document.getElementById('gameScreen');

if (fullscreenBtn && gameScreen) {
  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      gameScreen.requestFullscreen().catch(err => {
        console.error(`Error al intentar activar pantalla completa: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });
}

function toggleDropdown(id) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;
  if (window.event) window.event.stopPropagation();

  const otherId = id === 'categoriesDropdown' ? 'userDropdown' : 'categoriesDropdown';
  const other = document.getElementById(otherId);
  if (other) other.classList.add('hidden');

  dropdown.classList.toggle('hidden');
}

// Cerrar dropdowns al hacer clic fuera o con Escape
function closeDropdowns() {
  ['categoriesDropdown', 'userDropdown'].forEach((dropId) => {
    const d = document.getElementById(dropId);
    if (d) d.classList.add('hidden');
  });
}

document.addEventListener('click', (e) => {
  if (e.target.closest && (e.target.closest('.dropdown-card') || e.target.closest('#menu-btn') || e.target.closest('#profile-btn'))) return;
  closeDropdowns();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDropdowns();
  }
});

// LOADER DEL HOME: carga simulada de 5 segundos con animacion retro
(function () {
  const overlay = document.getElementById('retro-loader-overlay');
  const percentageDisplay = document.getElementById('loader-percentage');
  if (!overlay || !percentageDisplay) return;
  let progress = 0;
  const totalTimeMs = 1000;
  const updateIntervalMs = 50;
  const incrementPerStep = 100 / (totalTimeMs / updateIntervalMs);
  let timerId = setInterval(function () {
    progress += incrementPerStep;
    if (progress >= 100) {
      progress = 100;
      clearInterval(timerId);
      setTimeout(function () { overlay.classList.add('hidden'); }, 250);
    }
    percentageDisplay.textContent = Math.floor(progress) + '%';
  }, updateIntervalMs);
})();

/* PLUS TPE: carruseles desde la API v2 de la catedra (por tematica) */
const API_URL = 'https://vj.interfaces.jima.com.ar/api/v2';

async function cargarJuegosDesdeAPI() {
  const mapa = { c1: null, c2: null, c3: null, c4: null, c5: null, cApi: null };
  Object.keys(mapa).forEach((id) => { mapa[id] = document.getElementById(id); });
  if (!mapa.c1 && !mapa.cApi) return;
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const juegos = await response.json();
    const usados = new Set();
    const tomar = (lista, n) => {
      const res = [];
      for (const j of lista) {
        if (!usados.has(j.id)) { usados.add(j.id); res.push(j); }
        if (res.length >= n) break;
      }
      return res;
    };
    const porRating = [...juegos].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const porFecha = [...juegos].sort((a, b) => String(b.released || '').localeCompare(String(a.released || '')));
    const porGenero = (g) => juegos.filter((j) => (j.genres || []).some((x) => x.name === g));
    renderizarCarruselAPI(mapa.c1, tomar(porFecha, 10));
    renderizarCarruselAPI(mapa.c2, tomar(porRating, 10));
    renderizarCarruselAPI(mapa.c3, tomar(porGenero('Adventure'), 10));
    renderizarCarruselAPI(mapa.c4, tomar(porGenero('Action'), 10));
    renderizarCarruselAPI(mapa.c5, tomar(porGenero('RPG'), 10));
    renderizarCarruselAPI(mapa.cApi, tomar(porGenero('Indie'), 10));
  } catch (error) {
    console.error('Error al cargar juegos desde la API:', error);
  }
  Object.values(mapa).forEach(updateCarouselButtons);
}

function renderizarCarruselAPI(track, juegos) {
  if (!track || !juegos.length) return;
  track.innerHTML = '';
  juegos.forEach((juego) => {
    const nombre = (juego.name || 'SIN TITULO').toUpperCase();
    const img = juego.background_image_low_res || juego.background_image || '';
    const generos = (juego.genres || []).map((g) => g.name).join(', ');
    const card = document.createElement('div');
    card.className = 'game-card featured-badge';
    card.title = juego.name + ' - Rating: ' + juego.rating + ' (' + generos + ')';
    card.innerHTML = '<span class="badge">★ ' + juego.rating + '</span>' +
        '<img loading="lazy" src="' + img + '" alt="' + juego.name + '"> ' +
        '<span class="game-name">' + nombre + '</span>';
    track.appendChild(card);
  });
}

/*CANVAS!! */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Estado global del nivel
const estadoJuego = {
  nivelActual: 1,         // Nivel 1, 2 o 3
  piezas: [],             // Arreglo con la información de las 4, 6 u 8 partes
  bancoImagenes: [
    'img/galeria_BlockA/1.png', 'img/galeria_BlockA/2.png', 'img/galeria_BlockA/3.png',
    'img/galeria_BlockA/4.png', 'img/galeria_BlockA/5.png', 'img/galeria_BlockA/6.png'
  ],
  filtrosDisponibles: ['grises', 'brillo', 'negativo'],
  juegoTerminado: false,
  cantPartes: 4,          // 4, 6 u 8 partes
  offsetLeft: 50,
  offsetTop: 50,
  anchoTablero: 600,
  altoTablero: 500
};

function aplicarFiltro(imageData, tipoFiltro) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (tipoFiltro === 'grises') {
      // Luminancia BT.601 (Diapositiva 21)[cite: 21]
      const gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gris;
      data[i + 1] = gris;
      data[i + 2] = gris;
    }
    else if (tipoFiltro === 'brillo') {
      // Brillo +30% (Diapositiva 23)[cite: 23]
      data[i] *= 1.3;
      data[i + 1] *= 1.3;
      data[i + 2] *= 1.3;
    }
    else if (tipoFiltro === 'negativo') {
      // Negativo (Diapositiva 22)[cite: 22]
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  }
}

function iniciarNivel() {
  const rutaImagen = estadoJuego.bancoImagenes[Math.floor(Math.random() * estadoJuego.bancoImagenes.length)];
  const img = new Image();
  img.src = rutaImagen;

  img.onload = function () {
    setupPiezas(this);
  };
}

function setupPiezas(imagen) {
  estadoJuego.piezas = [];

  // Determinar filas y columnas según la cantidad de partes seleccionadas (4, 6 u 8)
  let cols = 2, filas = 2;
  if (estadoJuego.cantPartes === 6) { cols = 3; filas = 2; }
  if (estadoJuego.cantPartes === 8) { cols = 4; filas = 2; }

  const subWidth = imagen.width / cols;
  const subHeight = imagen.height / filas;
  const angulos = [0, 90, 180, 270];

  // Canvas auxiliar en memoria para recortar y procesar filtros[cite: 17, 19]
  const canvasAux = document.createElement('canvas');
  canvasAux.width = subWidth;
  canvasAux.height = subHeight;
  const ctxAux = canvasAux.getContext('2d');

  let id = 0;
  for (let r = 0; r < filas; r++) {
    for (let c = 0; c < cols; c++) {

      // Recortar subimagen
      ctxAux.clearRect(0, 0, subWidth, subHeight);
      ctxAux.drawImage(imagen, c * subWidth, r * subHeight, subWidth, subHeight, 0, 0, subWidth, subHeight);

      // Obtener ImageData original y con filtro (Tema 3)[cite: 1, 17]
      const imgDataOrig = ctxAux.getImageData(0, 0, subWidth, subHeight);
      const imgDataFilt = ctxAux.getImageData(0, 0, subWidth, subHeight);

      // Aplicar el filtro de la consigna sobre la copia[cite: 1, 22]
      aplicarFiltro(imgDataFilt, estadoJuego.filtroActual);

      // Guardar el objeto estructural con los datos de la subimagen
      estadoJuego.piezas.push({
        id: id++,
        col: c,
        row: r,
        width: subWidth,
        height: subHeight,
        rotacion: angulos[Math.floor(Math.random() * angulos.length)], //[cite: 1]
        fijada: false,                                                // Para "Ayudita"[cite: 2]
        canvasPropio: crearCanvasDePieza(subWidth, subHeight, imgDataFilt),
        imgDataOriginal: imgDataOrig
      });
    }
  }

  dibujarJuego();
}

// Función auxiliar para pasar de ImageData a un Canvas que se pueda dibujar fácil con drawImage[cite: 17, 19]
function crearCanvasDePieza(w, h, imageData) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').putImageData(imageData, 0, 0); //[cite: 17]
  return c;
}

function dibujarJuego() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  estadoJuego.piezas.forEach(pieza => {
    const dx = estadoJuego.offsetLeft + (pieza.col * pieza.width);
    const dy = estadoJuego.offsetTop + (pieza.row * pieza.height);

    ctx.save();
    // Trasladar y rotar según el centro de la subimagen[cite: 1]
    ctx.translate(dx + pieza.width / 2, dy + pieza.height / 2);
    ctx.rotate((pieza.rotacion * Math.PI) / 180);

    // Dibujar el canvas interno procesado[cite: 19]
    ctx.drawImage(pieza.canvasPropio, -pieza.width / 2, -pieza.height / 2);
    ctx.restore();

    // Borde si la pieza fue fijada por "Ayudita"[cite: 2]
    if (pieza.fijada) {
      ctx.strokeStyle = 'gold';
      ctx.lineWidth = 3;
      ctx.strokeRect(dx + 2, dy + 2, pieza.width - 4, pieza.height - 4);
    }
  });
}

// Desactivar menú derecho en el canvas[cite: 1]
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', function (e) {
  if (estadoJuego.juegoTerminado) return;

  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  estadoJuego.piezas.forEach(pieza => {
    const px = estadoJuego.offsetLeft + (pieza.col * pieza.width);
    const py = estadoJuego.offsetTop + (pieza.row * pieza.height);

    // Detectar si el click fue dentro de esta subimagen
    if (clickX >= px && clickX <= px + pieza.width &&
        clickY >= py && clickY <= py + pieza.height) {

      if (!pieza.fijada) {
        // Rotar: Clic Derecho = 90°, Clic Izquierdo = -90°[cite: 1]
        const sentido = (e.button === 2) ? 90 : -90;
        pieza.rotacion = (pieza.rotacion + sentido + 360) % 360;

        dibujarJuego();
        comprobarVictoria();
      }
    }
  });
});

function comprobarVictoria() {
  // Si todas las piezas tienen rotación 0°[cite: 1]
  const gano = estadoJuego.piezas.every(p => p.rotacion === 0);

  if (gano) {
    estadoJuego.juegoTerminado = true;
    clearInterval(estadoJuego.timerInterval);

    // Al ganar: quitar filtros restaurando el ImageData RGB original (Funcionalidad General)[cite: 1, 17]
    estadoJuego.piezas.forEach(pieza => {
      const ctxPieza = pieza.canvasPropio.getContext('2d');
      ctxPieza.putImageData(pieza.imgDataOriginal, 0, 0); //[cite: 17]
    });

    dibujarJuego();
    setTimeout(() => alert("¡Nivel superado!"), 200);
  }
}

iniciarNivel();