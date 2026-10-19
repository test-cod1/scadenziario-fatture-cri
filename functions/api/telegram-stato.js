// ============================================================
//  Cloudflare Function — Il bot Telegram è pronto?
//  Endpoint: GET /api/telegram-stato  →  { configurato, bot }
//
//  La pagina Idee lo chiede per sapere se proporre il collegamento e con
//  quale nome del bot costruire il link t.me/<bot>. Solo per chi ha
//  accesso alla sezione Direttore. Il token del bot non esce mai di qui.
// ============================================================

import { requireUser, ruoloSezione } from '../_lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);
  if (!await ruoloSezione(request, env, 'direttore')) return json({ error: 'Serve l’accesso alla sezione Direttore.' }, 403);

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return json({ configurato: false, bot: null });
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await res.json().catch(() => ({}));
    if (!data.ok) return json({ configurato: false, bot: null });
    return json({ configurato: true, bot: data.result?.username || null });
  } catch {
    return json({ configurato: true, bot: null });
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
