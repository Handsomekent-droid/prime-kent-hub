(async function () {
  const { $, el, toast } = Hub;
  Hub.chrome();
  const session = await Hub.getSession();
  if (session) await Hub.checkAdmin();
  Hub.nav('cmds', session, null); Hub.footer();
  let data; try { data = await (await fetch('/commands.json', { cache: 'no-cache' })).json(); } catch { $('sum').textContent = 'Could not load the command list.'; return; }
  const P = data.prefix || '.';
  $('sum').textContent = `${data.total} commands in ${data.categories.length} categories · prefix “${P}” (each owner can change theirs)`;
  let cat = 'all';
  const wlabel = { everyone: '', admin: 'group admin', owner: 'owner', host: 'host' };

  const chips = $('chips');
  const mk = (key, text) => el('button', { text, onclick: () => { cat = key; paint(); } });
  function paintChips() {
    chips.textContent = '';
    const all = mk('all', 'All'); all.classList.toggle('on', cat === 'all'); chips.append(all);
    data.categories.forEach((c) => { const b = mk(c.key, `${c.icon} ${c.title.replace(/ MENU$/i, '')}`); b.classList.toggle('on', cat === c.key); chips.append(b); });
  }
  function row(c) {
    const copy = el('button', { text: 'Copy', onclick: async () => { try { await navigator.clipboard.writeText(P + c.u); copy.textContent = 'Copied ✓'; } catch { toast('Select and copy it by hand', 'err'); } setTimeout(() => (copy.textContent = 'Copy'), 1500); } });
    const code = el('code', { text: P + c.u });
    if (wlabel[c.w]) code.append(el('span', { class: 'tag', text: wlabel[c.w] }));
    return el('div', { class: 'cmd' }, el('div', { class: 'm' }, code, c.d ? el('p', { text: c.d }) : '', c.a && c.a.length ? el('div', { class: 'al', text: 'also: ' + c.a.map((a) => P + a).join('  ') }) : ''), copy);
  }
  function paint() {
    paintChips();
    const q = $('q').value.trim().toLowerCase();
    const box = $('list'); box.textContent = ''; let n = 0;
    $('tips').style.display = q || cat !== 'all' ? 'none' : '';
    data.categories.forEach((c) => {
      if (cat !== 'all' && c.key !== cat) return;
      const hits = c.commands.filter((x) => !q || x.n.includes(q) || x.u.toLowerCase().includes(q) || (x.d || '').toLowerCase().includes(q) || (x.a || []).some((a) => a.includes(q)));
      if (!hits.length) return;
      n += hits.length;
      const card = el('div', { class: 'card' }, el('h2', { text: `${c.icon} ${c.title} (${hits.length})` }));
      hits.slice(0, 120).forEach((x) => card.append(row(x)));
      box.append(card);
    });
    $('none').style.display = n ? 'none' : 'block';
  }
  $('q').oninput = paint;
  paint();
})();
