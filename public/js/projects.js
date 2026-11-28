(async function () {
  const { $, el } = Hub;
  Hub.chrome();
  const session = await Hub.getSession();
  if (session) await Hub.checkAdmin();
  Hub.nav('projects', session, null); Hub.footer();
  let data = { projects: [] };
  try { data = await (await fetch('/projects.json', { cache: 'no-cache' })).json(); } catch {}
  try { const c = await (await fetch('/commands.json')).json(); if (c.total) $('sCmd').textContent = c.total; } catch {}
  $('sProj').textContent = (data.projects || []).filter((p) => p.status !== 'soon').length;
  document.querySelectorAll('.stat b').forEach((n) => Hub.countUp(n));
  const box = $('list');
  (data.projects || []).forEach((p, i) => {
    const g = 'g' + ((i % 4) + 1);
    const links = el('div', { class: 'links' });
    (p.links || []).forEach((l) => {
      const href = l.href === '@channel' ? (Hub.cfg.CHANNEL || '#') : l.href;
      if (!/^(\/|https?:\/\/)/.test(href)) return;
      const a = el('a', { class: l.primary ? 'pri ' + g : '', href, text: l.label });
      if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
      links.append(a);
    });
    box.append(el('div', { class: 'card pcard' + (p.status === 'soon' ? ' soon' : '') },
      el('div', { class: 'top' }, el('div', { class: 'big ' + g, text: p.icon || '✨' }), el('div', {}, el('h3', { text: p.name }), el('div', { class: 'tg', text: p.tag || '' }))),
      el('p', { class: 'hint', text: p.desc || '' }),
      (p.features || []).length ? el('ul', {}, ...p.features.map((f) => el('li', { text: f }))) : '', links));
  });
})();
