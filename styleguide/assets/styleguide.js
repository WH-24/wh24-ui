function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function setActiveNavByHash(){
  const hash = decodeURIComponent(location.hash || '#overview');
  const links = qsa('.sg-nav a[data-sg-link]');
  links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === hash));
}

function initNav(){
  setActiveNavByHash();
  window.addEventListener('hashchange', setActiveNavByHash);
}

function initCopyTokens(){
  qsa('[data-copy]').forEach(el => {
    el.addEventListener('click', async () => {
      const text = el.getAttribute('data-copy') || '';
      try{
        await navigator.clipboard.writeText(text);
        el.setAttribute('data-copied','1');
        setTimeout(()=>el.removeAttribute('data-copied'), 700);
      }catch{
        // ignore
      }
    });
  });
}

function initModalDemo(){
  const open = qs('[data-sg-open-modal]');
  const backdrop = qs('[data-sg-modal]');
  if(!open || !backdrop) return;

  const closeAll = () => backdrop.classList.remove('on');

  open.addEventListener('click', () => backdrop.classList.add('on'));
  qsa('[data-sg-close-modal]', backdrop).forEach(btn => btn.addEventListener('click', closeAll));
  backdrop.addEventListener('click', (e) => {
    if(e.target === backdrop) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape') closeAll();
  });
}

function initTinyInteractions(){
  // demo: toggle "seg" buttons
  qsa('[data-sg-seg]').forEach(seg => {
    qsa('button', seg).forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('button', seg).forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
      });
    });
  });
}

function initThemeToggle(){
  const btn = qs('[data-sg-theme-toggle]');
  if(!btn) return;

  const root = document.documentElement;
  const KEY = 'sg-theme';

  const apply = (theme) => {
    if(theme === 'dark') root.setAttribute('data-theme','dark');
    else root.removeAttribute('data-theme');
    btn.setAttribute('data-theme', theme || 'light');
  };

  const saved = localStorage.getItem(KEY);
  apply(saved);

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    apply(next);
  });
}

initNav();
initCopyTokens();
initModalDemo();
initTinyInteractions();
initThemeToggle();

