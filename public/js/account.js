(async function () {
  const { $, el, api, toast, sb } = Hub;
  Hub.chrome();
  const session = await Hub.requireAuth(); if (!session) return;
  const user = session.user;
  let profile = await Hub.loadProfile(user);
  const settings = () => (profile.settings = profile.settings || {});
  await Hub.checkAdmin();
  Hub.applyPrefs(settings()); Hub.nav('account', session, profile); Hub.footer();

  /* header + profile */
  const name = profile.display_name || Hub.displayName(user);
  const pic = user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture);
  const av = $('bigav'); if (pic) { av.textContent = ''; av.append(el('img', { src: pic, alt: '', referrerpolicy: 'no-referrer' })); } else av.textContent = (name[0] || '?').toUpperCase();
  $('hName').textContent = name; $('hSub').textContent = user.email || (user.phone ? '+' + user.phone : '');
  const providers = [...new Set((user.identities || []).map((i) => i.provider))]; if (!providers.length) providers.push(user.app_metadata?.provider || 'email');
  providers.forEach((p) => $('badges').append(el('span', { class: 'pill', text: ({ google: '🟢 Google', email: '✉️ Email', phone: '📱 Phone' })[p] || p })));
  const kv = $('kv');
  [['Name', name], ['Email', user.email || '—'], ['Phone', user.phone ? '+' + user.phone : '—'], ['Member since', new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })], ['Last sign-in', user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—'], ['User ID', user.id.slice(0, 8) + '…']]
    .forEach(([k, v]) => kv.append(el('span', { text: k }), el('div', { text: v })));

  /* tabs */
  const TABS = ['profile', 'numbers', 'share', 'help', 'settings'];
  let timer = null;
  function tab(p) {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    TABS.forEach((x) => $('p-' + x).classList.toggle('hide', x !== p));
    if (history.replaceState) history.replaceState(null, '', '#' + p);
    clearInterval(timer); timer = null;
    if (p === 'numbers') timer = setInterval(() => { if (!document.querySelector('.modal')) load(); }, 15000);
    if (p === 'share') drawCard();
    if (p === 'help') loadTickets();
  }
  document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.p)));

  /* small modal helper */
  function modal(title, ...content) {
    const close = () => { back.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const box = el('div', { class: 'box' }, el('button', { class: 'x', 'aria-label': 'Close', text: '×', onclick: close }), el('h3', { text: title }), ...content);
    const back = el('div', { class: 'modal', onclick: (e) => { if (e.target === back) close(); } }, box);
    document.addEventListener('keydown', esc); document.body.append(back);
    return { close, box };
  }

  /* ---------- numbers ---------- */
  const label = { connected: 'Connected', code: 'Waiting for your code', pairing: 'Starting…', offline: 'Not connected' };
  const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  async function load() {
    const d = await api('my'); const list = $('list'); list.textContent = '';
    const s = d.sessions || []; const max = d.max || 10;
    $('sUsed').textContent = s.length; $('sMax').textContent = max; $('sOn').textContent = s.filter((x) => x.state === 'connected').length;
    if (!d.ok) return list.append(el('div', { class: 'hint', text: d.msg || 'Could not load your numbers.' }));
    if (!s.length) list.append(el('div', { class: 'hint', text: 'No numbers linked yet.' }));
    s.forEach((x) => {
      const on = x.state === 'connected';
      const fresh = on && x.pairedAt && Date.now() - x.pairedAt < 6 * 60000;
      const acts = el('div', { class: 'acts' });
      if (on) acts.append(el('button', { class: 'btn sm', text: '⚙️ Control', onclick: () => openControl(x) }), el('button', { class: 'btn ghost sm', text: '📝 Status', onclick: () => openStatus(x) }));
      if (x.state === 'connected' || x.state === 'offline') acts.append(el('button', { class: 'btn ghost sm', text: '🔄 Reconnect', onclick: async (e) => { e.target.disabled = true; const r = await api('reconnect', { method: 'POST', body: { id: x.id } }); toast(r.ok ? (r.msg || 'Reconnecting…') : (r.msg || 'Failed'), r.ok ? '' : 'err'); setTimeout(load, 8000); } }));
      acts.append(el('button', { class: 'btn bad sm', text: 'Remove', onclick: async () => { if (!confirm('Remove this number from the bot?')) return; const r = await api('unlink', { method: 'POST', body: { id: x.id } }); toast(r.ok ? 'Removed' : (r.msg || 'Failed'), r.ok ? '' : 'err'); load(); } }));
      list.append(el('div', { class: 'sess' }, el('div', { class: 'ic', text: '📱' }),
        el('div', { class: 'tx' }, el('b', { text: x.phone || '—' }),
          el('div', { class: 'st ' + x.state }, el('span', { class: 'dot ' + (on ? 'on' : x.state === 'offline' ? 'off' : '') }), label[x.state] || x.state, x.pairedAt ? ` · linked ${ago(x.pairedAt)}` : '', on && x.commands ? ` · ${x.commands} commands run` : '')),
        fresh ? el('div', { class: 'sync', text: '⏳ Just linked. It can take up to 5 minutes to sync. If it is quiet, wait, then send .menu (or press Reconnect).' }) : '', acts));
    });
  }

  /* control panel for one number */
  const TOGGLES = [
    ['autoread', '👁 Auto-read messages', 'Marks every message as read'],
    ['autotyping', '⌨️ Show “typing…”', 'Looks like the bot is typing before it replies'],
    ['autorecording', '🎙 Show “recording…”', 'In private chats'],
    ['autoreact', '😀 Auto-react', 'Reacts to messages with emojis'],
    ['autoviewstatus', '📺 Auto-view statuses', 'Views everyone’s status for you'],
    ['autolikestatus', '❤️ Auto-like statuses', 'Reacts to statuses with your emoji'],
    ['alwaysonline', '🟢 Always online', 'Shows you as online all the time'],
    ['antidelete', '🗑 Anti-delete', 'Sends you messages people delete'],
    ['antiviewonce', '👁‍🗨 Keep view-once', 'Copies view-once photos and videos to your chat'],
    ['anticall', '📵 Reject calls', 'Declines incoming calls']
  ];
  async function openControl(x) {
    const d = await api('settings?id=' + encodeURIComponent(x.id));
    if (!d.ok) return toast(d.msg || 'Could not load the settings', 'err');
    const S = d.settings; const id = x.id;
    const save = async (patch, quiet) => { const r = await api('settings', { method: 'POST', body: { id, patch } }); if (r.ok) { if (!quiet) toast('Saved ✓'); Object.assign(S, r.settings); } else toast(r.msg || 'Could not save', 'err'); return r.ok; };
    const body = [el('div', { class: 'hint', text: `${d.phone} · changes apply right away` })];
    TOGGLES.forEach(([k, t, small]) => {
      const cb = el('input', { type: 'checkbox' }); cb.checked = !!S[k];
      cb.onchange = async () => { const ok = await save({ [k]: cb.checked }); if (!ok) cb.checked = !cb.checked; };
      body.push(el('div', { class: 'toggle' }, el('div', {}, document.createTextNode(t), el('small', { text: small })), el('label', { class: 'switch' }, cb, el('s'))));
    });
    const field = (lab, input, btnText, onSave) => { const b = el('button', { class: 'btn ghost sm', text: btnText, onclick: onSave }); return [el('div', { class: 'sub', text: lab }), input, b]; };
    const prefix = el('input', { class: 'fld', maxlength: '3', value: S.prefix || '.' });
    const emoji = el('input', { class: 'fld', maxlength: '8', value: S.statusEmoji || '❤️' });
    const bio = el('input', { class: 'fld', maxlength: '120', value: S.autobioText || '' });
    const reply = el('textarea', { class: 'fld', maxlength: '300' }); reply.value = (S.autoreply && S.autoreply.text) || '';
    const replyOn = el('input', { type: 'checkbox' }); replyOn.checked = !!(S.autoreply && S.autoreply.on);
    replyOn.onchange = async () => { const ok = await save({ autoreply: { on: replyOn.checked } }); if (!ok) replyOn.checked = !replyOn.checked; };
    const mode = el('select', { class: 'fld' }, el('option', { value: 'reject', text: 'Reject the call' }), el('option', { value: 'block', text: 'Reject and block the caller' })); mode.value = S.anticallMode || 'reject';
    body.push(...field('Command prefix', prefix, 'Save prefix', () => save({ prefix: prefix.value })));
    body.push(...field('Status emoji (auto-like)', emoji, 'Save emoji', () => save({ statusEmoji: emoji.value })));
    body.push(...field('Calls', mode, 'Save', () => save({ anticallMode: mode.value })));
    body.push(...field('Auto-bio text  ({bot} {uptime} {time} {date})', bio, 'Save text', () => save({ autobioText: bio.value })));
    body.push(el('div', { class: 'sub', text: 'Auto-reply' }), el('div', { class: 'toggle' }, el('div', { text: '💬 Reply when you are away' }), el('label', { class: 'switch' }, replyOn, el('s'))), reply, el('button', { class: 'btn ghost sm', text: 'Save message', onclick: () => save({ autoreply: { text: reply.value } }) }));
    modal(`⚙️ Control · ${d.phone}`, ...body);
  }

  /* post a status */
  function openStatus(x) {
    let imgData = '';
    const text = el('textarea', { class: 'fld', maxlength: '700', placeholder: 'Write something for your status…' });
    const file = el('input', { type: 'file', accept: 'image/*', class: 'fld' });
    const prev = el('img', { alt: '', style: 'max-width:100%;border-radius:12px;margin-top:10px;display:none' });
    file.onchange = async () => {
      const f = file.files && file.files[0]; imgData = ''; prev.style.display = 'none'; if (!f) return;
      try {
        const url = URL.createObjectURL(f); const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
        const k = Math.min(1, 1280 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); imgData = c.toDataURL('image/jpeg', 0.82); URL.revokeObjectURL(url);
        prev.src = imgData; prev.style.display = 'block';
      } catch { toast('Could not read that picture', 'err'); }
    };
    const go = el('button', { class: 'btn', text: 'Post to status' });
    const m = modal(`📝 Post a status · ${x.phone}`, el('div', { class: 'hint', text: 'Shows on this number’s WhatsApp status for you and the people in your groups.' }), el('div', { class: 'sub', text: 'Text' }), text, el('div', { class: 'sub', text: 'Picture (optional)' }), file, prev, go);
    go.onclick = async () => {
      if (!text.value.trim() && !imgData) return toast('Type something or choose a picture', 'err');
      go.disabled = true; go.textContent = 'Posting…';
      const r = await api('post-status', { method: 'POST', body: { id: x.id, text: text.value, image: imgData } });
      toast(r.ok ? (r.msg || 'Posted ✓') : (r.msg || 'Could not post'), r.ok ? '' : 'err');
      if (r.ok) m.close(); else { go.disabled = false; go.textContent = 'Post to status'; }
    };
  }
  load();

  /* ---------- news ---------- */
  (async () => {
    try {
      const { data, error } = await sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(4);
      if (error || !data || !data.length) return;
      $('newsCard').classList.remove('hide');
      data.forEach((n) => $('news').append(el('div', { class: 'news' + (n.pinned ? ' pin' : '') }, el('b', { text: (n.pinned ? '📌 ' : '') + n.title }), el('div', { text: n.body }), el('small', { text: new Date(n.created_at).toLocaleDateString() }))));
    } catch {}
  })();

  /* ---------- invite + share card ---------- */
  try {
    const rf = localStorage.getItem('pk_ref');
    if (rf && !profile.referred_by) { const { data } = await sb.rpc('claim_referral', { code: rf }); if (data !== null) localStorage.removeItem('pk_ref'); }
  } catch {}
  const refCode = profile.ref_code || '';
  const link = location.origin + (refCode ? '/?ref=' + refCode : '/');
  $('refLink').value = refCode ? link : location.origin;
  if (!refCode) $('refHint').textContent = 'Share the website link with your friends. (Invite counting turns on after the new SQL is run.)';
  (async () => { try { const { data } = await sb.rpc('referral_count'); if (typeof data === 'number') $('refN').textContent = data; } catch {} })();
  $('refCopy').onclick = async () => { try { await navigator.clipboard.writeText($('refLink').value); $('refCopy').textContent = 'Copied ✓'; } catch { $('refLink').select(); toast('Press copy on your keyboard', 'err'); } setTimeout(() => ($('refCopy').textContent = 'Copy'), 1500); };
  $('refShare').onclick = async () => { const t = 'Link your WhatsApp to Nexora Nemesis 404 MD, free:'; if (navigator.share) { try { await navigator.share({ title: 'Prime Kent Dev Hub', text: t, url: link }); } catch {} } else $('refCopy').click(); };
  const showInstall = () => { if (Hub.canInstall()) $('instCard').classList.remove('hide'); };
  document.addEventListener('pk-installable', showInstall); showInstall();
  $('instBtn').onclick = async () => { await Hub.install(); $('instCard').classList.add('hide'); };

  let qrLoaded = null;
  const loadQr = () => qrLoaded || (qrLoaded = new Promise((ok) => { if (window.qrcode) return ok(true); const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = () => ok(!!window.qrcode); s.onerror = () => ok(false); document.head.append(s); }));
  const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  let drawn = false;
  async function drawCard() {
    if (drawn) return; drawn = true;
    const cv = $('card'), c = cv.getContext('2d'), W = 1080, H = 1350;
    const [hero, logo, hasQr] = await Promise.all([loadImg('/img/hero.jpg'), loadImg('/img/logo.jpg'), loadQr()]);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12062b'); g.addColorStop(1, '#2a0630'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (hero) { const k = Math.max(W / hero.width, H / hero.height); c.globalAlpha = 0.35; c.drawImage(hero, (W - hero.width * k) / 2, (H - hero.height * k) / 2, hero.width * k, hero.height * k); c.globalAlpha = 1; }
    const v = c.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(7,3,15,.55)'); v.addColorStop(1, 'rgba(7,3,15,.92)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(190,140,255,.55)'; c.lineWidth = 4; rr(c, 30, 30, W - 60, H - 60, 44); c.stroke();
    if (logo) { c.save(); c.beginPath(); c.arc(W / 2, 200, 110, 0, Math.PI * 2); c.clip(); c.drawImage(logo, W / 2 - 110, 90, 220, 220); c.restore(); c.strokeStyle = '#c9a0ff'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, 200, 112, 0, Math.PI * 2); c.stroke(); }
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '800 66px Orbitron, system-ui, sans-serif'; c.fillText('NEXORA NEMESIS', W / 2, 400); c.fillText('404 MD', W / 2, 475);
    c.fillStyle = '#c9a0ff'; c.font = '700 40px system-ui, sans-serif'; c.fillText('Link your WhatsApp in seconds', W / 2, 550);
    c.fillStyle = '#f4eeff'; c.font = '500 38px system-ui, sans-serif';
    ['⚡ 440+ commands', '📥 YouTube · TikTok · IG downloads', '🛡 Group tools & auto features', '🔗 Up to 10 numbers · Free'].forEach((t, i) => c.fillText(t, W / 2, 640 + i * 62));
    const qs = 300, qx = W / 2 - qs / 2, qy = 905;
    c.fillStyle = '#fff'; rr(c, qx - 22, qy - 22, qs + 44, qs + 44, 28); c.fill();
    if (hasQr) { try { const q = window.qrcode(0, 'M'); q.addData($('refLink').value); q.make(); const n = q.getModuleCount(), m = qs / n; c.fillStyle = '#12062b'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(qx + k * m, qy + r * m, Math.ceil(m), Math.ceil(m)); } catch { c.fillStyle = '#12062b'; c.font = '700 34px system-ui'; c.fillText('Scan or open the link', W / 2, qy + 160); } }
    else { c.fillStyle = '#12062b'; c.font = '700 36px system-ui'; c.fillText('Open the link below', W / 2, qy + 160); }
    c.fillStyle = '#fff'; c.font = '700 40px system-ui, sans-serif'; c.fillText($('refLink').value.replace(/^https?:\/\//, ''), W / 2, 1290);
  }
  const blobOf = () => new Promise((ok) => $('card').toBlob(ok, 'image/png'));
  $('cardDl').onclick = async () => { await drawCard(); const b = await blobOf(); const a = el('a', { href: URL.createObjectURL(b), download: 'nexora-nemesis-share.png' }); document.body.append(a); a.click(); a.remove(); };
  $('cardSh').onclick = async () => {
    await drawCard(); const b = await blobOf(); const f = new File([b], 'nexora-nemesis.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], text: link }); } catch {} } else $('cardDl').click();
  };

  /* ---------- help ---------- */
  async function loadTickets() {
    try {
      const { data, error } = await sb.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(8);
      const box = $('tix'); box.textContent = '';
      if (error) return box.append(el('div', { class: 'hint', text: 'Help requests turn on after the new SQL is run.' }));
      if (!data.length) return box.append(el('div', { class: 'hint', text: 'Nothing yet.' }));
      data.forEach((t) => box.append(el('div', { class: 'news' }, el('b', { text: t.subject }), el('small', { text: `${t.status === 'closed' ? '✅ Closed' : '🕓 Open'} · ${new Date(t.created_at).toLocaleDateString()}` }))));
    } catch {}
  }
  $('hSend').onclick = async () => {
    const subject = $('hs').value.trim(), message = $('hm').value.trim();
    if (subject.length < 3 || message.length < 10) return toast('Add a subject and a few details', 'err');
    $('hSend').disabled = true;
    const { error } = await sb.from('support_tickets').insert({ user_id: user.id, email: user.email || user.phone || '', subject: subject.slice(0, 80), message: message.slice(0, 800) });
    $('hSend').disabled = false;
    if (error) return toast('Could not send. Try again later.', 'err');
    $('hs').value = ''; $('hm').value = ''; toast('Sent ✓ We will get back to you'); loadTickets();
  };

  /* ---------- settings ---------- */
  Hub.COUNTRIES.forEach(([c, l]) => $('cc').append(el('option', { value: c, text: l })));
  $('dn').value = name; $('cc').value = settings().cc || '254';
  const accent = settings().accent || document.documentElement.getAttribute('data-accent') || 'purple';
  const markAccent = (a) => document.querySelectorAll('#sw button').forEach((b) => b.classList.toggle('on', b.dataset.a === a));
  markAccent(accent); $('calm').checked = !!settings().calm;
  async function persist(patch) {
    profile = { ...profile, ...patch.top, settings: { ...settings(), ...(patch.settings || {}) } };
    try { await Hub.saveProfile(user, { display_name: profile.display_name || name, settings: profile.settings }); return true; } catch (e) { toast('Could not save: ' + (e.message || e), 'err'); return false; }
  }
  $('saveP').onclick = async () => {
    const dn = $('dn').value.trim().slice(0, 40); if (!dn) return toast('Enter a display name', 'err');
    if (await persist({ top: { display_name: dn }, settings: { cc: $('cc').value } })) { try { await sb.auth.updateUser({ data: { full_name: dn } }); } catch {} toast('Saved ✓'); $('hName').textContent = dn; }
  };
  document.querySelectorAll('#sw button').forEach((b) => (b.onclick = async () => {
    const a = b.dataset.a; markAccent(a); document.documentElement.setAttribute('data-accent', a); try { localStorage.setItem('pk_accent', a); } catch {}
    if (await persist({ settings: { accent: a } })) toast('Accent saved ✓');
  }));
  $('calm').onchange = async () => { const on = $('calm').checked; document.documentElement.setAttribute('data-calm', on ? 'on' : 'off'); try { localStorage.setItem('pk_calm', on ? '1' : '0'); } catch {} await persist({ settings: { calm: on } }); };
  if (!providers.includes('email')) ['np', 'chgPw'].forEach((i) => $(i).classList.add('hide')), document.querySelector('label[for=np]').classList.add('hide');
  $('chgPw').onclick = async () => { const p = $('np').value; if (p.length < 8) return toast('Use at least 8 characters', 'err'); const { error } = await sb.auth.updateUser({ password: p }); toast(error ? error.message : 'Password changed ✓', error ? 'err' : ''); if (!error) $('np').value = ''; };
  $('outAll').onclick = async () => { await sb.auth.signOut({ scope: 'global' }); location.href = '/'; };
  $('out').onclick = Hub.signOut;
  $('unlinkAll').onclick = async () => { if (!confirm('Unlink ALL your WhatsApp numbers from the bot?')) return; const r = await api('unlink', { method: 'POST', body: { id: 'all' } }); toast(r.ok ? 'All numbers unlinked' : (r.msg || 'Failed'), r.ok ? '' : 'err'); load(); };
  $('delAcc').onclick = async () => {
    if (prompt('This permanently deletes your account and unlinks every number.\nType DELETE to confirm.') !== 'DELETE') return;
    const r = await api('delete-account', { method: 'POST', body: {} });
    if (r.ok) { try { await sb.auth.signOut(); } catch {} location.href = '/?deleted=1'; } else toast(r.msg || 'Could not delete the account', 'err');
  };

  tab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'profile');
})();
