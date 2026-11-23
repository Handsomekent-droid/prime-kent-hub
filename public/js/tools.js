(async function () {
  const { $, el, toast, sb } = Hub;
  Hub.chrome();
  const session = await Hub.getSession();
  if (session) await Hub.checkAdmin();
  Hub.nav('tools', session, null); Hub.footer();
  const copy = async (t, btn) => { try { await navigator.clipboard.writeText(t); toast('Copied ✓'); if (btn) { const o = btn.textContent; btn.textContent = '✓'; setTimeout(() => (btn.textContent = o), 1200); } } catch { toast('Select the text and copy it by hand', 'err'); } };

  /* chips */
  const TOOLS = [['style', '✨ Fancy text'], ['qr', '📱 QR code'], ['wa', '💬 WhatsApp link'], ['img', '🖼 Image shrink'], ['link', '🔗 Short links'], ['text', '🔤 Text tools'], ['idea', '🎲 Status ideas']];
  function show(k) {
    TOOLS.forEach(([x]) => $('t-' + x).classList.toggle('hide', x !== k));
    [...$('chips').children].forEach((b, i) => b.classList.toggle('on', TOOLS[i][0] === k));
    if (k === 'qr') drawQr(); if (k === 'link') loadLinks();
    try { history.replaceState(null, '', '#' + k); } catch {}
  }
  TOOLS.forEach(([k, t]) => $('chips').append(el('button', { text: t, onclick: () => show(k) })));

  /* ---------- fancy text ---------- */
  const up = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lo = 'abcdefghijklmnopqrstuvwxyz', dg = '0123456789';
  const mk = (U, L, D, ex = {}) => (s) => [...s].map((c) => { if (ex[c]) return ex[c]; let i = up.indexOf(c); if (i >= 0 && U) return String.fromCodePoint(U + i); i = lo.indexOf(c); if (i >= 0 && L) return String.fromCodePoint(L + i); i = dg.indexOf(c); if (i >= 0 && D) return String.fromCodePoint(D + i); return c; }).join('');
  const tbl = (from, to) => (s) => [...s].map((c) => { const i = from.indexOf(c.toLowerCase()); return i >= 0 ? [...to][i] : c; }).join('');
  const comb = (m) => (s) => [...s].map((c) => (c === ' ' ? c : c + m)).join('');
  const STYLES = [
    ['Bold', mk(0x1d400, 0x1d41a, 0x1d7ce)], ['Italic', mk(0x1d434, 0x1d44e, 0, { h: 'ℎ' })], ['Bold italic', mk(0x1d468, 0x1d482, 0)],
    ['Script', mk(0x1d49c, 0x1d4b6, 0, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' })], ['Bold script', mk(0x1d4d0, 0x1d4ea, 0)],
    ['Gothic', mk(0x1d504, 0x1d51e, 0, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' })], ['Bold gothic', mk(0x1d56c, 0x1d586, 0)],
    ['Double struck', mk(0x1d538, 0x1d552, 0x1d7d8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' })],
    ['Sans', mk(0x1d5a0, 0x1d5ba, 0x1d7e2)], ['Sans bold', mk(0x1d5d4, 0x1d5ee, 0x1d7ec)], ['Sans italic', mk(0x1d608, 0x1d622, 0)], ['Monospace', mk(0x1d670, 0x1d68a, 0x1d7f6)],
    ['Circles', (s) => [...s].map((c) => { let i = up.indexOf(c); if (i >= 0) return String.fromCodePoint(0x24b6 + i); i = lo.indexOf(c); if (i >= 0) return String.fromCodePoint(0x24d0 + i); if (c === '0') return '⓪'; i = '123456789'.indexOf(c); return i >= 0 ? String.fromCodePoint(0x2460 + i) : c; }).join('')],
    ['Squares', (s) => [...s.toUpperCase()].map((c) => { const i = up.indexOf(c); return i >= 0 ? String.fromCodePoint(0x1f130 + i) : c; }).join('')],
    ['Dark squares', (s) => [...s.toUpperCase()].map((c) => { const i = up.indexOf(c); return i >= 0 ? String.fromCodePoint(0x1f170 + i) : c; }).join('')],
    ['Small caps', tbl(lo, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ')],
    ['Wide', (s) => [...s].map((c) => { if (c === ' ') return '　'; const k = c.codePointAt(0); return k >= 33 && k <= 126 ? String.fromCodePoint(k + 0xfee0) : c; }).join('')],
    ['Upside down', (s) => [...tbl(lo + dg + '.,!?', 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz0⇂ᄅƐㄣϛ9ㄥ86˙\'¡¿')(s)].reverse().join('')],
    ['Strikethrough', comb('̶')], ['Underline', comb('̲')], ['Slashed', comb('̸')]
  ];
  function paintStyles() {
    const v = $('sIn').value || 'Prime Kent'; const box = $('sOut'); box.textContent = '';
    STYLES.forEach(([n, f]) => { const out = f(v); const b = el('button', { class: 'mini', text: 'Copy', onclick: () => copy(out, b) }); box.append(el('div', { class: 'sty' }, el('div', {}, el('small', { text: n }), document.createTextNode(out)), b)); });
  }
  $('sIn').oninput = paintStyles; paintStyles();

  /* ---------- QR ---------- */
  let qrReady = null;
  const loadQr = () => qrReady || (qrReady = new Promise((ok) => { if (window.qrcode) return ok(true); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = () => ok(!!window.qrcode); s.onerror = () => ok(false); document.head.append(s); }));
  async function drawQrOn(cv, text, fg, bg) {
    const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
    if (!text) return true;
    if (!(await loadQr())) return false;
    try { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(), pad = 16, m = (cv.width - pad * 2) / n; c.fillStyle = fg; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(pad + k * m, pad + r * m, Math.ceil(m), Math.ceil(m)); return true; } catch { return false; }
  }
  async function drawQr() { const ok = await drawQrOn($('qCv'), $('qIn').value.trim(), $('qFg').value, $('qBg').value); $('qMsg').textContent = ok ? '' : 'The QR library could not load. Check your connection.'; }
  ['qIn', 'qFg', 'qBg'].forEach((i) => ($(i).oninput = drawQr));
  $('qDl').onclick = () => $('qCv').toBlob((b) => { const a = el('a', { href: URL.createObjectURL(b), download: 'qr-code.png' }); document.body.append(a); a.click(); a.remove(); });

  /* ---------- wa.me ---------- */
  Hub.COUNTRIES.forEach(([c, l]) => $('wCc').append(el('option', { value: c, text: l }))); $('wCc').value = '254';
  function paintWa() {
    let n = $('wNum').value.replace(/\D/g, '').replace(/^0+/, ''); const cc = $('wCc').value;
    const url = n.length >= 6 ? `https://wa.me/${cc}${n}${$('wMsg').value.trim() ? '?text=' + encodeURIComponent($('wMsg').value.trim()) : ''}` : '';
    $('wOut').textContent = url || '—'; $('wOpen').href = url || '#'; $('wOpen').style.opacity = url ? 1 : 0.4; return url;
  }
  ['wCc', 'wNum', 'wMsg'].forEach((i) => ($(i).oninput = paintWa));
  $('wCopy').onclick = () => { const u = paintWa(); if (u) copy(u, $('wCopy')); else toast('Enter a number first', 'err'); };

  /* ---------- image shrink ---------- */
  let outBlob = null;
  const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : Math.round(n / 1024) + ' KB');
  async function shrink() {
    const f = $('iFile').files && $('iFile').files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const max = +$('iMax').value; const k = max ? Math.min(1, max / Math.max(im.width, im.height)) : 1;
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      outBlob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', +$('iQ').value / 100));
      $('iInfo').textContent = `${im.width}×${im.height} · ${kb(f.size)}  →  ${c.width}×${c.height} · ${kb(outBlob.size)}`;
      $('iPrev').src = URL.createObjectURL(outBlob); $('iPrev').style.display = 'block'; $('iDl').classList.remove('hide');
    } catch { toast('Could not read that picture', 'err'); } finally { URL.revokeObjectURL(url); }
  }
  $('iFile').onchange = shrink; $('iMax').onchange = shrink; $('iQ').oninput = () => { $('iQv').textContent = $('iQ').value; shrink(); };
  $('iDl').onclick = () => { if (!outBlob) return; const a = el('a', { href: URL.createObjectURL(outBlob), download: 'small-picture.jpg' }); document.body.append(a); a.click(); a.remove(); };

  /* ---------- short links ---------- */
  const base = location.origin + '/s/';
  $((session ? 'lApp' : 'lGuest')).classList.remove('hide');
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  async function loadLinks() {
    if (!session) return;
    const { data, error } = await sb.from('short_links').select('*').order('created_at', { ascending: false }).limit(50);
    const box = $('lList'); box.textContent = '';
    if (error) return box.append(el('div', { class: 'hint', text: 'Short links turn on after the new SQL is run.' }));
    if (!data.length) box.append(el('div', { class: 'hint', text: 'No links yet.' }));
    data.filter((r) => r.user_id === session.user.id).forEach((r) => {
      const cp = el('button', { class: 'mini', text: 'Copy', onclick: () => copy(base + r.code, cp) });
      const del = el('button', { class: 'mini bad', text: 'Delete', onclick: async () => { if (!confirm('Delete this link?')) return; await sb.from('short_links').delete().eq('code', r.code); loadLinks(); } });
      box.append(el('div', { class: 'out' }, el('span', {}, document.createTextNode(base + r.code), el('div', { class: 'hint', text: `${r.clicks} click${r.clicks === 1 ? '' : 's'} · ${r.url.slice(0, 60)}${r.url.length > 60 ? '…' : ''}` })), cp, del));
    });
  }
  $('lGo').onclick = async () => {
    const url = $('lUrl').value.trim();
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(url)) return toast('Enter a full link starting with http:// or https://', 'err');
    let code = $('lCode').value.trim();
    if (code && !/^[a-zA-Z0-9_-]{3,24}$/.test(code)) return toast('Custom name: 3 to 24 letters, numbers, - or _', 'err');
    $('lGo').disabled = true;
    let err = null;
    for (let i = 0; i < 4; i++) {
      const c = code || rnd();
      const r = await sb.from('short_links').insert({ code: c, url, user_id: session.user.id });
      if (!r.error) { err = null; code = c; break; }
      err = r.error; if (code) break; // a custom name that is taken is the user's to change
    }
    $('lGo').disabled = false;
    if (err) return toast(/duplicate|unique/i.test(err.message || '') ? 'That name is taken. Try another.' : (err.message || 'Could not save'), 'err');
    $('lUrl').value = ''; $('lCode').value = ''; toast('Short link made ✓');
    const cp = el('button', { class: 'mini', text: 'Copy', onclick: () => copy(base + code, cp) });
    $('lOut').textContent = ''; $('lOut').append(el('div', { class: 'out' }, el('span', { text: base + code }), cp)); loadLinks();
  };

  /* ---------- text tools ---------- */
  const title = (s) => s.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
  const sentence = (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const ACTIONS = [['UPPER', (s) => s.toUpperCase()], ['lower', (s) => s.toLowerCase()], ['Title Case', title], ['Sentence case', sentence], ['Reverse', (s) => [...s].reverse().join('')], ['Clean spaces', (s) => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()], ['Sort lines', (s) => s.split('\n').sort((a, b) => a.localeCompare(b)).join('\n')], ['Remove duplicates', (s) => [...new Set(s.split('\n'))].join('\n')]];
  ACTIONS.forEach(([n, f]) => $('xBtns').append(el('button', { text: n, onclick: () => { $('xIn').value = f($('xIn').value); count(); } })));
  function count() { const t = $('xIn').value; $('xCount').textContent = `${[...t].length} characters · ${(t.trim().match(/\S+/g) || []).length} words · ${t ? t.split('\n').length : 0} lines`; }
  $('xIn').oninput = count; $('xCopy').onclick = () => copy($('xIn').value, $('xCopy'));

  /* ---------- status ideas ---------- */
  const IDEAS = {
    Motivation: ['Small steps still move you forward.', 'Work in silence, let your results make the noise.', 'Today I choose progress over perfect.', 'Dream big. Start small. Start today.', 'Be the reason you smile tomorrow.', 'Discipline is the bridge between goals and results.', 'Your only limit is the one you accept.', 'Keep going. Your future self is watching.'],
    Love: ['You are my favourite notification.', 'Home is wherever you are.', 'Loving you is the easiest thing I do.', 'My heart picked you, my mind agreed.', 'Every love story is beautiful, but ours is my favourite.', 'You make ordinary days feel special.'],
    Funny: ['I am not lazy, I am on energy-saving mode.', 'My bed and I have a very serious relationship.', 'I came, I saw, I forgot why.', 'Wi-Fi is my love language.', 'I told my phone I would sleep early. We both laughed.', 'Plot twist: I actually did read the instructions.', 'Not everything needs a reply. Some things need a seen.'],
    Attitude: ['I do not chase. I attract.', 'Silence is also an answer.', 'Be so good they cannot ignore you.', 'I am not for everyone, and that is fine.', 'Low voice, high standards.', 'Different is a compliment.'],
    Friendship: ['Real friends are the family we choose.', 'Good friends: partners in crime, and in snacks.', 'A true friend celebrates your wins louder than you do.', 'Thank you for being you. Never change.', 'Squad goals: laugh loud, love hard, stay loyal.'],
    'Good morning': ['Good morning! Today is a fresh page, write something good.', 'Rise, shine and be kind. The day is yours.', 'New day, new blessings, new chances.', 'Wake up with purpose. Go to bed with pride.', 'Morning! Coffee first, world domination second.']
  };
  let cat = 'Motivation';
  const pick = () => { const a = IDEAS[cat]; $('gText').textContent = a[Math.floor(Math.random() * a.length)]; };
  Object.keys(IDEAS).forEach((k) => $('gChips').append(el('button', { text: k, onclick: () => { cat = k; [...$('gChips').children].forEach((b) => b.classList.toggle('on', b.textContent === k)); pick(); } })));
  $('gChips').firstChild.classList.add('on'); pick(); $('gNew').onclick = pick; $('gCopy').onclick = () => copy($('gText').textContent, $('gCopy'));

  show(TOOLS.some(([k]) => k === location.hash.slice(1)) ? location.hash.slice(1) : 'style');
})();
