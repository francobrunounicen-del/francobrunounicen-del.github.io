/* ==========================================
   ARCHIVO: js/script.js
   ========================================== */

// 0. Menu desplegable de usuario
document.querySelector('.btn-logout').addEventListener('click', () => {
  window.location.href = "login.html";
})
  
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
}

// 2. Controladores de eventos e interacción al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {

  /* --- CONTROL DEL MODAL DE REGISTRO --- */
  const modal = document.getElementById('registerModal');
  const closeBtn = document.getElementById('closeRegisterModal');
  const linkToLogin = document.getElementById('linkToLogin');
  
  // Captura solo los enlaces que abren el modal de registro.
  // (El botón de perfil abre el dropdown de usuario, no el modal.)
  const openBtns = document.querySelectorAll('.open-register-modal, #openRegisterModal');

  // Abrir Modal al hacer clic en cualquiera de los activadores
  openBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (modal) modal.classList.add('active');
    });
  });

  // Cerrar con el botón X
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.remove('active');
    });
  }

  // Cerrar al hacer clic en "Iniciá sesión" dentro del modal
  if (linkToLogin) {
    linkToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.remove('active');
    });
  }

  // Cerrar al hacer clic fuera de la tarjeta modal
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Cerrar presionando la tecla Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      modal.classList.remove('active');
    }
  });


  /* --- PUNTO 1: REGISTRO CORRECTO CON ANIMACION (keyframes %) --- */
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
      if (btn) {
        btn.classList.add('loading');
        btn.textContent = 'Registrando...';
      }
      // Simula validación y muestra éxito animado
      setTimeout(() => {
        const card = formRegister.closest('.register-card');
        if (!card || card.querySelector('.register-success')) return;
        const colors = ['#ff6b00', '#8b5cf6', '#00e5ff', '#facc15', '#22c55e', '#ec4899'];
        let confetti = '';
        for (let i = 0; i < 24; i++) {
          const left = 5 + Math.random() * 90;
          const delay = (Math.random() * 0.5).toFixed(2);
          const c = colors[i % colors.length];
          confetti += `<span class="confetti" style="left:${left}%;background:${c};animation-delay:${delay}s"></span>`;
        }
        card.insertAdjacentHTML('beforeend', `
          <div class="register-success">
            ${confetti}
            <div class="check-circle">
              <svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg>
            </div>
            <h3>¡Registro exitoso!</h3>
            <p>Tu cuenta fue creada. Ya podés empezar a jugar.</p>
          </div>`);
        setTimeout(() => {
          if (modal) modal.classList.remove('active');
          const ok = card.querySelector('.register-success');
          if (ok) ok.remove();
          if (btn) { btn.classList.remove('loading'); btn.textContent = 'Registrarme'; }
          formRegister.reset();
          window.location.href = 'index.html';
        }, 2200);
      }, 900);
    });
  }

  initCarousels();

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
      if (e.key === 'Enter') {
        postComment();
      }
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

  // Ocultar el otro menú si está abierto para evitar solapamientos
  const otherId = id === 'categoriesDropdown' ? 'userDropdown' : 'categoriesDropdown';
  const other = document.getElementById(otherId);
  if (other) other.classList.add('hidden');

  // Alternar visibilidad del menú seleccionado
  dropdown.classList.toggle('hidden');
}

// Cerrar dropdowns al hacer clic fuera o con Escape
document.addEventListener('click', (e) => {
  if (e.target.closest && (e.target.closest('.dropdown-card') || e.target.closest('#menu-btn') || e.target.closest('#profile-btn'))) return;
  ['categoriesDropdown', 'userDropdown'].forEach((dropId) => {
    const d = document.getElementById(dropId);
    if (d) d.classList.add('hidden');
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['categoriesDropdown', 'userDropdown'].forEach((dropId) => {
      const d = document.getElementById(dropId);
      if (d) d.classList.add('hidden');
    });
  }
});