// ============================================================
//  Login con nome e cognome (/api/email-accesso), su un Auth finto.
//  Le prove fissano che il nome si trova comunque lo si scriva, e che si
//  trovano SOLO gli account con un nome di accesso: gli altri restano
//  raggiungibili per email e basta.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { onRequestPost, NON_TROVATO } from '../functions/api/email-accesso.js';
import { normalizzaNome, sembraEmail } from '../js/lib/nomeAccesso.mjs';
import { ROUTES } from '../functions/_lib/rotte.js';

gruppo('Accesso con nome e cognome');

prova('maiuscole, accenti, spazi e ordine delle parole non contano', () => {
  const n = normalizzaNome('Duray Nayyab');
  for (const s of ['duray nayyab', '  DURAY   Nayyab ', 'Nayyab Duray', 'Duráy Nayyab']) uguale(normalizzaNome(s), n, s);
  uguale(normalizzaNome('Maria Rita Bassino'), normalizzaNome('bassino maria rita'));
  vero(normalizzaNome('Maria Bassino') !== normalizzaNome('Maria Rita Bassino'), 'un nome a metà non basta');
  uguale(normalizzaNome(''), ''); uguale(normalizzaNome(null), '');
});

prova('con la chiocciola è un\'email, senza è un nome', () => {
  vero(sembraEmail('a@b.it')); vero(!sembraEmail('Duray Nayyab'));
});

const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'chiave', SUPABASE_URL: 'https://db.finto' };
const UTENTI = [
  { email: 'genova.amministrazione+nayyab@liguria.cri.it', app_metadata: { nome_accesso: 'Duray Nayyab' } },
  { email: 'genova.amministrazione+bassino@liguria.cri.it', app_metadata: { nome_accesso: 'Maria Rita Bassino' } },
  { email: 'mario.rossi@cri.it', app_metadata: {}, user_metadata: { nome: 'Mario Rossi' } },
];

async function chiedi(corpo, utenti = UTENTI) {
  const fetchVero = globalThis.fetch;
  globalThis.fetch = async (url, opz) => {
    vero(String(url).startsWith('https://db.finto/auth/v1/admin/users'), String(url));
    vero(!opz?.method || opz.method === 'GET', 'solo letture');
    return new Response(JSON.stringify({ users: utenti }), { status: 200 });
  };
  try {
    const res = await onRequestPost({ request: new Request('https://x/api/email-accesso', { method: 'POST', body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }), env: ENV });
    return { status: res.status, corpo: await res.json() };
  } finally { globalThis.fetch = fetchVero; }
}

prova('il nome dà l\'email del suo account', async () => {
  uguale(await chiedi({ nome: 'duray nayyab' }), { status: 200, corpo: { email: UTENTI[0].email } });
  uguale((await chiedi({ nome: 'Bassino Maria Rita' })).corpo.email, UTENTI[1].email);
});

prova('un account senza nome di accesso non si trova per nome', async () => {
  uguale(await chiedi({ nome: 'Mario Rossi' }), { status: 404, corpo: { error: NON_TROVATO } });
  uguale((await chiedi({ nome: '' })).status, 404);
  uguale((await chiedi('non json')).status, 400);
});

prova('due account con lo stesso nome: non si indovina', async () => {
  const doppi = [...UTENTI, { email: 'altra@cri.it', app_metadata: { nome_accesso: 'Nayyab Duray' } }];
  uguale((await chiedi({ nome: 'Duray Nayyab' }, doppi)).status, 409);
});

prova('l\'endpoint è fra le rotte, solo in POST', () => {
  uguale(Object.keys(ROUTES['/api/email-accesso'] || {}), ['POST']);
});
