(function () {
  const { $, sb, cfg, configured, COUNTRIES } = Hub;
  Hub.chrome();
  const params = new URLSearchParams(location.search);
  const next = (() => { const n = params.get('next') || '/pair'; return /^\/[a-z]*$/.test(n) ? n : '/pair'; })();
  let mode = 'signin', method = 'email', phone = '';
  const M = cfg.METHODS || {};
  const show = (el, on) => $(el).classList.toggle('hide', !on);
  const say = (t, type) => { const m = $('msg'); m.textContent = t || ''; m.className = 'msg ' + (type || 'err') + (t ? '' : ' hide'); };

  if (!M.google) show('google', false);
  if (!M.email) { show('emailForm', false); }
  if (!M.phone) { show('phoneForm', false); }
  if (!M.email || !M.phone) { show('methodTabs', false); if (!M.email && M.phone) { method = 'phone'; show('phoneForm', true); } }
  if (!M.google || (!M.email && !M.phone)) show('sep', false);

  COUNTRIES.forEach(([c, l]) => { const o = document.createElement('option'); o.value = c; o.textContent = l; $('pcc').append(o); });
  Hub.getSession().then((s) => { if (s) location.replace(next); });
  if (sb) sb.auth.onAuthStateChange((ev, s) => { if (s && (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED')) location.replace(next); });

  function setMode(m) {
    mode = m; say('');
    document.querySelectorAll('#modeTabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    show('nameWrap', m === 'signup'); show('pw2Wrap', m === 'signup');
    $('emailGo').textContent = m === 'signup' ? 'Create my account' : 'Sign in';
    $('pw').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    $('forgot').classList.toggle('hide', m === 'signup');
  }
  function setMethod(t) {
    method = t; say('');
    document.querySelectorAll('#methodTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    show('emailForm', t === 'email'); show('phoneForm', t === 'phone');
  }
  document.querySelectorAll('#modeTabs button').forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  document.querySelectorAll('#methodTabs button').forEach((b) => (b.onclick = () => setMethod(b.dataset.t)));
  const guard = () => { if (!sb) { say('This site is not configured yet (Supabase keys missing).'); return false; } return true; };
  const busy = (btn, on, label) => { btn.disabled = on; if (label) btn.textContent = label; };

  $('google').onclick = async () => {
    if (!guard()) return;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + next } });
    if (error) say(error.message);
  };

  $('emailForm').onsubmit = async (e) => {
    e.preventDefault(); if (!guard()) return; say('');
    const email = $('em').value.trim(), pw = $('pw').value, btn = $('emailGo'), label = btn.textContent;
    busy(btn, true, mode === 'signup' ? 'Creating…' : 'Signing in…');
    try {
      if (mode === 'signup') {
        if (pw.length < 8) throw new Error('Use at least 8 characters for the password.');
        if (pw !== $('pw2').value) throw new Error('The two passwords do not match.');
        const { data, error } = await sb.auth.signUp({ email, password: pw, options: { data: { full_name: $('nm').value.trim() || email.split('@')[0] }, emailRedirectTo: location.origin + '/pair' } });
        if (error) throw error;
        if (data.session) location.replace(next); else say('✅ Account created! Check your email and tap the confirmation link, then sign in.', 'ok');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        location.replace(next);
      }
    } catch (err) { say(err.message || 'Something went wrong.'); }
    busy(btn, false, label);
  };
  $('forgot').onclick = async (e) => {
    e.preventDefault(); if (!guard()) return; const email = $('em').value.trim();
    if (!email) return say('Type your email above first.', 'info');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/account#settings' });
    say(error ? error.message : '📧 Password reset link sent — check your email.', error ? 'err' : 'ok');
  };
  $('magic').onclick = async (e) => {
    e.preventDefault(); if (!guard()) return; const email = $('em').value.trim();
    if (!email) return say('Type your email above first.', 'info');
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + next } });
    say(error ? error.message : '📧 Sign-in link sent — open it on this device.', error ? 'err' : 'ok');
  };

  $('phoneForm').onsubmit = async (e) => {
    e.preventDefault(); if (!guard()) return; say('');
    if (!$('phStep2').classList.contains('hide')) {
      busy($('phVerify'), true, 'Verifying…');
      const { error } = await sb.auth.verifyOtp({ phone: '+' + phone, token: $('otp').value.trim(), type: 'sms' });
      busy($('phVerify'), false, 'Verify & continue');
      if (error) return say(error.message);
      return location.replace(next);
    }
    const digits = $('pph').value.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length < 6) return say('Enter your phone number.');
    phone = $('pcc').value + digits;
    busy($('phSend'), true, 'Sending…');
    const { error } = await sb.auth.signInWithOtp({ phone: '+' + phone });
    busy($('phSend'), false, 'Send me a code');
    if (error) return say(error.message);
    show('phStep1', false); show('phStep2', true); say('📱 Code sent to +' + phone, 'ok'); $('otp').focus();
  };
  $('phBack').onclick = () => { show('phStep2', false); show('phStep1', true); say(''); };
  if (params.get('error_description')) say(params.get('error_description'));
})();
