const { handler, bot, send } = require('./_lib');
// GET /api/settings?id=...  -> the switches of one of your numbers;  POST { id, patch } -> change them
module.exports = handler(['GET', 'POST'], async (req, res, user) => {
  if (req.method === 'GET') {
    const id = String((req.query && req.query.id) || '').slice(0, 80);
    if (!id) return send(res, 400, { ok: false, msg: 'Missing id.' });
    const r = await bot('/hub/settings?id=' + encodeURIComponent(id), { user });
    return send(res, r.status, r.data);
  }
  const b = req.body || {};
  const id = String(b.id || '').slice(0, 80);
  if (!id || typeof b.patch !== 'object' || !b.patch) return send(res, 400, { ok: false, msg: 'Missing data.' });
  const r = await bot('/hub/settings', { method: 'POST', body: { id, patch: b.patch }, user });
  send(res, r.status, r.data);
});
