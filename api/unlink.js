const { handler, bot, send } = require('./_lib');
module.exports = handler(['POST'], async (req, res, user) => {
  const id = String((req.body && req.body.id) || '').slice(0, 80);
  if (!id) return send(res, 400, { ok: false, msg: 'Missing id.' });
  const r = await bot('/hub/delete', { method: 'POST', body: { id }, user });
  send(res, r.status, r.data);
});
