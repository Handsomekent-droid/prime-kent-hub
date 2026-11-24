/* Prime Kent Dev Hub — shared front-end helpers (Supabase auth, API calls, nav, toasts). */
(function () {
  const cfg = window.HUB || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/YOUR-/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY) && window.supabase);
  const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n[k] = v; else n.setAttribute(k, v); } kids.forEach((c) => n.append(c)); return n; };

  const COUNTRIES = [['254', '🇰🇪 +254'], ['255', '🇹🇿 +255'], ['256', '🇺🇬 +256'], ['250', '🇷🇼 +250'], ['251', '🇪🇹 +251'], ['234', '🇳🇬 +234'], ['233', '🇬🇭 +233'], ['27', '🇿🇦 +27'], ['243', '🇨🇩 +243'], ['225', '🇨🇮 +225'], ['20', '🇪🇬 +20'], ['212', '🇲🇦 +212'], ['91', '🇮🇳 +91'], ['92', '🇵🇰 +92'], ['62', '🇮🇩 +62'], ['63', '🇵🇭 +63'], ['60', '🇲🇾 +60'], ['880', '🇧🇩 +880'], ['55', '🇧🇷 +55'], ['52', '🇲🇽 +52'], ['1', '🇺🇸 +1'], ['44', '🇬🇧 +44'], ['49', '🇩🇪 +49'], ['33', '🇫🇷 +33'], ['34', '🇪🇸 +34'], ['39', '🇮🇹 +39'], ['971', '🇦🇪 +971'], ['966', '🇸🇦 +966'], ['90', '🇹🇷 +90'], ['7', '🇷🇺 +7']];

  function toast(text, type) {
    let t = $('toast'); if (!t) { t = el('div', { id: 'toast', class: 'toast' }); document.body.append(t); }
    t.textContent = text; t.className = 'toast show' + (type === 'err' ? ' err' : '');
    clearTimeout(t._h); t._h = setTimeout(() => { t.className = 'toast'; }, 3800);
  }

  function applyPrefs(settings) {
    const s = settings || {};
    let acc = s.accent; let calm = s.calm;
    try { acc = acc || localStorage.getItem('pk_accent'); if (calm === undefined) calm = localStorage.getItem('pk_calm') === '1'; } catch {}
    if (acc) document.documentElement.setAttribute('data-accent', acc);
    document.documentElement.setAttribute('data-calm', calm ? 'on' : 'off');
  }
  applyPrefs();
  try { const rf = new URLSearchParams(location.search).get('ref'); if (rf && /^[a-f0-9]{8}$/.test(rf)) localStorage.setItem('pk_ref', rf); } catch {}
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; document.dispatchEvent(new Event('pk-installable')); });
  const install = async () => { if (!installEvt) return false; installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; return true; };

  function chrome() {
    if (!$('bgfx')) document.body.prepend(el('div', { class: 'bg', id: 'bgfx' }), el('div', { class: 'orb o1' }), el('div', { class: 'orb o2' }));
    if (!configured) {
      const w = document.querySelector('.wrap') || document.body;
      w.prepend(el('div', { class: 'setup', text: '⚙️ Setup needed: open public/js/config.js and paste your Supabase URL and anon key (see README.md).' }));
    }
  }

  async function getSession() { if (!sb) return null; const { data } = await sb.auth.getSession(); return data.session || null; }
  async function requireAuth() {
    const s = await getSession();
    if (!s) { location.replace('/?next=' + encodeURIComponent(location.pathname)); return null; }
    return s;
  }
  const displayName = (u) => (u?.user_metadata?.full_name || u?.user_metadata?.name || (u?.email ? u.email.split('@')[0] : '') || (u?.phone ? '+' + u.phone : '') || 'Hub user');

  async function loadProfile(user) {
    if (!sb || !user) return { settings: {} };
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) return data;
      const row = { id: user.id, display_name: displayName(user), settings: {} };
      await sb.from('profiles').upsert(row);
      return row;
    } catch { return { settings: {} }; }
  }
  async function saveProfile(user, patch) {
    if (!sb) return;
    const { error } = await sb.from('profiles').upsert({ id: user.id, ...patch, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  const ICON = {
    projects: '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/>',
    pair: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    tools: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    community: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/>',
    account: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
  };
  const TABS = [['projects', 'Home', '/projects'], ['tools', 'Tools', '/tools'], ['pair', 'Pair', '/pair'], ['community', 'Chat', '/community'], ['account', 'Me', '/account']];
  function tabbar(active) {
    if ($('tabbar')) return;
    const bar = el('nav', { class: 'tabbar', id: 'tabbar', 'aria-label': 'Main' });
    TABS.forEach(([k, label, href]) => {
      const ic = el('i'); ic.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICON[k] + '</svg>';
      const a = el('a', { href, class: (active === k ? 'on' : '') + (k === 'pair' ? ' fab' : '') }, ic, el('span', { text: label }));
      a.addEventListener('click', () => { try { navigator.vibrate && navigator.vibrate(8); } catch {} });
      bar.append(a);
    });
    document.body.append(bar);
  }
  const NAV = [['projects', '🏠', 'Projects', '/projects'], ['pair', '🔗', 'Pair', '/pair'], ['tools', '🛠', 'Tools', '/tools'], ['community', '🌐', 'Community', '/community'], ['cmds', '📚', 'Commands', '/commands'], ['account', '👤', 'Account', '/account']];
  function nav(active, session, profile) {
    const u = session?.user; const name = profile?.display_name || displayName(u);
    let isAdm = false; try { isAdm = sessionStorage.getItem('pk_admin') === '1'; } catch {}
    const header = el('header', { class: 'nav' });
    header.append(el('a', { class: 'brand', href: '/' }, el('img', { src: '/img/logo.jpg', alt: '' }), el('div', {}, el('b', { text: 'PRIME KENT DEV HUB' }), el('small', { text: 'Nexora Nemesis Pairing' }))));
    NAV.forEach(([k, ic, tx, href]) => header.append(el('a', { class: 'l' + (active === k ? ' on' : ''), href }, ic + ' ', el('span', { text: tx }))));
    if (isAdm) header.append(el('a', { class: 'l' + (active === 'admin' ? ' on' : ''), href: '/admin' }, '🛡 ', el('span', { text: 'Admin' })));
    header.append(el('a', { class: 'hbtn', href: '/commands', 'aria-label': 'Commands', text: '📚' }));
    tabbar(active);
    if (!u) { header.append(el('a', { class: 'btn sm', href: '/', style: 'width:auto;margin:0;padding:9px 14px;text-decoration:none', text: 'Sign in' })); document.body.prepend(header); return; }
    const av = el('button', { class: 'av', 'aria-label': 'Account menu' });
    const pic = u?.user_metadata?.avatar_url || u?.user_metadata?.picture;
    if (pic) av.append(el('img', { src: pic, alt: '', referrerpolicy: 'no-referrer' })); else av.textContent = (name[0] || '?').toUpperCase();
    const menu = el('div', { class: 'menu', id: 'menu' },
      el('div', { class: 'who', text: u?.email || (u?.phone ? '+' + u.phone : name) }),
      ...NAV.filter((n) => n[0] !== 'account').map((n) => el('a', { href: n[3], text: n[1] + ' ' + n[2] })), el('a', { href: '/account', text: '👤 My account' }), el('a', { href: '/account#settings', text: '⚙️ Settings' }),
      ...(isAdm ? [el('a', { href: '/admin', text: '🛡 Admin' })] : []),
      el('button', { text: '🚪 Sign out', onclick: signOut }));
    av.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
    document.addEventListener('click', () => menu.classList.remove('open'));
    header.append(av); document.body.prepend(menu); document.body.prepend(header);
  }
  async function signOut() { try { await sb.auth.signOut(); } catch {} location.href = '/'; }

  async function api(path, opts = {}) {
    const s = await getSession();
    if (!s) { location.href = '/'; throw new Error('Signed out'); }
    const r = await fetch('/api/' + path, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let d; try { d = await r.json(); } catch { d = { ok: false, msg: 'Server error.' }; }
    if (r.status === 401) { toast('Session expired — please sign in again.', 'err'); setTimeout(signOut, 1200); }
    return d;
  }

  // is this person an admin? (asked once per browser session; the server decides, the page only shows a link)
  async function checkAdmin() {
    try { const c = sessionStorage.getItem('pk_admin'); if (c !== null) return c === '1'; } catch {}
    try {
      const s = await getSession(); if (!s) return false;
      const r = await fetch('/api/admin?action=whoami', { headers: { Authorization: 'Bearer ' + s.access_token } });
      const d = await r.json(); const a = !!(d && d.admin);
      try { sessionStorage.setItem('pk_admin', a ? '1' : '0'); } catch {}
      return a;
    } catch { return false; }
  }

  // numbers that count up when they appear
  function countUp(node) {
    const to = parseInt(String(node.textContent).replace(/\D/g, ''), 10); if (!to || to > 100000) return;
    const suffix = /\+\s*$/.test(node.textContent) ? '+' : ''; const t0 = performance.now(), dur = 900;
    const tick = (t) => { const k = Math.min(1, (t - t0) / dur); node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + (k === 1 ? suffix : ''); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  function footer() { document.body.append(el('div', { class: 'foot', text: 'PRIME KENT DEV HUB · NEXORA NEMESIS 404 · DEV × PRIME × KILLER × KENT' })); }

  window.Hub = { countUp, checkAdmin, install, canInstall: () => !!installEvt, cfg, sb, configured, $, el, toast, chrome, getSession, requireAuth, displayName, loadProfile, saveProfile, nav, signOut, api, applyPrefs, COUNTRIES, footer };
})();
