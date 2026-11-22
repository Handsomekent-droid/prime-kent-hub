const { handler, bot, send, clientIp } = require('./_lib');
module.exports = handler(['POST'], async (req, res, user) => {
  const phone = String((req.body && req.body.phone) || '').replace(/\D/g, '');
  if (phone.length < 8 || phone.length > 15) return send(res, 400, { ok: false, msg: 'Enter a valid number with the country code.' });
  const r = await bot('/hub/pair', { method: 'POST', body: { phone }, user, ip: clientIp(req) });
  send(res, r.status, r.data);
});
