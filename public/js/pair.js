(async function () {
  const { $, el, api, toast, cfg } = Hub;
  Hub.chrome();
  const session = await Hub.requireAuth(); if (!session) return;
  const profile = await Hub.loadProfile(session.user);
  await Hub.checkAdmin(); Hub.applyPrefs(profile.settings); Hub.nav('pair', session, profile); Hub.footer();
  $('chan').href = cfg.CHANNEL || '#'; $('tg').href = cfg.TELEGRAM || '#';

  Hub.COUNTRIES.forEach(([c, l]) => { const o = el('option', { value: c, text: l }); $('cc').append(o); });
  $('cc').value = (profile.settings && profile.settings.cc) || '254';

  let cur = null, poll = null, tries = 0;
  const show = (id, on) => $(id).classList.toggle('hide', !on);
  const say = (t, type) => { const m = $('msg'); m.textContent = t || ''; m.className = 'msg ' + (type || 'err') + (t ? '' : ' hide'); };
  function step(n, running) { document.querySelectorAll('.step').forEach((s) => { const k = +s.dataset.s; s.classList.toggle('on', k <= n); s.classList.toggle('run', running && k === n); }); }
  function stop() { clearInterval(poll); poll = null; }
  function reset() { stop(); cur = null; show('codeBox', false); show('doneBox', false); show('form', true); $('go').disabled = false; $('go').textContent = 'Get my pairing code'; step(1); }

  async function check() {
    if (!cur) return; tries++;
    const d = await api('status?id=' + encodeURIComponent(cur));
    if (d.ok) {
      if (d.state === 'code' && d.code) { $('code').textContent = d.code; show('form', false); show('codeBox', true); step(3, true); }
      if (d.state === 'connected') { stop(); show('codeBox', false); show('form', false); show('doneBox', true); step(4); toast('Connected! 🎉'); load(); }
      if (d.state === 'failed') { reset(); say(d.msg || 'Pairing failed. Try again.'); }
    }
    if (tries > 110 && cur) { reset(); say('The code expired. Tap the button to get a new one.'); }
  }

  $('form').onsubmit = async (e) => {
    e.preventDefault(); say(''); show('doneBox', false);
    let digits = $('ph').value.replace(/\D/g, '').replace(/^0+/, '');
    const cc = $('cc').value; if (digits.startsWith(cc) && digits.length > 11) digits = digits.slice(cc.length); // typed the full number
    if (digits.length < 6) return say('Enter your WhatsApp number.');
    $('go').disabled = true; $('go').textContent = 'Requesting code…'; step(2, true);
    const d = await api('pair', { method: 'POST', body: { phone: cc + digits } }).catch(() => ({ ok: false, msg: 'Could not reach the server.' }));
    if (!d.ok) { reset(); return say(d.msg || 'Something went wrong.'); }
    if (d.state === 'connected') { reset(); show('form', false); show('doneBox', true); step(4); say(d.msg || '', 'info'); return load(); }
    cur = d.id; tries = 0; stop(); poll = setInterval(check, 2000); check(); load();
  };
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText($('code').textContent.replace(/-/g, '')); toast('Code copied ✓'); } catch { toast('Select the code and copy it', 'err'); } };
  $('cancel').onclick = async () => { const id = cur; reset(); if (id) { await api('unlink', { method: 'POST', body: { id } }); load(); } };
  $('another').onclick = reset;

  const label = { connected: '🟢 Connected', code: '⏳ Waiting for your code', pairing: '⏳ Starting…', offline: '🔴 Not connected' };
  async function load() {
    const d = await api('my');
    const list = $('list'); list.textContent = '';
    const s = (d.sessions || []); const max = d.max || 10;
    $('sUsed').textContent = s.length; $('sMax').textContent = max; $('sOn').textContent = s.filter((x) => x.state === 'connected').length; $('meter').style.width = Math.min(100, (s.length / max) * 100) + '%';
    if (!d.ok) { list.append(el('div', { class: 'hint', text: d.msg || 'Could not load your numbers.' })); return; }
    if (!s.length) list.append(el('div', { class: 'hint', text: 'No numbers yet — link your first one above.' }));
    s.forEach((x) => list.append(el('div', { class: 'sess' },
      el('div', { class: 'ic', text: '📱' }),
      el('div', { class: 'tx' }, el('b', { text: x.phone || '—' }), el('div', { class: 'st ' + x.state, text: label[x.state] || x.state })),
      el('button', { class: 'btn bad sm', text: 'Remove', onclick: async () => { if (!confirm('Remove this number from the bot?')) return; const r = await api('unlink', { method: 'POST', body: { id: x.id } }); toast(r.ok ? 'Removed' : (r.msg || 'Failed'), r.ok ? '' : 'err'); load(); } }))));
  }
  load(); setInterval(() => { if (!document.hidden) load(); }, 15000);
})();
