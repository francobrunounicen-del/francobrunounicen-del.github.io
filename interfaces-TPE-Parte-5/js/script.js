
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
    const state = { lastX: track.scrollLeft, raf: null, resetTimer: null };
    updateCarouselButtons(track);
    track.addEventListener('scroll', () => onTrackScroll(track, state), { passive: true });
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.carousel-track').forEach(updateCarouselButtons);
  });
}

/* Un solo listener por track: flechas + skew fluido sin vibraciones */
function onTrackScroll(track, state) {
  updateCarouselButtons(track);

  const currentX = track.scrollLeft;
  const vel = currentX - state.lastX;
  state.lastX = currentX;

  if (Math.abs(vel) < 1.5) return;

  const skew = Math.max(-10, Math.min(10, vel * 0.25));
  const stretch = 1 + Math.abs(skew) / 100;
  const cards = track.querySelectorAll('.game-card');
  if (!cards.length) return;

  if (state.raf) cancelAnimationFrame(state.raf);

  state.raf = requestAnimationFrame(() => {
    cards.forEach((c) => {
      c.style.transition = 'transform 0.05s ease-out';
      c.style.transform = 'skewX(' + (-skew) + 'deg) scaleX(' + stretch + ') translateZ(0)';
    });
  });

  clearTimeout(state.resetTimer);
  state.resetTimer = setTimeout(() => {
    cards.forEach((c) => {
      c.style.transition = 'transform 0.25s ease-out';
      c.style.transform = 'skewX(0deg) scaleX(1) translateZ(0)';
    });
  }, 80);
}

// Helpers UI juego (evitan lookups repetidos y null-crashes)
function setBotonera(el, show) { if (el) el.style.display = show ? 'flex' : 'none'; }
function setCover(src) { const c = document.querySelector('.game-cover'); if (c && src) c.src = src; }
function showTimer(show, text) {
  const t = document.getElementById('timer-display');
  if (!t) return;
  t.style.display = show ? 'block' : 'none';
  if (text !== undefined) t.textContent = text;
}
function showNivel(show) {
  const el = document.getElementById('level-display');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  if (show) el.textContent = 'Nivel: ' + estadoJuego.nivelActual;
}
function showVeil(show) {
  const v = document.getElementById('gameVeil');
  if (!v) return;
  v.style.display = show ? 'block' : 'none';
}
/* Posiciona el marco con coordenadas del canvas expresadas en porcentajes.
   Lo usan tanto el tablero como la imagen original del final, para que el
   marco siempre encuadre exactamente lo que se está mostrando. */
function ubicarMarco(x, y, w, h) {
  const f = document.getElementById('boardFrame');
  if (!f || !canvas) return;
  f.style.left = (x / canvas.width * 100) + '%';
  f.style.top = (y / canvas.height * 100) + '%';
  f.style.width = (w / canvas.width * 100) + '%';
  f.style.height = (h / canvas.height * 100) + '%';
  f.style.display = 'block';
}

function showMarco(show) {
  const f = document.getElementById('boardFrame');
  if (!f || !canvas) return;
  if (show) {
    ubicarMarco(estadoJuego.offsetLeft, estadoJuego.offsetTop, estadoJuego.tableroW, estadoJuego.tableroH);
  } else {
    f.style.display = 'none';
  }
}

// 2. Inits por página (early-returns: cada init sale si no está en esa página)
document.addEventListener('DOMContentLoaded', () => {
  initRegistro();
  initLogin();
  initComments();
  initHome();
});

function initRegistro() {
  /* --- VALIDACIÓN DE REGISTRO Y ANIMACIÓN EN 2 PASOS (SPINNER -> ÉXITO) --- */
  const formRegister = document.getElementById('formRegister');
  if (!formRegister) return;
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

function initLogin() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    // Simula el ingreso y redirige a la home
    window.location.href = 'index.html';
  });
}

function initHome() {
  if (document.querySelector('.carousel-track')) initCarousels();
  if (document.getElementById('c1') || document.getElementById('cApi')) cargarJuegosDesdeAPI();
}

function initComments() {
  /* --- PUBLICAR COMENTARIOS EN PAGINA DE JUEGO --- */
  const sendCommentBtn = document.getElementById('sendCommentBtn');
  const commentInput = document.getElementById('newComment');
  const commentsList = document.getElementById('commentsList');
  if (!sendCommentBtn || !commentInput || !commentsList) return;

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

function toggleDropdown(e, id) {
  // Compat: onclick="toggleDropdown('x')" (sin evento) o toggleDropdown(event,'x')
  if (typeof e === 'string' && id === undefined) { id = e; e = undefined; }
  if (e && e.stopPropagation) e.stopPropagation();
  const dropdown = document.getElementById(id);
  if (!dropdown) return;

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

// LOADER DEL HOME: carga simulada de 1 segundo con animacion retro
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