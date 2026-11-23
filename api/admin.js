const crypto = require('crypto');
const { env, send, getUser, bot, isAdmin, supa } = require('./_lib');

// One endpoint for the admin page: /api/admin?action=...   Only e-mails in ADMIN_EMAILS get past the first check.
module.exports = async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return send(res, 401, { ok: false, msg: 'Please sign in.' });
    const action = String((req.query && req.query.action) || '');
    const admin = isAdmin(user);
    if (action === 'whoami') return send(res, 200, { ok: true, admin });
    if (!admin) return send(res, 403, { ok: false, msg: 'Admins only.' });
    const b = req.body || {};
    const oidOf = (uid) => 'web' + crypto.createHash('sha256').update(env('BOT_API_SECRET') + ':' + uid).digest('hex').slice(0, 16);

    if (action === 'overview') {
      const r = await bot('/hub/admin/overview', { user, admin: true });
      const u = await supa('/auth/v1/admin/users?page=1&per_page=1000');
      const users = (u.data && u.data.users) || [];
      return send(res, 200, { ok: r.status === 200, bot: r.data, users: users.length, tickets: 0 });
    }
    if (action === 'users') {
      const u = await supa('/auth/v1/admin/users?page=1&per_page=500');
      if (!u.ok) return send(res, 502, { ok: false, msg: (u.data && (u.data.msg || u.data.message)) || 'Could not list users.' });
      const s = await bot('/hub/admin/sessions', { user, admin: true });
      const mine = (s.data && s.data.sessions) || [];
      const rows = ((u.data && u.data.users) || []).map((x) => {
        const oid = oidOf(x.id); const own = mine.filter((m) => m.id.startsWith(oid));
        return { id: x.id, email: x.email || '', phone: x.phone || '', created: x.created_at, last: x.last_sign_in_at, banned: !!(x.banned_until && new Date(x.banned_until) > new Date()), provider: (x.app_metadata && x.app_metadata.provider) || '', numbers: own.length, online: own.filter((m) => m.online).length };
      }).sort((a, c) => String(c.created).localeCompare(String(a.created)));
      return send(res, 200, { ok: true, users: rows });
    }
    if (action === 'ban' && req.method === 'POST') {
      const uid = String(b.userId || '');
      if (!/^[0-9a-f-]{36}$/i.test(uid) || uid === user.id) return send(res, 400, { ok: false, msg: 'Bad request.' });
      const r = await supa('/auth/v1/admin/users/' + uid, { method: 'PUT', body: { ban_duration: b.ban ? '876000h' : 'none' } });
      if (b.ban) { await bot('/hub/delete', { method: 'POST', body: { id: 'all' }, user: { id: uid } }); }
      return send(res, r.ok ? 200 : 502, { ok: r.ok, msg: r.ok ? '' : 'Could not update that user.' });
    }
    if (action === 'sessions') {
      const r = await bot('/hub/admin/sessions', { user, admin: true });
      return send(res, r.status, r.data);
    }
    if (action === 'remove-session' && req.method === 'POST') {
      const r = await bot('/hub/admin/remove', { method: 'POST', body: { id: String(b.id || '') }, user, admin: true });
      return send(res, r.status, r.data);
    }
    if (action === 'announcements') {
      const r = await supa('/rest/v1/announcements?select=*&order=created_at.desc&limit=50');
      return send(res, r.ok ? 200 : 502, { ok: r.ok, items: r.data || [], msg: r.ok ? '' : 'Run the new SQL (supabase/schema.sql) first.' });
    }
    if (action === 'announce' && req.method === 'POST') {
      const title = String(b.title || '').trim().slice(0, 80), body = String(b.body || '').trim().slice(0, 600);
      if (!title || !body) return send(res, 400, { ok: false, msg: 'Add a title and a message.' });
      const r = await supa('/rest/v1/announcements', { method: 'POST', body: { title, body, pinned: !!b.pinned }, prefer: 'return=minimal' });
      return send(res, r.ok ? 200 : 502, { ok: r.ok, msg: r.ok ? '' : 'Could not save. Run the new SQL first.' });
    }
    if (action === 'delete-announcement' && req.method === 'POST') {
      const id = parseInt(b.id, 10); if (!Number.isInteger(id)) return send(res, 400, { ok: false });
      const r = await supa('/rest/v1/announcements?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      return send(res, r.ok ? 200 : 502, { ok: r.ok });
    }
    if (action === 'tickets') {
      const r = await supa('/rest/v1/support_tickets?select=*&order=created_at.desc&limit=100');
      return send(res, r.ok ? 200 : 502, { ok: r.ok, items: r.data || [], msg: r.ok ? '' : 'Run the new SQL (supabase/schema.sql) first.' });
    }
    if (action === 'ticket-status' && req.method === 'POST') {
      const id = parseInt(b.id, 10); const status = b.status === 'closed' ? 'closed' : 'open';
      if (!Number.isInteger(id)) return send(res, 400, { ok: false });
      const r = await supa('/rest/v1/support_tickets?id=eq.' + id, { method: 'PATCH', body: { status }, prefer: 'return=minimal' });
      return send(res, r.ok ? 200 : 502, { ok: r.ok });
    }
    if (action === 'posts') {
      const r = await supa('/rest/v1/posts?select=*&order=created_at.desc&limit=60');
      return send(res, r.ok ? 200 : 502, { ok: r.ok, items: r.data || [], msg: r.ok ? '' : 'Run the new SQL (supabase/schema.sql) first.' });
    }
    if (action === 'delete-post' && req.method === 'POST') {
      const id = parseInt(b.id, 10); if (!Number.isInteger(id)) return send(res, 400, { ok: false });
      const r = await supa('/rest/v1/posts?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      return send(res, r.ok ? 200 : 502, { ok: r.ok });
    }
    if (action === 'polls') {
      const r = await supa('/rest/v1/polls?select=*&order=created_at.desc&limit=30');
      return send(res, r.ok ? 200 : 502, { ok: r.ok, items: r.data || [], msg: r.ok ? '' : 'Run the new SQL (supabase/schema.sql) first.' });
    }
    if (action === 'create-poll' && req.method === 'POST') {
      const question = String(b.question || '').trim().slice(0, 140);
      const options = (Array.isArray(b.options) ? b.options : []).map((x) => String(x || '').trim().slice(0, 60)).filter(Boolean).slice(0, 6);
      if (!question || options.length < 2) return send(res, 400, { ok: false, msg: 'Add a question and at least 2 options.' });
      const r = await supa('/rest/v1/polls', { method: 'POST', body: { question, options }, prefer: 'return=minimal' });
      return send(res, r.ok ? 200 : 502, { ok: r.ok, msg: r.ok ? '' : 'Could not save. Run the new SQL first.' });
    }
    if (action === 'delete-poll' && req.method === 'POST') {
      const id = parseInt(b.id, 10); if (!Number.isInteger(id)) return send(res, 400, { ok: false });
      const r = await supa('/rest/v1/polls?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      return send(res, r.ok ? 200 : 502, { ok: r.ok });
    }
    return send(res, 404, { ok: false, msg: 'Unknown action.' });
  } catch (e) { send(res, 500, { ok: false, msg: 'Server error.' }); }
};
