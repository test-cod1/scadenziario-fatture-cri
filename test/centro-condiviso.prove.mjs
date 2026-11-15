// ============================================================
//  Il link di sola lettura di un centro di costo (/api/centro-condiviso),
//  provato su un database finto. È una porta aperta senza login: le prove
//  fissano che cosa passa (il centro del link e i campi da mostrare) e che
//  cosa no (le note, l'id, gli altri centri, qualunque scrittura).
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { onRequestPost, CAMPI_MOVIMENTO, LIMITE_CENTRO, oggiRoma } from '../functions/api/centro-condiviso.js';
import { nuovoToken } from '../js/lib/datiFatturazione.mjs';
import { nuovoCodiceLink, nomeNelLink, formaValida, casuale } from '../js/lib/linkCentri.mjs';

const TOKEN = nuovoCodiceLink('Automedica');

gruppo('Analisi — il codice del link');

prova('il link porta il nome dell\'attività e dieci caratteri casuali', () => {
  const c = nuovoCodiceLink('Automedica');
  vero(/^automedica-[A-Za-z0-9]{10}$/.test(c), c);
  vero(formaValida(c));
  vero(nuovoCodiceLink('Automedica') !== c, 'due link dello stesso centro sono diversi');
});

prova('il nome si riduce a lettere, cifre e trattini, tagliato a una parola intera', () => {
  uguale(nomeNelLink('Corso BLSD – primavera 2026'), 'corso-blsd-primavera-2026');
  uguale(nomeNelLink('Attività «Fiera» più è'), 'attivita-fiera-piu-e');
  uguale(nomeNelLink('Assistenza sanitaria alla manifestazione estiva del porto'), 'assistenza-sanitaria-alla');
  uguale(nomeNelLink('!!!'), '');
  vero(/^[A-Za-z0-9]{10}$/.test(nuovoCodiceLink('!!!')), 'senza un nome usabile resta il solo codice');
});

prova('i caratteri casuali usano tutto l\'alfabeto', () => {
  const visti = new Set(casuale(4000));
  vero(visti.size === 62, `visti ${visti.size} caratteri su 62`);
});

prova('valgono la forma nuova e quella dei link già creati, nient\'altro', () => {
  vero(formaValida(nuovoToken()), 'i link di 43 caratteri restano validi');
  vero(formaValida('Xk3pQ9aZb2'));
  for (const no of ['', 'auto', 'automedica-abc', 'Automedica-Xk3pQ9aZb2', 'auto medica-Xk3pQ9aZb2', 'a'.repeat(70), null, 42]) {
    vero(!formaValida(no), `non deve valere: ${no}`);
  }
});
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'chiave', SUPABASE_URL: 'https://db.finto' };
let db, richieste, tentativi = 1;

function nuovoDb() {
  richieste = [];
  tentativi = 1;
  db = {
    centri_costo: [
      { id: 'c1', nome: 'Automedica', descrizione: 'Golf 1', inizio: null, fine: null, chiuso: false, link_token: TOKEN },
      { id: 'c2', nome: 'Altro', descrizione: '', link_token: null },
    ],
    movimenti_analisi: [
      { centro_id: 'c1', tipo: 'uscita', data: '2026-04-29', descrizione: 'Rifornimento', importo: 82, note: 'Carta 70055720010315414' },
      { centro_id: 'c1', tipo: 'entrata', data: '2026-04-30', descrizione: 'Servizio 118', importo: 2700, note: 'riservato' },
      { centro_id: 'c2', tipo: 'uscita', data: '2026-01-01', descrizione: 'Di un altro centro', importo: 5, note: '' },
    ],
  };
}

// Un PostgREST minimo: select, filtri eq, offset/limit. Registra ogni
// richiesta, così si può controllare che nessuna scriva.
async function finto(url, opzioni = {}) {
  const u = new URL(url);
  richieste.push({ metodo: opzioni.method || 'GET', url: u });
  const tabella = u.pathname.split('/').pop();
  // Il contatore dei tentativi (functions/_lib/limiti.js): risponde col
  // numero scritto in `tentativi`.
  if (tabella === 'consuma_limite_anonimo') return new Response(String(tentativi), { status: 200 });
  let righe = [...(db[tabella] || [])];
  for (const [k, v] of u.searchParams) {
    if (v.startsWith('eq.')) righe = righe.filter(r => String(r[k]) === v.slice(3));
  }
  const campi = (u.searchParams.get('select') || '*').split(',');
  if (campi[0] !== '*') righe = righe.map(r => Object.fromEntries(campi.map(c => [c, r[c]])));
  const off = Number(u.searchParams.get('offset') || 0), lim = Number(u.searchParams.get('limit') || 1e9);
  return new Response(JSON.stringify(righe.slice(off, off + lim)), { status: 200 });
}

