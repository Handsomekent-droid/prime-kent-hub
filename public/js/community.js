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
    if (p === 'wall') { loadFeed(); timer = setInterval(() => { if (!document.hidden && !$('pBody').value) loadFeed(); }, 30000); }
    if (p === 'polls') loadPolls();
    if (p === 'board') loadBoard();
    try { history.replaceState(null, '', '#' + p); } catch {}
  }
  document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => tab(b.dataset.p)));
  const ago = (t) => { const s = Math.max(0, (Date.now() - new Date(t)) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' d'; };

  /* wall */
  $('pBody').oninput = () => ($('pCnt').textContent = $('pBody').value.length + ' / 280');
  async function loadFeed() {
    const { data, error } = await sb.from('posts').select('*').order('created_at', { ascending: false }).limit(40);
    const box = $('feed'); box.textContent = '';
    if (error) return box.append(el('div', { class: 'hint', text: 'The wall turns on after the new SQL is run.' }));
    if (!data.length) return box.append(el('div', { class: 'hint', style: 'text-align:center;margin-top:16px', text: 'No posts yet. Be the first!' }));
    let mine = new Set();
    try { const r = await sb.from('post_likes').select('post_id').in('post_id', data.map((p) => p.id)); mine = new Set((r.data || []).map((x) => x.post_id)); } catch {}
    data.forEach((p) => {
      const av = el('div', { class: 'pa' }); if (p.avatar && /^https:\/\//.test(p.avatar)) av.append(el('img', { src: p.avatar, alt: '', referrerpolicy: 'no-referrer' })); else av.textContent = (p.author || '?')[0].toUpperCase();
      const like = el('button', { class: mine.has(p.id) ? 'on' : '', text: `${mine.has(p.id) ? '❤️' : '🤍'} ${p.likes}` });
      like.onclick = async () => { like.disabled = true; const { data: r, error: e } = await sb.rpc('toggle_like', { pid: p.id }); like.disabled = false; if (e || !r) return toast('Could not like that', 'err'); like.className = r.liked ? 'on' : ''; like.textContent = `${r.liked ? '❤️' : '🤍'} ${r.likes}`; };
      const foot = el('div', { class: 'pf' }, like);
      if (p.user_id === user.id) foot.append(el('button', { text: '🗑 Delete', onclick: async () => { if (!confirm('Delete your post?')) return; await sb.from('posts').delete().eq('id', p.id); loadFeed(); } }));
      box.append(el('div', { class: 'post' }, av, el('div', { class: 'pb' }, el('b', { text: p.author }), el('small', { text: ago(p.created_at) }), el('p', { text: p.body }), foot)));
    });
  }
  $('pGo').onclick = async () => {
    const body = $('pBody').value.trim(); if (!body) return toast('Write something first', 'err');
    $('pGo').disabled = true;
    const pic = user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture);
    const { error } = await sb.from('posts').insert({ user_id: user.id, author: (profile.display_name || Hub.displayName(user)).slice(0, 40), avatar: pic && /^https:\/\//.test(pic) ? pic : null, body });
    $('pGo').disabled = false;
    if (error) return toast(/Slow down/i.test(error.message || '') ? 'Slow down. Wait a few seconds between posts.' : 'Could not post. Try again.', 'err');
    $('pBody').value = ''; $('pCnt').textContent = '0 / 280'; toast('Posted ✓'); loadFeed();
  };

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
