const { handler, bot, send } = require('./_lib');
// POST { id, text, image? (base64 JPEG/PNG, max ~3 MB) } -> posts to that number's WhatsApp status
module.exports = handler(['POST'], async (req, res, user) => {
  const b = req.body || {};
  const id = String(b.id || '').slice(0, 80);
  if (!id) return send(res, 400, { ok: false, msg: 'Missing id.' });
  const image = typeof b.image === 'string' && b.image.length < 4.2 * 1024 * 1024 ? b.image : '';
  const r = await bot('/hub/post-status', { method: 'POST', body: { id, text: String(b.text || '').slice(0, 700), image }, user });
  send(res, r.status, r.data);
});
