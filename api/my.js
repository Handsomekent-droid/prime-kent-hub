const { handler, bot, send } = require('./_lib');
module.exports = handler(['GET'], async (req, res, user) => {
  const r = await bot('/hub/my', { user });
  send(res, r.status, r.data);
});
