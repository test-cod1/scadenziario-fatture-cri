// ============================================================
//  I copioni dei tour guidati non devono puntare a rotte che non
//  esistono più.
//
//  Il motore (js/lib/tour.js) salta in silenzio un passo il cui elemento
//  non compare: è la scelta giusta a runtime — una pagina vuota o un ruolo
//  senza permessi non devono far fallire il tour — ma significa che un
//  copione rotto non si nota. Se una rotta viene rinominata, il tour della
//  sua sezione si accorcia da solo e nessuno se ne accorge.
//
//  È già capitato il 05/09/2026: la scheda degli straordinari è passata da
//  #/straordinari/richiesta a #/straordinari/registrazione, e il copione
//  l'avrebbe seguita solo perché il tour è nato dopo. Questa prova
//  confronta ogni hash dei copioni con il menu della sua sezione.
// ============================================================
import { gruppo, prova, vero, uguale } from './aiuto.mjs';
import { SEZIONI } from '../js/sezioni.js';

gruppo('Tour guidati');

// I copioni si caricano come li carica l'app: dalla proprietà `tour` della
// sezione, così la prova verifica anche che il percorso del file sia giusto.
const conTour = SEZIONI.filter(s => typeof s.tour === 'function');

// passi(ctx) riceve da app.js il ruolo dell'utente NELLA sezione: lo
// scadenziario ci aggiunge i passi riservati all'admin. Si provano entrambi
// i ruoli, perché un copione rotto in un solo ramo è comunque rotto.
const RUOLI = ['admin', 'operatore'];
const contesto = (ruolo) => ({ user: { id: 'prova', email: 'prova@cri.it', ruolo } });

// Tutti i copioni, un elenco per (sezione × ruolo).
async function copioni() {
  const out = [];
  for (const s of conTour) {
    const modulo = await s.tour();
    for (const ruolo of RUOLI) out.push({ sezione: s, ruolo, passi: modulo.passi(contesto(ruolo)) });
  }
  return out;
}

prova('ogni sezione già sviluppata ha il suo tour', () => {
  // Una sezione ancora da costruire non ha pagine da mostrare, quindi non ha
  // un tour: lo dichiara con `inSviluppo` in js/sezioni.js. È un'esenzione
  // esplicita, non un buco — il giorno in cui la sezione viene sviluppata si
  // toglie quel flag e questa prova chiede il tour.
  const senza = SEZIONI.filter(s => !s.inSviluppo && typeof s.tour !== 'function').map(s => s.id);
  uguale(senza, [], 'sezioni sviluppate senza tour');
});

prova('una sezione in sviluppo non promette pagine che non ha', () => {
  for (const s of SEZIONI.filter(x => x.inSviluppo)) {
    vero(!s.menu || !s.menu.length,
      `${s.id}: dichiara un menu ma è segnata in sviluppo — il router servirebbe comunque il segnaposto`);
    vero(typeof s.tour !== 'function',
      `${s.id}: ha un tour ma è segnata in sviluppo — toglile il flag`);
  }
});

prova('i copioni si caricano ed espongono dei passi', async () => {
  for (const s of conTour) {
    const modulo = await s.tour();
    vero(typeof modulo.passi === 'function', `${s.id}: il modulo non esporta passi()`);
  }
  for (const c of await copioni()) {
    vero(Array.isArray(c.passi) && c.passi.length >= 3,
      `${c.sezione.id} (${c.ruolo}): troppi pochi passi`);
  }
});

prova('ogni passo dice qualcosa: ha titolo e testo', async () => {
  for (const { sezione, ruolo, passi } of await copioni()) {
    passi.forEach((p, i) => {
      const dove = `${sezione.id} (${ruolo}), passo ${i + 1}`;
      vero(p.titolo && p.titolo.trim().length > 2, `${dove}: titolo mancante`);
      vero(p.testo && p.testo.trim().length > 20, `${dove}: testo mancante o troppo corto`);
      vero(p.hash || p.selettore, `${dove}: né hash né selettore, il passo non punta a niente`);
    });
  }
});

// Lo scadenziario è l'unica sezione le cui voci di menu NON stanno in
// js/sezioni.js: le costruisce js/app.js (navItemsPassive / navItemsAttive),
// perché si divide in due parti con menu diversi. Sono elencate qui a mano,
// e se cambiano lì questa prova fallisce: è il segnale, non un difetto.
const PAGINE_FUORI_DA_SEZIONI = {
  scadenziario: ['passive', 'attive', 'fatture', 'proposte', 'report', 'impostazioni'],
};

prova('gli hash puntano a pagine che esistono davvero nel menu', async () => {
  for (const { sezione: s, ruolo, passi } of await copioni()) {
    // Le pagine raggiungibili: le voci di menu, quelle che una voce dichiara
    // di coprire (attivoAnche) e, per lo scadenziario, quelle di app.js.
    const ammesse = new Set();
    for (const v of s.menu || []) {
      ammesse.add(v.id);
      for (const a of v.attivoAnche || []) ammesse.add(a);
    }
    for (const id of PAGINE_FUORI_DA_SEZIONI[s.id] || []) ammesse.add(id);
    for (const p of passi) {
      if (!p.hash) continue;
      const parti = p.hash.replace(/^#\//, '').split('/');
      uguale(parti[0], s.id, `${s.id} (${ruolo}): un passo naviga fuori dalla sua sezione (${p.hash})`);
      // Un hash può avere due segmenti dopo la sezione (#/scadenziario/
      // passive/fatture): basta che uno dei due sia una pagina conosciuta.
      const pagina = parti.slice(1).find(x => ammesse.has(x));
      vero(pagina !== undefined,
        `${s.id} (${ruolo}): il passo «${p.titolo}» punta a ${p.hash}, che non è una pagina di questa sezione`);
    }
  }
});

prova('il primo passo apre una pagina, invece di partire dove capita', async () => {
  for (const { sezione, ruolo, passi } of await copioni()) {
    vero(!!passi[0].hash, `${sezione.id} (${ruolo}): il primo passo non ha un hash`);
  }
});
