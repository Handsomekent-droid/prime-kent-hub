(async function () {
  const { $, el, api, toast } = Hub;
  Hub.chrome();
  const session = await Hub.requireAuth(); if (!session) return;
  const w = await api('admin?action=whoami');
  if (!w.admin) { try { sessionStorage.setItem('pk_admin', '0'); } catch {} return location.replace('/account'); }
  try { sessionStorage.setItem('pk_admin', '1'); } catch {}
  Hub.nav('admin', session, null); Hub.footer();

  const TABS = ['ov', 'us', 'nu', 'an', 'tk']; const loaded = {};
  const fmt = (t) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' }) : '—');
  const up = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return (d ? d + 'd ' : '') + h + 'h ' + m + 'm'; };
  function tab(p) {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    TABS.forEach((x) => $('p-' + x).classList.toggle('hide', x !== p));
    ({ ov: overview, us: users, nu: numbers, an: news, tk: tickets })[p]();
  }
  document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.p)));

  async function overview() {
    const d = await api('admin?action=overview'); const k = $('kpis'); k.textContent = '';
    if (!d.ok) { $('ovNote').textContent = (d.bot && d.bot.msg) || d.msg || 'The bot did not answer.'; }
    const b = d.bot || {};
    [['Accounts', d.users], ['Numbers', b.sessions], ['Online', b.online], ['From website', b.web], ['From Telegram', b.telegram], ['Capacity', b.max], ['Uptime', b.uptime != null ? up(b.uptime) : '—'], ['Memory', b.memoryMb != null ? b.memoryMb + ' MB' : '—']]
      .forEach(([l, v]) => k.append(el('div', { class: 'stat' }, el('b', { text: v == null ? '—' : String(v) }), el('span', { text: l }))));
    if (d.ok) $('ovNote').textContent = `${b.name || 'Bot'} · build ${b.build}`;
  }

  let ulist = [];
  function drawUsers() {
    const q = $('uq').value.trim().toLowerCase(); const t = $('ut'); t.textContent = '';
    ulist.filter((u) => !q || (u.email + u.phone).toLowerCase().includes(q)).forEach((u) => {
      const btn = el('button', { class: 'mini' + (u.banned ? '' : ' bad'), text: u.banned ? 'Unban' : 'Ban', onclick: async () => {
        if (!confirm(u.banned ? 'Let this person sign in again?' : 'Ban this account and unlink all its numbers?')) return;
        const r = await api('admin?action=ban', { method: 'POST', body: { userId: u.id, ban: !u.banned } }); toast(r.ok ? 'Done' : (r.msg || 'Failed'), r.ok ? '' : 'err'); users();
      } });
      t.append(el('tr', {}, el('td', { text: (u.email || u.phone || u.id.slice(0, 8)) + (u.banned ? '  🚫' : '') }, el('div', { class: 'hint', text: u.provider })), el('td', { text: `${u.numbers} (${u.online} on)` }), el('td', { text: fmt(u.created) }), el('td', {}, btn)));
    });
  }
  async function users() { const d = await api('admin?action=users'); if (!d.ok) return toast(d.msg || 'Could not load', 'err'); ulist = d.users || []; drawUsers(); }
  $('uq').oninput = drawUsers;

  async function numbers() {
    const d = await api('admin?action=sessions'); const t = $('nt'); t.textContent = '';
    if (!d.ok) return toast(d.msg || 'Could not load', 'err');
    const s = d.sessions || []; $('nuSum').textContent = `${s.length} number(s) · ${s.filter((x) => x.online).length} online`;
    s.forEach((x) => t.append(el('tr', {}, el('td', { text: x.phone || '—' }), el('td', { text: x.source }), el('td', { text: x.online ? '🟢 online' : '🔴 offline' }),
      el('td', {}, el('button', { class: 'mini bad', text: 'Remove', onclick: async () => { if (!confirm('Remove this number from the bot?')) return; const r = await api('admin?action=remove-session', { method: 'POST', body: { id: x.id } }); toast(r.ok ? 'Removed' : (r.msg || 'Failed'), r.ok ? '' : 'err'); numbers(); } })))));
  }

  async function news() {
    const d = await api('admin?action=announcements'); const box = $('al'); box.textContent = '';
    if (!d.ok) return box.append(el('div', { class: 'hint', text: d.msg || 'Could not load' }));
    if (!d.items.length) box.append(el('div', { class: 'hint', text: 'Nothing published yet.' }));
    d.items.forEach((n) => box.append(el('div', { class: 'news' + (n.pinned ? ' pin' : '') }, el('b', { text: (n.pinned ? '📌 ' : '') + n.title }), el('div', { text: n.body }), el('small', { text: fmt(n.created_at) + ' ' }),
      el('button', { class: 'mini bad', text: 'Delete', onclick: async () => { if (!confirm('Delete this post?')) return; await api('admin?action=delete-announcement', { method: 'POST', body: { id: n.id } }); news(); } }))));
  }
  $('aGo').onclick = async () => {
    const r = await api('admin?action=announce', { method: 'POST', body: { title: $('at').value, body: $('ab').value, pinned: $('ap').checked } });
    if (!r.ok) return toast(r.msg || 'Could not publish', 'err');
    $('at').value = ''; $('ab').value = ''; $('ap').checked = false; toast('Published ✓'); news();
  };

  async function tickets() {
    const d = await api('admin?action=tickets'); const box = $('tl'); box.textContent = '';
    if (!d.ok) return box.append(el('div', { class: 'hint', text: d.msg || 'Could not load' }));
    if (!d.items.length) box.append(el('div', { class: 'hint', text: 'No help requests.' }));
    d.items.forEach((t) => box.append(el('div', { class: 'news' }, el('b', { text: t.subject }), el('div', { text: t.message }), el('small', { text: `${t.email || ''} · ${fmt(t.created_at)} · ${t.status} ` }),
      el('button', { class: 'mini', text: t.status === 'closed' ? 'Reopen' : 'Close', onclick: async () => { await api('admin?action=ticket-status', { method: 'POST', body: { id: t.id, status: t.status === 'closed' ? 'open' : 'closed' } }); tickets(); } }))));
  }
  tab('ov');
})();
