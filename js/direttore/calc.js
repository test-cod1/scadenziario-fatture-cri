// ============================================================
//  CALCOLI DELLA SEZIONE DIRETTORE
//  Un impegno porta tre informazioni: quanto è URGENTE (quanto preme il
//  tempo), quanto è IMPORTANTE (quanto pesa il risultato) e QUANDO scade.
//  Sono cose diverse e vanno tenute separate: la riunione di domani è
//  urgente ma può contare poco, il bilancio di fine anno è importante
//  mesi prima di essere urgente. Confonderle è il modo classico per
//  passare le giornate a spegnere incendi e non fare mai le cose che
//  contano.
//
//  Qui si tengono separate nel dato e si ricompongono in un punteggio
//  solo al momento di ORDINARE l'elenco, perché l'elenco uno sguardo
//  alla volta è uno solo e qualcosa deve pur stare in cima.
// ============================================================

export const LIVELLI = [
  { id: 'alta',  label: 'Alta',  peso: 3 },
  { id: 'media', label: 'Media', peso: 2 },
  { id: 'bassa', label: 'Bassa', peso: 1 },
];

export function livelloDi(id) { return LIVELLI.find(l => l.id === id) || LIVELLI[1]; }

// ---------- scadenze ----------
export function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Giorni che mancano a una scadenza: negativo se è passata, 0 se è oggi.
// Si confrontano le date come stringhe convertite a mezzogiorno UTC, per
// non farsi spostare il risultato dall'ora legale come succede sommando
// millisecondi.
export function giorniAllaScadenza(scadenza, da = oggiISO()) {
  if (!scadenza) return null;
  const a = Date.UTC(...String(scadenza).split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  const b = Date.UTC(...String(da).split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  const giorni = Math.round((a - b) / 86400000);
  // Una data che non si legge vale come nessuna data. Dal database non
  // può arrivare (la colonna è `date`), ma senza questo controllo il NaN
  // attraversava tutti i confronti di etichettaScadenza — sono tutti
  // falsi con NaN — e usciva dall'ultimo come «fra NaN mesi».
  return Number.isFinite(giorni) ? giorni : null;
}

// Come si chiama, a parole, il tempo che resta. È l'etichetta che va sul
// chip della scadenza: «scaduto da 3 giorni» dice qualcosa, «12/09» no.
export function etichettaScadenza(scadenza, da = oggiISO()) {
  const g = giorniAllaScadenza(scadenza, da);
  if (g === null) return { testo: 'senza scadenza', stato: 'nessuna' };
  if (g < -1) return { testo: `scaduto da ${-g} giorni`, stato: 'scaduto' };
  if (g === -1) return { testo: 'scaduto ieri', stato: 'scaduto' };
  if (g === 0) return { testo: 'scade oggi', stato: 'oggi' };
  if (g === 1) return { testo: 'scade domani', stato: 'vicino' };
  if (g <= 7) return { testo: `fra ${g} giorni`, stato: 'vicino' };
  if (g <= 30) return { testo: `fra ${g} giorni`, stato: 'lontano' };
  const mesi = Math.round(g / 30);
  return { testo: mesi === 1 ? 'fra un mese' : `fra ${mesi} mesi`, stato: 'lontano' };
}

// Quanto la scadenza spinge in avanti un impegno. Non sostituisce
// l'urgenza dichiarata — chi scrive l'impegno sa cose che il calendario
// non sa — ma le si somma: una cosa importante che scade domani deve
// salire sopra una urgente che scade fra un mese, altrimenti l'elenco
// mente.
export function spintaScadenza(scadenza, da = oggiISO()) {
  const g = giorniAllaScadenza(scadenza, da);
  if (g === null) return 0;      // senza data non spinge: non è "mai urgente", è "non detto"
  if (g < 0) return 12;          // già scaduto: sopra tutto
  if (g === 0) return 10;
  if (g <= 2) return 7;
  if (g <= 7) return 4;
  if (g <= 30) return 1;
  return 0;
}

// Il punteggio con cui si ordina l'elenco. L'importanza pesa il doppio
// dell'urgenza: fra due cose che premono uguale deve venire prima quella
// che conta di più, ed è la riga che separa questo elenco da una lista di
// scadenze qualsiasi.
export function punteggio(impegno, da = oggiISO()) {
  if (!impegno) return 0;
  const imp = livelloDi(impegno.importanza).peso;
  const urg = livelloDi(impegno.urgenza).peso;
  return imp * 6 + urg * 3 + spintaScadenza(impegno.scadenza, da);
}

// Ordinamento dell'elenco: prima quelli da fare, poi per punteggio, poi
// per scadenza più vicina, infine per titolo — così l'ordine è sempre lo
// stesso a parità di tutto, e due aperture di fila non mescolano le righe.
export function ordina(impegni, da = oggiISO()) {
  return [...(impegni || [])].sort((a, b) => {
    if (!!a.fatto !== !!b.fatto) return a.fatto ? 1 : -1;
    // Fra i fatti, i più recenti in cima: è un archivio, non una coda.
    if (a.fatto && b.fatto) return String(b.fatto_il || '').localeCompare(String(a.fatto_il || ''));
    const p = punteggio(b, da) - punteggio(a, da);
    if (p) return p;
    const sa = a.scadenza || '9999-12-31';
    const sb = b.scadenza || '9999-12-31';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return String(a.titolo || '').localeCompare(String(b.titolo || ''), 'it');
  });
}

// I numeri in testa alla pagina: quello che il direttore vuole sapere
// prima di leggere l'elenco.
export function totali(impegni, da = oggiISO()) {
  const t = { aperti: 0, scaduti: 0, oggi: 0, settimana: 0, senzaScadenza: 0, fatti: 0 };
  for (const i of impegni || []) {
    if (i.fatto) { t.fatti++; continue; }
    t.aperti++;
    const g = giorniAllaScadenza(i.scadenza, da);
    if (g === null) { t.senzaScadenza++; continue; }
    if (g < 0) t.scaduti++;
    else if (g === 0) t.oggi++;
    if (g >= 0 && g <= 7) t.settimana++;
  }
  return t;
}

// ---------- il mese, per il calendario ----------
//  Il calendario guarda le stesse scadenze dell'elenco da un'altra
//  angolazione: non «cosa pesa di più», ma «come sono distribuite nel
//  tempo». Serve a vedere la settimana ingorgata prima di prenderci un
//  altro impegno — una cosa che un elenco ordinato per peso non dice.
//
//  Un mese si scrive 'YYYY-MM': stessa forma degli <input type="month">,
//  si ordina come stringa e non porta con sé nessun fuso orario.

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export const GIORNI_SETTIMANA = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export function meseDi(iso) { return String(iso || '').slice(0, 7); }

export function meseValido(mese) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mese || '')); }

