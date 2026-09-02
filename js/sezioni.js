// ============================================================
//  SEZIONI DEL PORTALE
//  Elenco unico da cui si generano la home, il menu laterale e il pannello
//  delle autorizzazioni: aggiungere una sezione qui (con lo stesso id
//  presente nella tabella public.sezioni su Supabase) la fa comparire in
//  tutti e tre i posti senza altre modifiche.
//
//  tipo:
//    'interna' → la sezione vive dentro questo portale, su #/<id>/...
//    'esterna' → la card apre un altro gestionale già online (url); il
//                permesso continua a essere gestito da qui, ma i dati stanno
//                a casa loro. Al momento nessuna sezione lo usa: i trasporti
//                lunghi, che erano l'unico caso, sono stati assorbiti nel
//                portale.
// ============================================================

// Icone delle card, disegnate a mano in SVG: alla dimensione della home le
// emoji cambiano forma e colore da un sistema all'altro, mentre qui il tratto
// è lo stesso ovunque e segue il colore del testo. Nel menu laterale, dove
// sono grandi come una riga di testo, si usa invece l'emoji del campo
// `emoji`: costa niente e sulla barra del telefono si legge meglio.
const ICONE = {
  scadenziario: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="5" y="3" width="23" height="30" rx="3"/><path d="M11 12h11M11 19h7M11 26h9"/></svg>`,
  formazione: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 3 27 12 18 21 9 12Z"/><path d="M18 21v5"/><path d="M7 26h22"/><circle cx="18" cy="31" r="2.4"/></svg>`,
  trasporti: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2" y="9" width="18" height="13" rx="2"/><path d="M20 13h6l6 5v4H20z"/><circle cx="9" cy="27" r="3.2"/><circle cx="25" cy="27" r="3.2"/></svg>`,
  assistenze: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 3 30 7v10c0 7.6-5 13.2-12 16-7-2.8-12-8.4-12-16V7z"/><path d="M18 12v10M13 17h10"/></svg>`,
};

export const SEZIONI = [
  {
    id: 'scadenziario',
    label: 'Scadenziario',
    descrizione: 'Fatture fornitori e clienti, scadenze e proposte di pagamento.',
    emoji: '🧾',
    colore: '#e30613',
    ombra: 'rgba(227,6,19,.25)',
    tipo: 'interna',
    // Rotta di ingresso: lo scadenziario ha due sotto-sezioni (passive/attive)
    // e parte dalle passive, come faceva quando era l'intera applicazione.
    home: '#/scadenziario/passive/fatture',
    // Copione del tour guidato (js/tour/): il pulsante 🎓 compare solo nelle
    // sezioni che ne dichiarano uno, e il file si carica al primo clic.
    tour: () => import('./tour/scadenziario.js'),
    icona: ICONE.scadenziario,
  },
  {
    id: 'formazione',
    label: 'Formazione Esterna',
    descrizione: 'Corsi erogati all’esterno: edizioni, iscritti e attestati.',
    emoji: '🎓',
    colore: '#1a1d23',
    ombra: 'rgba(0,0,0,.2)',
    tipo: 'interna',
    home: '#/formazione',
    icona: ICONE.formazione,
  },
  {
    id: 'trasporti',
    label: 'Trasporti lunghi',
    descrizione: 'Preventivi per i trasporti sanitari fuori Genova.',
    emoji: '🚐',
    colore: '#6b7280',
    ombra: 'rgba(0,0,0,.15)',
    tipo: 'interna',
    home: '#/trasporti/preventivi',
    tour: () => import('./tour/trasporti.js'),
    // Menu interno della sezione (barra laterale, e barra in basso sul
    // telefono). Le impostazioni sono qui e non fra le voci riservate agli
    // admin perché sono i parametri di calcolo di tutti i giorni: nel
    // gestionale da cui arriva questa sezione li modificava anche
    // l'operatore, e cambiare la regola nel trasloco avrebbe tolto una
    // funzione a chi la usava.
    menu: [
      { id: 'preventivi', icon: '📋', label: 'Preventivi', attivoAnche: ['preventivo'] },
      { id: 'nuovo', icon: '➕', label: 'Nuovo preventivo' },
      { id: 'impostazioni', icon: '⚙️', label: 'Impostazioni' },
    ],
    icona: ICONE.trasporti,
  },
  {
    id: 'assistenze',
    label: 'Assistenze sanitarie',
    descrizione: 'Servizi di assistenza a manifestazioni ed eventi.',
    emoji: '⛑️',
    colore: '#374151',
    ombra: 'rgba(0,0,0,.18)',
    tipo: 'interna',
    home: '#/assistenze/preventivi',
    menu: [
      { id: 'preventivi', icon: '📋', label: 'Preventivi', attivoAnche: ['preventivo'] },
      { id: 'nuovo', icon: '➕', label: 'Nuovo preventivo' },
      { id: 'impostazioni', icon: '⚙️', label: 'Impostazioni' },
    ],
    icona: ICONE.assistenze,
  },
];

export function getSezione(id) {
  return SEZIONI.find(s => s.id === id) || null;
}

// Ruolo dell'utente in una sezione: 'admin', 'operatore' o null se non vi ha
// accesso. Il super admin è admin ovunque, esattamente come nella funzione
// ruolo_sezione() lato database: le due regole devono restare identiche,
// quella lato server è l'unica che protegge davvero i dati.
export function ruoloIn(user, sezioneId) {
  if (!user) return null;
  if (user.ruoloPortale === 'super_admin') return 'admin';
  return user.sezioni?.[sezioneId] || null;
}

export function puoAccedere(user, sezioneId) {
  return ruoloIn(user, sezioneId) !== null;
}

// Sezioni a cui l'utente ha effettivamente accesso, nell'ordine dell'elenco.
export function sezioniAutorizzate(user) {
  return SEZIONI.filter(s => puoAccedere(user, s.id));
}
