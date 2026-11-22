const { handler, bot, send } = require('./_lib');
module.exports = handler(['GET'], async (req, res, user) => {
  const id = String(req.query.id || '').slice(0, 80);
  const r = await bot('/hub/status?id=' + encodeURIComponent(id), { user });
  send(res, r.status, r.data);
});
