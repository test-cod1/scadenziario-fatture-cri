// ============================================================
//  RICERCA FRA LE PUBBLICHE AMMINISTRAZIONI (IndicePA)
//  I clienti delle assistenze sono spesso Comuni, Municipi, scuole o ASL: di
//  loro l'elenco ufficiale di AgID dà denominazione esatta, codice fiscale e
//  sede, cioè i tre campi del destinatario che si copiavano a mano.
//
//  I dati stanno in due file generati da tools/genera-enti-pa.js e non
//  arrivano da un servizio interrogato mentre si scrive: nessuna chiave da
//  custodire, nessuna richiesta verso terzi (che porterebbe fuori il nome di
//  chi stiamo cercando), e la ricerca funziona anche con la rete lenta.
//
//  Si parte dalla Liguria — 618 enti, 18 KB — e l'elenco nazionale (23.000
//  enti, 760 KB) si scarica solo se lo si chiede espressamente.
// ============================================================

const FILE = {
  liguria: '/assets/enti-pa-liguria.json',
  italia: '/assets/enti-pa.json',
};

const caricati = {};   // ambito → { enti, aggiornato }

// Il nome ufficiale di un ente è scritto come capita ("Comune di Sant'Olcese",
// "I.C. Sampierdarena"): per confrontarlo con quello che si digita si tolgono
// accenti, punteggiatura e doppi spazi da entrambe le parti.
function normalizza(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function carica(ambito) {
  if (caricati[ambito]) return caricati[ambito];
  const res = await fetch(FILE[ambito]);
  if (!res.ok) throw new Error(`Elenco enti non disponibile (${res.status})`);
  const dati = await res.json();
  const enti = dati.enti.map(([nome, cf, indirizzo, cap, comune, provincia]) => ({
    nome, cf, indirizzo, cap, comune, provincia,
    chiave: normalizza(nome + ' ' + comune),
  }));
  caricati[ambito] = { enti, aggiornato: dati.aggiornato, fonte: dati.fonte };
  return caricati[ambito];
}

export function giaCaricato(ambito) {
  return !!caricati[ambito];
}

export function informazioniFonte() {
  const primo = caricati.liguria || caricati.italia;
  return primo ? { fonte: primo.fonte, aggiornato: primo.aggiornato } : null;
}

function raccogli(enti, parole, q) {
  const trovati = [];
  for (const e of enti) {
    if (!parole.every(p => e.chiave.includes(p))) continue;
    let punti = 0;
    if (e.chiave.startsWith(q)) punti += 100;
    else if (e.chiave.includes(' ' + q)) punti += 50;
    // Una parola all'inizio del nome conta più della stessa parola infilata
    // in fondo: "Comune di Genova" prima di "Città metropolitana di Genova".
    if (parole.some(p => e.chiave.startsWith(p))) punti += 20;
    // Un nome corto che contiene tutto quello che si è scritto è più
    // probabilmente quello giusto di uno lunghissimo che lo contiene per caso.
    punti += Math.max(0, 40 - e.nome.length / 3);
    trovati.push({ ente: e, punti });
    if (trovati.length > 400) break;   // oltre non serve: si ordina e si taglia
  }
  return trovati;
}

// Seconda passata: basta una delle parole selettive, e le parole non valgono
// tutte uguale. Una parola che compare in un nome solo dice quasi certamente
// quale ente si cerca; una che ne conta duecento dice poco — così cercando
// "scuola Sampierdarena" in tutta Italia vince l'istituto di Sampierdarena e
// non la prima "Scuola" dell'elenco.
function raccogliParziale(enti, pesate, q) {
  const trovati = [];
  for (const e of enti) {
    let punti = 0;
    for (const { parola, peso } of pesate) if (e.chiave.includes(parola)) punti += peso;
    if (!punti) continue;
    trovati.push({ ente: e, punti: punti * 30 + Math.max(0, 40 - e.nome.length / 3) });
    if (trovati.length > 400) break;
  }
  return trovati;
}

// Tutte le parole digitate devono comparire nel nome (in qualunque ordine):
// "genova comune" trova "Comune di Genova", che è come la gente cerca.
// Il punteggio serve solo a mettere in cima le corrispondenze più probabili.
export async function cercaEnti(query, { ambito = 'liguria', max = 8 } = {}) {
  const q = normalizza(query);
  if (q.length < 3) return [];
  const parole = q.split(' ');
  const { enti } = await carica(ambito);

  // Due passate. Nella prima devono comparire tutte le parole digitate. Se
  // non salta fuori niente si cercano gli enti che contengono ALMENO una
  // delle parole che discriminano, perché il nome che uno ha in testa è
  // quasi sempre più ricco di quello registrato: "scuola Sampierdarena" non
  // esiste in elenco, ma "I.C. SAMPIERDARENA" sì.
  //
  // "Discriminano" significa: non le parole generiche. "comune" sta in un
  // nome ligure su tre, quindi cercando "comune di Torino" fuori regione
  // riempiva l'elenco di comuni qualsiasi come se il paese non contasse:
  // meglio nessun risultato, che porta al passo successivo (l'elenco
  // nazionale) invece di far scegliere una risposta sbagliata.
  let trovati = raccogli(enti, parole, q);
  if (!trovati.length && parole.length > 1) {
    const soglia = enti.length * 0.05;
    const pesate = [];
    for (const parola of parole) {
      if (parola.length < 4) continue;
      const quanti = enti.filter(e => e.chiave.includes(parola)).length;
      if (!quanti || quanti > soglia) continue;
      pesate.push({ parola, peso: Math.log(enti.length / (1 + quanti)) });
    }
    if (pesate.length) trovati = raccogliParziale(enti, pesate, q);
  }
  return trovati
    .sort((a, b) => b.punti - a.punti || a.ente.nome.localeCompare(b.ente.nome, 'it'))
    .slice(0, max)
    .map(t => t.ente);
}

// Indirizzo su una riga, come va nell'intestazione del preventivo.
export function indirizzoCompleto(e) {
  const dopo = [e.cap, e.comune].filter(Boolean).join(' ');
  const prov = e.provincia ? ` (${e.provincia})` : '';
  return [e.indirizzo, dopo + prov].filter(x => x && x.trim()).join(', ');
}
