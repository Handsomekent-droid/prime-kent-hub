(async function () {
  const { $, el, api, toast, sb } = Hub;
  Hub.chrome();
  const session = await Hub.requireAuth(); if (!session) return;
  const user = session.user;
  let profile = await Hub.loadProfile(user);
  const settings = () => (profile.settings = profile.settings || {});
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
  function tab(p) {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    ['profile', 'numbers', 'settings'].forEach((x) => $('p-' + x).classList.toggle('hide', x !== p));
    if (history.replaceState) history.replaceState(null, '', '#' + p);
  }
  document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.p)));
  tab(['profile', 'numbers', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'profile');

  /* numbers */
  const label = { connected: '🟢 Connected', code: '⏳ Waiting for your code', pairing: '⏳ Starting…', offline: '🔴 Not connected' };
  async function load() {
    const d = await api('my'); const list = $('list'); list.textContent = '';
    const s = d.sessions || []; const max = d.max || 10;
    $('sUsed').textContent = s.length; $('sMax').textContent = max; $('sOn').textContent = s.filter((x) => x.state === 'connected').length;
    if (!d.ok) return list.append(el('div', { class: 'hint', text: d.msg || 'Could not load your numbers.' }));
    if (!s.length) list.append(el('div', { class: 'hint', text: 'No numbers linked yet.' }));
    s.forEach((x) => list.append(el('div', { class: 'sess' }, el('div', { class: 'ic', text: '📱' }), el('div', { class: 'tx' }, el('b', { text: x.phone || '—' }), el('div', { class: 'st ' + x.state, text: label[x.state] || x.state })),
      el('button', { class: 'btn bad sm', text: 'Remove', onclick: async () => { if (!confirm('Remove this number from the bot?')) return; const r = await api('unlink', { method: 'POST', body: { id: x.id } }); toast(r.ok ? 'Removed' : (r.msg || 'Failed'), r.ok ? '' : 'err'); load(); } }))));
  }
  load();

  /* settings */
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
})();
