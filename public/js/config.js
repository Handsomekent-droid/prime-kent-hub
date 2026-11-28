// Fill these two with the values from Supabase → Project Settings → API.
// Both are PUBLIC by design (the anon key is safe in a browser). Never put the service_role key here.
window.HUB = {
  SUPABASE_URL: 'https://eyksxaedruztppqhcpsl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5a3N4YWVkcnV6dHBwcWhjcHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzMTkyODUsImV4cCI6MjExMDg5NTI4NX0.EV72f3i4ojgtR0A7_bMoLRBi7Mn82u8lCCUINdRfQlw',
  // show/hide the login methods (turn a method on only after you enabled it in Supabase → Authentication → Providers)
  METHODS: { google: true, email: true, phone: false },
  BRAND: 'Prime Kent Dev Hub',
  PRODUCT: 'Nexora Nemesis Pairing',
  CHANNEL: 'https://whatsapp.com/channel/0029VbE8mE75Ui2ayfBnZv3s',
  TELEGRAM: 'https://t.me/NexoraNemesisXBot'
};
