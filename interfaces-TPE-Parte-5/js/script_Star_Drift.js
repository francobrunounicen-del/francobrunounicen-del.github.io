document.addEventListener('DOMContentLoaded', () => {
    const playBtn = document.getElementById('playBtn');
    const canvas = document.getElementById('canvas');
    const btnComenzar = document.getElementById('comenzarBtn');

    if (playBtn) {
        playBtn.addEventListener('click', () => {
            playBtn.classList.add('is-playing');
            canvas.style.display = 'block';
        });
    }

});