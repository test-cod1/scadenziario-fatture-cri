// ============================================================
//  Bot Telegram delle idee (functions/_lib/telegram.js e
//  functions/api/telegram.js). Il webhook si prova davvero, con un
//  database finto in memoria al posto di Supabase: chi non presenta il
//  segreto resta fuori, il collegamento nasce solo da un codice valido, e
//  un'idea entra solo da una chat collegata a chi ha accesso al Direttore.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { interpreta, stessoSegreto } from '../functions/_lib/telegram.js';
import { onRequestPost } from '../functions/api/telegram.js';

gruppo('Bot Telegram');

const msg = (text, extra = {}) => ({ message: { chat: { id: 555, type: 'private' }, from: { first_name: 'Anna' }, text, ...extra } });

prova('i comandi si riconoscono, anche con il nome del bot', () => {
  uguale(interpreta(msg('/collega ab12-cd34'))?.codice, 'AB12CD34');
  uguale(interpreta(msg('/start AB12CD34'))?.tipo, 'collega', 'il link t.me/...?start=');
  uguale(interpreta(msg('/start'))?.tipo, 'aiuto');
  uguale(interpreta(msg('/idee@CriGenovaBot'))?.tipo, 'idee');
  uguale(interpreta(msg('Comprare un defibrillatore nuovo'))?.tipo, 'idea');
});

prova('gruppi, canali e messaggi senza testo si ignorano', () => {
  uguale(interpreta({ message: { chat: { id: 1, type: 'group' }, text: 'ciao' } }), null);
  uguale(interpreta({ message: { chat: { id: 1, type: 'private' }, photo: [] } }), null);
  uguale(interpreta({ edited_message: { chat: { id: 1, type: 'private' }, text: 'x' } }), null);
});

prova('il segreto vuoto non vale mai', () => {
  uguale(stessoSegreto('', ''), false);
  uguale(stessoSegreto('abc', 'abd'), false);
  uguale(stessoSegreto('segreto-lungo', 'segreto-lungo'), true);
});

// ---------- Webhook con un Supabase finto ----------
const ENV = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_WEBHOOK_SECRET: 'segreto-del-webhook', SUPABASE_SERVICE_ROLE_KEY: 'k', SUPABASE_URL: 'https://db' };
const UTENTE = '11111111-1111-1111-1111-111111111111';
let db;
function nuovoDb() {
  db = {
    profili: [{ id: UTENTE, email: 'anna@cri.it', nome: 'Anna', ruolo: 'utente', deve_cambiare_password: false }],
    autorizzazioni: [{ utente_id: UTENTE, sezione: 'direttore' }],
    telegram_collegamenti: [{ utente_id: UTENTE, chat_id: null, codice: 'AB12CD34', codice_scade: new Date(Date.now() + 600000).toISOString() }],
    idee_direttore: [],
  };
}
// Un PostgREST minimo: select con filtri eq/neq, insert, patch, delete. Si
// mette al posto di fetch solo durante la chiamata al webhook: le altre
// prove usano il fetch vero.
const finto = async (url, opz = {}) => {
  const u = new URL(url);
  const tabella = u.pathname.split('/').pop();
  const filtri = [...u.searchParams].filter(([k]) => !['select', 'order', 'limit'].includes(k));
  const passa = (r) => filtri.every(([k, v]) => {
    const [op, val] = [v.slice(0, v.indexOf('.')), v.slice(v.indexOf('.') + 1)];
    return op === 'eq' ? String(r[k]) === val : op === 'neq' ? String(r[k]) !== val : true;
  });
  const righe = db[tabella];
  const metodo = opz.method || 'GET';
  if (metodo === 'GET') return new Response(JSON.stringify(righe.filter(passa)), { status: 200 });
  if (metodo === 'POST') { righe.push(JSON.parse(opz.body)); return new Response('[]', { status: 201 }); }
  if (metodo === 'PATCH') { righe.filter(passa).forEach(r => Object.assign(r, JSON.parse(opz.body))); return new Response('[]', { status: 200 }); }
  if (metodo === 'DELETE') { db[tabella] = righe.filter(r => !passa(r)); return new Response('[]', { status: 200 }); }
};
async function chiama(update, segreto = ENV.TELEGRAM_WEBHOOK_SECRET) {
  const request = new Request('https://x/api/telegram', {
    method: 'POST', body: JSON.stringify(update),
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': segreto },
  });
  const vero = globalThis.fetch;
  globalThis.fetch = finto;
  try {
    const res = await onRequestPost({ request, env: ENV });
    return { status: res.status, corpo: await res.json() };
  } finally { globalThis.fetch = vero; }
}

prova('webhook: senza il segreto giusto non entra nessuno', async () => {
  nuovoDb();
  uguale((await chiama(msg('ciao'), 'sbagliato')).status, 401);
  uguale(db.idee_direttore.length, 0);
});

prova('webhook: una chat non collegata non può aggiungere idee', async () => {
  nuovoDb();
  const r = await chiama(msg('Un\'idea qualsiasi'));
  vero(r.corpo.text.includes('non è collegato'), 'manca la spiegazione per collegarsi');
  uguale(db.idee_direttore.length, 0);
});

prova('webhook: collegata col codice, ogni messaggio diventa un\'idea dell\'utente', async () => {
  nuovoDb();
  const c = await chiama(msg('/collega AB12CD34'));
  vero(c.corpo.text.startsWith('✅'), 'collegamento non riuscito: ' + c.corpo.text);
  uguale([db.telegram_collegamenti[0].chat_id, db.telegram_collegamenti[0].codice], [555, null], 'il codice si consuma');
  await chiama(msg('Corso BLSD per i volontari nuovi'));
  uguale(db.idee_direttore.map(i => [i.testo, i.origine, i.autore_id]), [['Corso BLSD per i volontari nuovi', 'telegram', UTENTE]]);
  uguale((await chiama(msg('/collega AB12CD34'))).corpo.text.includes('non valido'), true, 'il codice non si riusa');
});

prova('webhook: codice scaduto, o utente senza più accesso al Direttore', async () => {
  nuovoDb();
  db.telegram_collegamenti[0].codice_scade = new Date(Date.now() - 1000).toISOString();
  vero((await chiama(msg('/collega AB12CD34'))).corpo.text.includes('scaduto'), 'il codice scaduto passa');
  nuovoDb();
  db.telegram_collegamenti[0].chat_id = 555;
  db.autorizzazioni = [];
  vero((await chiama(msg('idea'))).corpo.text.includes('accesso'), 'chi ha perso l\'accesso scrive ancora');
  uguale(db.idee_direttore.length, 0);
});
