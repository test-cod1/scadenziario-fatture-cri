// ============================================================
//  Cloudflare Function — Registra il webhook del bot presso Telegram
//  Endpoint: POST /api/telegram-configura  →  { ok, bot, url }
//
//  Una volta sola, dopo aver messo i secret del bot (o dopo un cambio di
//  dominio): dice a Telegram di mandare i messaggi a /api/telegram di
//  questo sito, con il segreto che il webhook controlla, e imposta il menu
//  dei comandi. Solo il super admin del portale.
// ============================================================

import { requireUser, ruoloUtente } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Accesso non autorizzato: effettua il login.' }, 401);
  if (await ruoloUtente(request, env, user.id) !== 'super_admin') return json({ error: 'Solo un amministratore del portale può configurare il bot.' }, 403);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ error: 'Mancano i secret TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET sul server.' }, 500);
  }
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ error: 'TELEGRAM_WEBHOOK_SECRET deve avere da 16 a 256 caratteri fra lettere, cifre, _ e -.' }, 500);
  }

  const api = (metodo, corpo) => fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}),
  }).then(r => r.json()).catch(() => ({ ok: false }));

  const url = (env.PORTALE_URL || new URL(request.url).origin).replace(/\/$/, '') + '/api/telegram';
  const hook = await api('setWebhook', {
    url, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'], drop_pending_updates: true,
  });
  if (!hook.ok) return json({ error: 'Telegram ha rifiutato il webhook: ' + (hook.description || 'controlla il token del bot.') }, 502);

  await api('setMyCommands', { commands: [
    { command: 'idee', description: 'Le ultime idee' },
    { command: 'collega', description: 'Collega questo Telegram al portale (con il codice)' },
    { command: 'scollega', description: 'Scollega questo Telegram' },
    { command: 'aiuto', description: 'Come funziona' },
  ] });
  const me = await api('getMe');
  return json({ ok: true, bot: me.result?.username || null, url });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
