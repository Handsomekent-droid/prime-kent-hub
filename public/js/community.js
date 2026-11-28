(async function () {
  const { $, el, toast, sb } = Hub;
  Hub.chrome();
  const session = await Hub.requireAuth(); if (!session) return;
  const user = session.user;
  const profile = await Hub.loadProfile(user);
  await Hub.checkAdmin();
  Hub.applyPrefs(profile.settings); Hub.nav('community', session, profile); Hub.footer();
  const TABS = ['wall', 'polls', 'board']; let timer = null;
  function tab(p) {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
    TABS.forEach((x) => $('p-' + x).classList.toggle('hide', x !== p));
    clearInterval(timer); timer = null;
    if (p === 'wall') { loadPin(); loadFeed(true); timer = setInterval(() => { if (!document.hidden) loadFeed(false); }, 6000); }
    if (p === 'polls') loadPolls();
    if (p === 'board') loadBoard();
    try { history.replaceState(null, '', '#' + p); } catch {}
  }
  document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.p)));
  const ago = (t) => { const s = Math.max(0, (Date.now() - new Date(t)) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' d'; };

  /* wall: a group chat */
  const COLORS = ['#ff8a80', '#ffd180', '#b9f6ca', '#80d8ff', '#ea80fc', '#a7ffeb', '#ffff8d', '#ff9e80', '#b388ff', '#84ffff'];
  const colorOf = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dayLabel = (t) => { const d = new Date(t), n = new Date(), y = new Date(Date.now() - 864e5); const same = (a, b) => a.toDateString() === b.toDateString(); return same(d, n) ? 'Today' : same(d, y) ? 'Yesterday' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); };
  const feed = $('feed'); let sig = '', lastCount = 0;
  const nearBottom = () => feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;
  const toBottom = (smooth) => { feed.style.scrollBehavior = smooth ? 'smooth' : 'auto'; feed.scrollTop = feed.scrollHeight; };
  feed.addEventListener('scroll', () => { if (nearBottom()) $('cDown').classList.add('hide'); });
  $('cDown').onclick = () => { toBottom(true); $('cDown').classList.add('hide'); };
  const grow = () => { const t = $('pBody'); t.style.height = 'auto'; t.style.height = Math.min(110, t.scrollHeight) + 'px'; };
  $('pBody').oninput = grow;
  $('pBody').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); send(); } };
  let openBubble = null;

  const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
  async function loadFeed(force) {
    const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(60);
    if (error) { feed.textContent = ''; return feed.append(el('div', { class: 'cempty', text: 'The chat turns on after the new SQL is run.' })); }
    const rows = (data || []).slice().reverse();
    const s2 = rows.map((p) => p.id + ':' + p.likes).join(',');
    if (!force && s2 === sig) return; sig = s2;
    const ids = rows.map((p) => p.id);
    let counts = {}, mine = {};
    try {
      const r = await sb.from('post_reactions').select('post_id,user_id,emoji').in('post_id', ids);
      (r.data || []).forEach((x) => {
        (counts[x.post_id] = counts[x.post_id] || {})[x.emoji] = (counts[x.post_id]?.[x.emoji] || 0) + 1;
        if (x.user_id === user.id) mine[x.post_id] = x.emoji;
      });
    } catch {}
    const stick = nearBottom() || !feed.childElementCount, grew = rows.length > lastCount && lastCount > 0; lastCount = rows.length;
    feed.textContent = ''; openBubble = null;
    if (!rows.length) return feed.append(el('div', { class: 'cempty', text: 'No messages yet. Say hi 👋' }));
    let prev = null;
    rows.forEach((p) => {
      const d = new Date(p.created_at).toDateString();
      if (!prev || new Date(prev.created_at).toDateString() !== d) feed.append(el('div', { class: 'cday', text: dayLabel(p.created_at) }));
      const meMsg = p.user_id === user.id;
      const same = prev && prev.user_id === p.user_id && new Date(prev.created_at).toDateString() === d && new Date(p.created_at) - new Date(prev.created_at) < 5 * 60000;
      prev = p;
      const av = el('div', { class: 'cav' + (same || meMsg ? ' sp' : '') });
      if (!same && !meMsg) { if (p.avatar && /^https:\/\//.test(p.avatar)) av.append(el('img', { src: p.avatar, alt: '', referrerpolicy: 'no-referrer' })); else av.textContent = (p.author || '?')[0].toUpperCase(); }
      const bub = el('div', { class: 'cb' });
      if (!same && !meMsg) bub.append(el('div', { class: 'nm', style: 'color:' + colorOf(p.user_id), text: p.author }));
      bub.append(el('div', { class: 'tx', text: p.body }), el('div', { class: 'tm' }, el('span', { text: hm(p.created_at) })));
      const pc = counts[p.id] || {};
      const pairs = Object.entries(pc).sort((a, b) => b[1] - a[1]);
      if (pairs.length) bub.append(el('div', { class: 'rxrow' }, ...pairs.map(([e, n]) => el('span', { text: e + ' ' + n }))));
      const doReact = async (e) => { const { data: r, error: err } = await sb.rpc('react', { pid: p.id, e }); if (err || !r) return toast('Could not react', 'err'); loadFeed(true); };
      const acts = el('div', { class: 'cact' }, ...EMOJIS.map((e) => el('button', { class: 'react' + (mine[p.id] === e ? ' on' : ''), text: e, onclick: (ev) => { ev.stopPropagation(); doReact(e); } })));
      if (meMsg) acts.append(el('button', { text: '🗑 Delete', onclick: async (e) => { e.stopPropagation(); if (!confirm('Delete your message?')) return; await sb.from('posts').delete().eq('id', p.id); loadFeed(true); } }));
      bub.append(acts);
      bub.onclick = () => { if (openBubble && openBubble !== bub) openBubble.classList.remove('open'); bub.classList.toggle('open'); openBubble = bub.classList.contains('open') ? bub : null; };
      bub.ondblclick = (e) => { e.preventDefault(); doReact('❤️'); };
      feed.append(el('div', { class: 'crow' + (meMsg ? ' me' : '') + (same ? '' : ' gap') + (pairs.length ? ' hasrx' : '') }, av, bub));
    });
    if (stick) toBottom(false); else if (grew) $('cDown').classList.remove('hide');
  }
  async function loadPin() {
    try { const { data } = await sb.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(1); const n = data && data[0]; if (n && n.pinned) { $('cPin').textContent = '📌 ' + n.title + ': ' + n.body; $('cPin').classList.remove('hide'); } } catch {}
  }
  let sending = false;
  async function send() {
    const body = $('pBody').value.trim(); if (!body || sending) return;
    sending = true; $('pGo').disabled = true;
    const pic = user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture);
    const { error } = await sb.from('posts').insert({ user_id: user.id, author: (profile.display_name || Hub.displayName(user)).slice(0, 40), avatar: pic && /^https:\/\//.test(pic) ? pic : null, body });
    sending = false; $('pGo').disabled = false;
    if (error) return toast(/Slow down/i.test(error.message || '') ? 'Slow down. Wait a few seconds between messages.' : 'Could not send. Try again.', 'err');
    $('pBody').value = ''; grow(); await loadFeed(true); toast('Sent ✓'); toBottom(true);
  }
  $('pGo').onclick = send;

  /* polls */
  async function loadPolls() {
    const box = $('pollBox'); box.textContent = '';
    const { data, error } = await sb.from('polls').select('*').order('created_at', { ascending: false }).limit(10);
    if (error) return box.append(el('div', { class: 'card' }, el('div', { class: 'hint', text: 'Polls turn on after the new SQL is run.' })));
    if (!data.length) return box.append(el('div', { class: 'card' }, el('div', { class: 'hint', text: 'No polls right now. Check back soon.' })));
    const votes = {}; try { const r = await sb.from('poll_votes').select('poll_id,choice').in('poll_id', data.map((p) => p.id)); (r.data || []).forEach((v) => (votes[v.poll_id] = v.choice)); } catch {}
    for (const p of data) {
      const card = el('div', { class: 'card' }, el('h2', { text: p.question })); box.append(card);
      const draw = async () => {
        card.querySelectorAll('.opt,.bar,.hint').forEach((n) => n.remove());
        const { data: res } = await sb.rpc('poll_results', { pid: p.id }); const r = res || {}; const total = Object.values(r).reduce((a, b) => a + b, 0);
        (p.options || []).forEach((o, i) => { const n = r[i] || 0, pct = total ? Math.round((n / total) * 100) : 0; card.append(el('div', { class: 'bar' }, el('i', { style: `width:${pct}%` }), el('span', {}, document.createTextNode((votes[p.id] === i ? '✅ ' : '') + o), el('b', { text: `${pct}%` })))); });
        card.append(el('div', { class: 'hint', text: `${total} vote${total === 1 ? '' : 's'}` }));
      };
      if (votes[p.id] !== undefined) await draw();
      else (p.options || []).forEach((o, i) => card.append(el('button', { class: 'opt', text: o, onclick: async () => { const { error: e } = await sb.from('poll_votes').insert({ poll_id: p.id, user_id: user.id, choice: i }); if (e) return toast('Could not save your vote', 'err'); votes[p.id] = i; toast('Vote counted ✓'); draw(); } })));
    }
  }

  /* leaderboard */
  async function loadBoard() {
    const box = $('lb'); box.textContent = '';
    const { data, error } = await sb.rpc('top_inviters');
    if (error) return box.append(el('div', { class: 'hint', text: 'The board turns on after the new SQL is run.' }));
    if (!data || !data.length) return box.append(el('div', { class: 'hint', text: 'Nobody yet. Share your invite link and be first!' }));
    data.forEach((r, i) => box.append(el('div', { class: 'lb' }, el('div', { class: 'rk', text: ['🥇', '🥈', '🥉'][i] || String(i + 1) }), el('b', { text: r.name }), el('span', { text: r.n + ' friend' + (r.n === 1 ? '' : 's') }))));
  }
  tab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'wall');
})();