async function chiama(corpo, env = ENV) {
  const request = new Request('https://x/api/centro-condiviso', { method: 'POST', body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) });
  const vero = globalThis.fetch;
  globalThis.fetch = finto;
  try {
    const res = await onRequestPost({ request, env });
    return { status: res.status, corpo: await res.json(), cache: res.headers.get('Cache-Control') };
  } finally { globalThis.fetch = vero; }
}

gruppo('Analisi — link di sola lettura di un centro');

prova('il link mostra il suo centro e i suoi movimenti, senza note', async () => {
  nuovoDb();
  const r = await chiama({ token: TOKEN });
  uguale(r.status, 200);
  uguale(r.cache, 'no-store');
  uguale(r.corpo.centro.nome, 'Automedica');
  uguale(r.corpo.centro.id, undefined, 'l\'id interno non esce');
  uguale(r.corpo.movimenti.length, 2, 'solo i movimenti di quel centro');
  const testo = JSON.stringify(r.corpo);
  vero(!testo.includes('70055720010315414') && !testo.includes('riservato'), 'le note non devono uscire');
  vero(!testo.includes('Di un altro centro'));
  vero(!CAMPI_MOVIMENTO.split(',').includes('note'));
});

prova('codice inesistente o disattivato: stessa risposta', async () => {
  nuovoDb();
  const altro = await chiama({ token: nuovoToken() });
  db.centri_costo[0].link_token = null;
  const tolto = await chiama({ token: TOKEN });
  uguale([altro.status, tolto.status], [404, 404]);
  uguale(altro.corpo.error, tolto.corpo.error);
});

prova('un codice malformato non arriva nemmeno al database', async () => {
  nuovoDb();
  for (const token of ['', 'abc', `${TOKEN}&nome=eq.Altro`, 'x'.repeat(43).replace(/x/g, '*'), null]) {
    const r = await chiama({ token });
    uguale(r.status, 404);
  }
  uguale(richieste.length, 0);
});

prova('l\'endpoint legge soltanto', async () => {
  nuovoDb();
  await chiama({ token: TOKEN });
  const letture = richieste.filter(q => !q.url.pathname.endsWith('/rpc/consuma_limite_anonimo'));
  vero(letture.length > 0 && letture.every(q => q.metodo === 'GET'), 'sui dati solo letture (l’unica scrittura è il contatore dei tentativi)');
});

prova('senza la chiave di servizio la pagina dice che non è disponibile', async () => {
  nuovoDb();
  const r = await chiama({ token: TOKEN }, {});
  uguale(r.status, 503);
});

prova('un link con la scadenza vale fino a quel giorno compreso, poi è come inesistente', async () => {
  nuovoDb();
  const oggi = oggiRoma();
  db.centri_costo[0].link_scade_il = oggi;
  uguale((await chiama({ token: TOKEN })).status, 200, 'l’ultimo giorno il link vale ancora');
  db.centri_costo[0].link_scade_il = '2020-01-01';
  const scaduto = await chiama({ token: TOKEN });
  const inesistente = await chiama({ token: nuovoToken() });
  uguale(scaduto.status, 404);
  uguale(scaduto.corpo.error, inesistente.corpo.error, 'non si distingue un link scaduto da uno che non esiste');
  db.centri_costo[0].link_scade_il = null;
  uguale((await chiama({ token: TOKEN })).status, 200, 'senza scadenza vale sempre');
});

prova('troppe aperture dallo stesso indirizzo: 429 prima di leggere i dati', async () => {
  nuovoDb();
  tentativi = LIMITE_CENTRO.massimo + 1;
  const r = await chiama({ token: TOKEN });
  uguale(r.status, 429);
  vero(!richieste.some(q => q.url.pathname.endsWith('/centri_costo')), 'i dati non si leggono');
});

prova('la scadenza scelta cade il giorno giusto, anche a fine mese', async () => {
  const { scadenzaLink } = await import('../js/lib/linkCentri.mjs');
  uguale(scadenzaLink('2026-11-15', 6), '2027-05-15');
  uguale(scadenzaLink('2026-01-31', 1), '2026-02-28');
  uguale(scadenzaLink('2027-12-31', 12), '2028-12-31');
  uguale(scadenzaLink('2026-11-15', 0), null);
});
