const { handler, bot, send, referralBonus } = require('./_lib');
module.exports = handler(['GET'], async (req, res, user) => {
  const bonus = await referralBonus(req);
  const r = await bot('/hub/my', { user, maxHeader: 10 + bonus });
  send(res, r.status, r.data);
});
