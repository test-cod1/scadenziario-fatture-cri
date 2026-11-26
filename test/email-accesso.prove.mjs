// ============================================================
//  Login con nome e cognome (/api/email-accesso), su un Auth finto.
//  Le prove fissano che il nome si trova comunque lo si scriva, per il nome
//  di accesso (caselle condivise) o per il nome del profilo, e MAI per il
//  user_metadata, che l'utente può cambiarsi da sé.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { bloccoIp } from '../functions/_lib/limiti.js';
import { onRequestPost, NON_TROVATO, LIMITI_ACCESSO } from '../functions/api/email-accesso.js';
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
  { id: 'u1', email: 'genova.amministrazione+nayyab@liguria.cri.it', app_metadata: { nome_accesso: 'Duray Nayyab' } },
  { id: 'u2', email: 'genova.amministrazione+bassino@liguria.cri.it', app_metadata: { nome_accesso: 'Maria Rita Bassino' } },
  { id: 'u3', email: 'mario.rossi@cri.it', app_metadata: {}, user_metadata: { nome: 'Mario Rossi' } },
  { id: 'u4', email: 'federica.bianchi@cri.it', app_metadata: {}, user_metadata: { nome: 'Nome Inventato' } },
];
// Il nome del profilo (tabella profili) lo scrive solo un amministratore.
const PROFILI = [
  { id: 'u1', nome: 'Duray Nayyab' }, { id: 'u2', nome: 'Maria Rita Bassino' },
  { id: 'u3', nome: null }, { id: 'u4', nome: 'Federica Bianchi' },
];

// Auth finto: elenco utenti, login con la password giusta ('giusta'),
// recupero password, e il contatore dei tentativi (che qui dice sempre il
// numero che gli si passa in `tentativi`). Registra le chiamate fatte.
async function chiedi(corpo, { utenti = UTENTI, profili = PROFILI, tentativi = 1 } = {}) {
  const fetchVero = globalThis.fetch;
  const chiamate = [];
  globalThis.fetch = async (url, opz = {}) => {
    const u = String(url);
    const dati = opz.body ? JSON.parse(opz.body) : null;
    chiamate.push({ url: u, dati });
    if (u.startsWith('https://db.finto/auth/v1/admin/users')) {
      vero(!opz.method || opz.method === 'GET', 'sugli utenti solo letture');
      return new Response(JSON.stringify({ users: utenti }), { status: 200 });
    }
    if (u.startsWith('https://db.finto/rest/v1/profili')) {
      vero(!opz.method || opz.method === 'GET', 'sui profili solo letture');
      return new Response(JSON.stringify(profili), { status: 200 });
    }
    if (u.startsWith('https://db.finto/rest/v1/rpc/consuma_limite_anonimo')) return new Response(String(tentativi), { status: 200 });
    if (u.startsWith('https://db.finto/auth/v1/token?grant_type=password')) {
      return dati.password === 'giusta'
        ? new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', user: { email: dati.email } }), { status: 200 })
        : new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
    }
    if (u.startsWith('https://db.finto/auth/v1/recover')) return new Response('{}', { status: 200 });
    throw new Error('chiamata inattesa: ' + u);
  };
  try {
    const res = await onRequestPost({ request: new Request('https://x/api/email-accesso', { method: 'POST', body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }), env: ENV });
    return { status: res.status, corpo: await res.json(), chiamate };
  } finally { globalThis.fetch = fetchVero; }
}
const testo = (r) => JSON.stringify(r.corpo);

prova('nome e password giusti danno la sessione, e l’email non esce mai', async () => {
  const r = await chiedi({ nome: 'duray nayyab', password: 'giusta' });
  uguale(r.status, 200);
  uguale(r.corpo, { access_token: 'AT', refresh_token: 'RT' });
  vero(!testo(r).includes('@'), 'nessun indirizzo nella risposta');
  const login = r.chiamate.find(c => c.url.includes('grant_type=password'));
  uguale(login.dati.email, UTENTI[0].email, 'il login lo fa il server con l’email giusta');
});

