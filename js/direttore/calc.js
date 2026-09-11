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
  const a = Date.UTC(...scadenza.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  const b = Date.UTC(...da.split('-').map((n, i) => i === 1 ? Number(n) - 1 : Number(n)));
  return Math.round((a - b) / 86400000);
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
  return { testo: `fra ${Math.round(g / 30)} mesi`, stato: 'lontano' };
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
