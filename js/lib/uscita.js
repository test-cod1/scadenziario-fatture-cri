// ============================================================
//  MODIFICHE NON SALVATE
//  Un editor (un preventivo, il tariffario) tiene il lavoro in memoria fino
//  al clic su "Salva": uscendo prima, quel lavoro sparisce. Qui si sorveglia
//  l'uscita in tutti i modi in cui può avvenire:
//
//    - un link interno del menu o della pagina  → clic intercettato
//    - la chiusura o il ricaricamento della scheda → avviso del browser
//    - il tasto "indietro" → una voce di cronologia messa lì apposta
//
//  Il tasto "indietro" è quello che costava di più: il router disegna la
//  pagina nuova appena l'hash cambia, quindi quando ci si accorge dell'uscita
//  l'editor non c'è già più. Alla prima modifica si aggiunge allora una voce
//  di cronologia sullo stesso indirizzo: il primo "indietro" consuma quella,
//  la pagina non cambia (stesso hash: il router non fa nulla) e si fa in
//  tempo a chiedere.
// ============================================================
import { confirmDialog } from './ui.js';

const DOMANDA = 'Ci sono modifiche non salvate: uscendo si perdono. Vuoi uscire lo stesso?';
const OPZIONI = { danger: true, okLabel: 'Esci senza salvare' };

let stato = null;        // { nodo, cSporco } dell'editor in pagina
let guardia = false;     // c'è una nostra voce di cronologia in cima?
let chiedendo = false;   // dialogo già aperto: non se ne aprono due

// La sorveglianza vale solo per l'editor ancora in pagina: quando il router
// disegna un'altra vista, il nodo dell'editor non è più attaccato al
// documento. Dev'essere un nodo CREATO dalla vista, non il contenitore #view
// che il router riempie e svuota: quello resta collegato per sempre, e un
// editor abbandonato avrebbe continuato a far comparire l'avviso altrove.
function attivo() {
  return !!stato && stato.nodo.isConnected;
}

export function ciSonoModificheNonSalvate() {
  return attivo() && stato.cSporco();
}

// Da chiamare quando l'editor diventa "sporco": arma la voce di cronologia
// che permette di intercettare il tasto "indietro". Chiamarla più volte non
// aggiunge altre voci.
export function armaGuardiaIndietro() {
  if (guardia || !attivo()) return;
  history.pushState(null, '', location.href);
  guardia = true;
}

export function sorvegliaUscita(nodo, cSporco) {
  stato = { nodo, cSporco };
  // La voce di cronologia dell'editor precedente non vale per questo: la
  // guardia si riarma alla prima modifica di quello nuovo.
  guardia = false;

  if (sorvegliaUscita._installata) return;
  sorvegliaUscita._installata = true;

  // Chiusura o ricaricamento della scheda: il browser mostra il suo avviso
  // (il testo non è personalizzabile, lo decide lui).
  window.addEventListener('beforeunload', (e) => {
    if (ciSonoModificheNonSalvate()) { e.preventDefault(); e.returnValue = ''; }
  });

  // Qualunque link interno: si ferma la navigazione e si chiede.
  document.addEventListener('click', (e) => {
    if (!ciSonoModificheNonSalvate()) return;
    const a = e.target.closest('a[href^="#/"]');
    if (!a) return;
    const destinazione = a.getAttribute('href');
    if (destinazione === location.hash) return;
    e.preventDefault();
    e.stopPropagation();
    chiedi().then(ok => { if (ok) { abbandona(); location.hash = destinazione; } });
  }, true);

  window.addEventListener('popstate', onIndietro);
}

function onIndietro() {
  if (!guardia) return;          // voce non nostra: il router faccia il suo lavoro
  guardia = false;
  if (!ciSonoModificheNonSalvate()) {
    // Salvato nel frattempo (o editor già chiuso): il tasto "indietro"
    // dev'essere andato indietro davvero, non consumare la nostra voce e
    // basta, lasciando la pagina com'era.
    history.back();
    return;
  }
  // Si rimette la voce appena consumata: la pagina resta dov'è mentre si
  // chiede, e se l'utente resta la guardia è di nuovo al suo posto.
  history.pushState(null, '', location.href);
  guardia = true;
  chiedi().then(ok => {
    if (!ok) return;
    abbandona();
    // Due voci da risalire: quella rimessa qui sopra e quella dell'editor.
    history.go(-2);
  });
}

function chiedi() {
  if (chiedendo) return Promise.resolve(false);
  chiedendo = true;
  return confirmDialog(DOMANDA, OPZIONI).finally(() => { chiedendo = false; });
}

// L'utente ha scelto di uscire: da qui in poi non si sorveglia più nulla,
// altrimenti la navigazione che stiamo per fare verrebbe intercettata da noi
// stessi.
function abbandona() {
  stato = null;
  guardia = false;
}

// Da chiamare dopo un salvataggio riuscito, PRIMA di cambiare pagina da
// codice (ctx.go, location.hash): smonta la sorveglianza e la voce di
// cronologia della guardia. Senza, la navigazione fatta dall'editor viene
// scambiata per un "indietro" — assegnare location.hash dopo una pushState
// fa scattare anche popstate — e onIndietro riporta l'utente sull'editor
// appena salvato, come se il salvataggio non avesse cambiato pagina.
export function smettiDiSorvegliare() {
  abbandona();
}