prova('chiunque entra con il nome del suo profilo, anche senza nome di accesso', async () => {
  const r = await chiedi({ nome: 'bianchi federica', password: 'giusta' });
  uguale(r.status, 200);
  uguale(r.chiamate.find(c => c.url.includes('grant_type=password')).dati.email, 'federica.bianchi@cri.it');
});

prova('il nome che l’utente può cambiarsi da sé (user_metadata) non conta', async () => {
  for (const nome of ['Nome Inventato', 'Mario Rossi']) {
    const r = await chiedi({ nome, password: 'giusta' });
    uguale({ status: r.status, corpo: r.corpo }, { status: 401, corpo: { error: NON_TROVATO } }, nome);
  }
});

prova('nome sconosciuto, password sbagliata e omonimi rispondono allo stesso modo', async () => {
  const doppi = [...UTENTI, { id: 'u5', email: 'altra@cri.it', app_metadata: { nome_accesso: 'Nayyab Duray' } }];
  const omonimiProfilo = [...PROFILI, { id: 'u5', nome: 'Federica Bianchi' }];
  const casi = [
    await chiedi({ nome: 'Mario Rossi', password: 'giusta' }),        // nome solo in user_metadata
    await chiedi({ nome: 'Nessuno Qui', password: 'giusta' }),
    await chiedi({ nome: 'Duray Nayyab', password: 'sbagliata' }),
    await chiedi({ nome: 'Duray Nayyab', password: 'giusta' }, { utenti: doppi }),
    await chiedi({ nome: 'Federica Bianchi', password: 'giusta' }, { utenti: doppi, profili: omonimiProfilo }),
  ];
  for (const r of casi) uguale({ status: r.status, corpo: r.corpo }, { status: 401, corpo: { error: NON_TROVATO } });
  uguale((await chiedi('non json')).status, 400);
  uguale((await chiedi({ nome: 'Duray Nayyab' })).status, 400, 'senza password (codice vecchio) non si dice niente');
});

prova('recupero password per nome: risposta identica che il nome esista o no', async () => {
  const esiste = await chiedi({ nome: 'Duray Nayyab', azione: 'recupero' });
  const nonEsiste = await chiedi({ nome: 'Nessuno Qui', azione: 'recupero' });
  uguale(esiste.status, 200); uguale(esiste.corpo, nonEsiste.corpo);
  vero(!testo(esiste).includes('@'));
  const inviato = esiste.chiamate.find(c => c.url.includes('/auth/v1/recover'));
  uguale(inviato?.dati?.email, UTENTI[0].email, 'il link parte verso l’account giusto');
  vero(!nonEsiste.chiamate.some(c => c.url.includes('/auth/v1/recover')), 'per un nome sconosciuto non parte niente');
});

prova('troppi tentativi: 429 prima ancora di cercare il nome o provare la password', async () => {
  const r = await chiedi({ nome: 'Duray Nayyab', password: 'giusta' }, { tentativi: LIMITI_ACCESSO.accessoPerIp.massimo + 1 });
  uguale(r.status, 429);
  vero(!r.chiamate.some(c => c.url.includes('grant_type=password') || c.url.includes('admin/users')));
});



prova('IPv6: il limite conta il blocco /64, non il singolo indirizzo', () => {
  uguale(bloccoIp('2001:db8:85a3:12:1:2:3:4'), '2001:db8:85a3:12::/64');
  uguale(bloccoIp('2001:db8:85a3:12:ffff::9'), '2001:db8:85a3:12::/64');
  uguale(bloccoIp('2001:db8::1'), '2001:db8:0:0::/64');
  uguale(bloccoIp('203.0.113.7'), '203.0.113.7');
});

prova('l’endpoint è fra le rotte, solo in POST', () => {
  uguale(Object.keys(ROUTES['/api/email-accesso'] || {}), ['POST']);
});
