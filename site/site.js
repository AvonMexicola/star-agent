// Ambient captures are lazy, muted and disposable. The film remains user-operated.
const videos = [...document.querySelectorAll('video[data-loop]')];
const button = document.querySelector('.motion-toggle');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const connection = navigator.connection;
let paused = reduced.matches || Boolean(connection?.saveData);
const visible = new Set();
function sync() {
  document.documentElement.dataset.motion = paused ? 'paused' : 'playing';
  button.textContent = paused ? 'Play motion' : 'Pause motion';
  button.setAttribute('aria-pressed', String(paused));
  for (const video of videos) {
    if (paused || document.hidden || !visible.has(video)) { video.pause(); continue; }
    if (!video.src) video.src = video.dataset.loop;
    video.play().then(() => { if (paused || document.hidden || !visible.has(video)) video.pause(); else video.classList.add('playing'); }).catch(() => video.classList.remove('playing'));
  }
}
button.hidden = false;
button.addEventListener('click', () => { paused = !paused; sync(); });
reduced.addEventListener('change', () => { paused = reduced.matches || Boolean(connection?.saveData); sync(); });
document.addEventListener('visibilitychange', sync);
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target);
  sync();
}, { threshold: 0.15 });
for (const video of videos) {
  observer.observe(video);
  video.addEventListener('error', () => video.classList.remove('playing'));
}
sync();