// Avanti o indietro di qualche mese, contando in mesi assoluti: sommare
// giorni a una data avrebbe fatto saltare il 31 gennaio direttamente a
// marzo, che è il classico modo di perdere un mese navigando.
export function spostaMese(mese, delta) {
  const [a, m] = String(mese).split('-').map(Number);
  const tot = a * 12 + (m - 1) + delta;
  return `${String(Math.floor(tot / 12)).padStart(4, '0')}-${String((tot % 12) + 1).padStart(2, '0')}`;
}

export function nomeMese(mese) {
  const [a, m] = String(mese).split('-').map(Number);
  return `${MESI[m - 1]} ${a}`;
}

// Come si legge una data intera, per il titolo del giorno scelto.
export function nomeGiorno(iso) {
  const [a, m, g] = String(iso).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, g));
  return `${GIORNI_SETTIMANA[(d.getUTCDay() + 6) % 7]} ${g} ${MESI[m - 1]} ${a}`;
}

// Le caselle del mese, in righe da sette a partire dal LUNEDÌ: prima i
// giorni del mese precedente che chiudono la prima settimana, poi il
// mese, poi quelli che aprono la successiva. Tutto in UTC, come il resto
// del file: con l'ora locale il 26 ottobre avrebbe due volte la stessa
// casella o nessuna.
export function grigliaMese(mese, oggi = oggiISO()) {
  const [a, m] = String(mese).split('-').map(Number);
  // getUTCDay() mette la domenica a 0; qui la settimana comincia di lunedì.
  const scarto = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
  const caselle = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(a, m - 1, 1 - scarto + i));
    const iso = d.toISOString().slice(0, 10);
    caselle.push({ iso, giorno: d.getUTCDate(), nelMese: iso.slice(0, 7) === mese, oggi: iso === oggi });
  }
  // Sei righe bastano sempre e quasi mai servono: l'ultima si toglie
  // quando è tutta del mese dopo, così il calendario non si porta dietro
  // una riga che non dice niente.
  while (caselle.length > 35 && !caselle.slice(-7).some(c => c.nelMese)) caselle.length -= 7;
  return caselle;
}

// Gli impegni raccolti per giorno di scadenza, già nell'ordine
// dell'elenco: dentro una casella larga poche righe conta quale si vede
// per prima. Quelli senza scadenza non stanno in nessuna casella — non
// sono «di oggi», sono «non datati», e si contano a parte.
export function perGiorno(impegni, da = oggiISO()) {
  const mappa = new Map();
  for (const i of impegni || []) {
    if (!i.scadenza) continue;
    const k = String(i.scadenza).slice(0, 10);
    if (!mappa.has(k)) mappa.set(k, []);
    mappa.get(k).push(i);
  }
  for (const righe of mappa.values()) righe.splice(0, righe.length, ...ordina(righe, da));
  return mappa;
}
