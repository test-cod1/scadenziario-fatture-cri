// ============================================================
//  QUANDO DUE NOMI SONO LO STESSO ENTE
//
//  Le fatture arrivano da import, da mani diverse e da anni diversi, e lo
//  stesso ente finisce scritto in modi che a occhio sono identici e per il
//  database sono due clienti: «COMUNE DI GENOVA ATS 35 CENTRO OVEST» e
//  «COMUNE DI GENOVA  ATS35 CENTRO OVEST», «FONDAZIONE L'ANCORA ONLUS» e
//  «FONDAZIONE L'ANCORA ETS». Finché restano due righe, ogni conto per
//  cliente è sbagliato — e il più sbagliato è quello che serve di più, la
//  concentrazione: due clienti da 50 al posto di uno da 100 fanno sembrare
//  il Comitato meno dipendente di quanto sia.
//
//  Qui dentro non si indovina niente. Ci sono tre regole, dalla più sicura
//  alla meno, e ognuna dice di sé quanto è sicura:
//
//    · `identico`   — stesso nome a meno di maiuscole e spazi. Non è un
//                     sospetto: è lo stesso nome scritto due volte.
//    · `probabile`  — stesso nome togliendo punteggiatura, spazi e forma
//                     giuridica (SRL, ONLUS, ETS, ODV…). «FONDAZIONE
//                     L'ANCORA ONLUS» diventata ETS è lo stesso ente che
//                     ha cambiato statuto, non un cliente nuovo.
//    · `da vedere`  — un nome è l'inizio dell'altro. Qui il dubbio è vero
//                     e va sciolto da una persona: «COMUNE DI GENOVA» e
//                     «COMUNE DI GENOVA ATS 41» POSSONO essere lo stesso
//                     ufficio scritto due volte, ma possono benissimo
//                     essere due centri di spesa distinti, e unirli
//                     sarebbe un errore peggiore di quello che si voleva
//                     correggere.
//
//  Le prime due si possono spuntare tutte insieme; la terza no, e chi usa
//  la pagina se la deve leggere una per una. Il modulo non tocca nessun
//  dato: dice solo che cosa assomiglia a che cosa.
// ============================================================

// Le forme giuridiche: sono l'etichetta dell'ente, non il suo nome, e fra
// due fatture possono cambiare senza che il cliente sia cambiato. Si
// tolgono solo per CONFRONTARE: nelle fatture restano scritte.
const FORME = new Set([
  'SRL', 'SRLS', 'SPA', 'SPS', 'SNC', 'SAS', 'SCS', 'SCARL', 'SCRL',
  'SOC', 'SOCIETA', 'COOP', 'COOPERATIVA', 'ONLUS', 'ETS', 'ODV', 'APS',
  'ASD', 'SSD', 'SSDRL', 'APSETS', 'IMPRESA', 'SOCIALE',
]);

// Gli accenti e gli apostrofi tipografici: «UNIVERSITÀ», «UNIVERSITA'» e
// «UNIVERSITA’» sono la stessa parola battuta su tre tastiere diverse.
function senzaSegni(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'");
}

// La chiave "larga": maiuscole e spazi. È quella che usa anche il report
// del fatturato per raggruppare i clienti, e le due devono restare la
// stessa funzione — se divergessero, la pagina direbbe «doppio» di una
// coppia che il report ha già unito da sé, o il contrario.
export function chiaveCliente(nome) {
  return senzaSegni(nome).trim().toUpperCase().split(/\s+/).filter(Boolean).join(' ') || '—';
}

// La chiave "stretta": via la punteggiatura, via la forma giuridica, via
// tutti gli spazi. Serve a far coincidere «ATS 35» con «ATS35» e
// «S.R.L.» con «SRL». Gli spazi si tolgono tutti e non solo quelli fra
// sigla e numero: distinguere i casi avrebbe richiesto una regola per
// ciascuno, e in questo archivio due enti diversi che diventano uguali
// togliendo gli spazi non esistono.
export function chiaveStretta(nome) {
  const parole = senzaSegni(nome).toUpperCase()
    // I punti si tolgono PRIMA, e senza lasciare uno spazio al loro posto:
    // «S.R.L.» deve diventare «SRL» e non tre lettere sciolte, altrimenti
    // la forma giuridica non viene riconosciuta e «PETERCOM S.R.L.» non
    // coincide con «PETERCOM SRL» — che è esattamente la coppia per cui
    // questa chiave esiste.
    .replace(/\./g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .filter(p => !FORME.has(p));
  return parole.join('') || chiaveCliente(nome);
}

// Il nome è l'inizio dell'altro, contando le parole e non le lettere:
// «ATS 4» non deve risultare l'inizio di «ATS 41». Si richiedono almeno
// due parole in comune, altrimenti ogni «COMUNE …» finirebbe nello stesso
// mucchio.
export function unoIniziaLAltro(a, b) {
  const pa = chiaveCliente(a).split(' ');
  const pb = chiaveCliente(b).split(' ');
  const corto = pa.length <= pb.length ? pa : pb;
  const lungo = corto === pa ? pb : pa;
  if (corto.length < 2 || corto.length === lungo.length) return false;
  return corto.every((p, i) => p === lungo[i]);
}

// ---------- dai nomi ai gruppi ----------

// L'elenco delle grafie davvero presenti, con quanto pesa ciascuna: il
// numero di fatture e il totale, perché la grafia da tenere è quasi sempre
// quella usata di più, e chi decide vuole sapere quante righe muove.
//
// `grafie` tiene i valori COME STANNO nel database, con quante fatture
// ciascuno: «ASL 3 » con lo spazio in coda, la stringa vuota o il null che
// a schermo diventano «—». Il nome mostrato è ripulito, ma la rinomina
// cerca il valore esatto: se cercasse quello ripulito non troverebbe
// niente, e l'unificazione riuscirebbe senza aver toccato una riga.
export function variantiDi(fatture = [], campo = 'cliente') {
  const m = new Map();
  for (const f of fatture) {
    const grezzo = f[campo] ?? null;
    const nome = String(grezzo ?? '').trim();
    const k = nome || '—';
    if (!m.has(k)) m.set(k, { nome: k, n: 0, importo: 0, ultima: null, grafie: [] });
    const v = m.get(k);
    const g = v.grafie.find(x => x.valore === grezzo);
    if (g) g.n++; else v.grafie.push({ valore: grezzo, n: 1 });
    v.n++;
    v.importo += Number(f.importo || 0);
    if (f.data_fattura && (!v.ultima || f.data_fattura > v.ultima)) v.ultima = f.data_fattura;
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

// I gruppi di grafie che con ogni probabilità sono lo stesso ente.
// Si uniscono a catena: se A e B sono identici e B e C probabili, i tre
// stanno nello stesso gruppo — ed è giusto, perché sono lo stesso ente
// visto da due regole diverse. Il gruppo porta la certezza della regola
// PIÙ DEBOLE che è servita a tenerlo insieme: un gruppo è sicuro solo se
// lo è ogni legame che lo compone.
export function gruppiDoppi(varianti = []) {
  const n = varianti.length;
  const padre = varianti.map((_, i) => i);
  const trova = i => (padre[i] === i ? i : (padre[i] = trova(padre[i])));
  // La certezza di ogni gruppo, tenuta sulla radice: 3 identico,
  // 2 probabile, 1 da vedere.
  const forza = new Map();

  const unisci = (i, j, f) => {
    const ri = trova(i), rj = trova(j);
    const minimo = Math.min(f, forza.get(ri) ?? 3, forza.get(rj) ?? 3);
    if (ri === rj) { forza.set(ri, minimo); return; }
    padre[rj] = ri;
    forza.set(ri, minimo);
    forza.delete(rj);
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = varianti[i].nome, b = varianti[j].nome;
      if (chiaveCliente(a) === chiaveCliente(b)) unisci(i, j, 3);
      else if (chiaveStretta(a) === chiaveStretta(b)) unisci(i, j, 2);
      else if (unoIniziaLAltro(a, b)) unisci(i, j, 1);
    }
  }

  const per = new Map();
  for (let i = 0; i < n; i++) {
    const r = trova(i);
    if (!per.has(r)) per.set(r, []);
    per.get(r).push(varianti[i]);
  }

  const CERTEZZE = { 3: 'identico', 2: 'probabile', 1: 'da vedere' };
  return [...per.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([r, v]) => {
      const membri = [...v].sort((a, b) => b.n - a.n
        || b.nome.length - a.nome.length
        || a.nome.localeCompare(b.nome, 'it'));
      return {
        id: chiaveStretta(membri[0].nome),
        certezza: CERTEZZE[forza.get(r) ?? 3],
        // La grafia proposta è quella usata di più; a pari uso vince la
        // più lunga, che è quasi sempre la più completa («PORTO ANTICO DI
        // GENOVA» dice più di «PORTO ANTICO»). Resta una proposta: chi
        // usa la pagina può scriverne un'altra.
        proposta: membri[0].nome,
        membri,
        fatture: membri.reduce((s, m) => s + m.n, 0),
        importo: membri.reduce((s, m) => s + m.importo, 0),
      };
    })
    // Prima i casi sicuri (si spuntano e via), poi quelli da leggere; a
    // parità, chi muove più fatture.
    .sort((a, b) => ordine(a.certezza) - ordine(b.certezza)
      || b.fatture - a.fatture
      || a.proposta.localeCompare(b.proposta, 'it'));
}

function ordine(certezza) {
  return certezza === 'identico' ? 0 : certezza === 'probabile' ? 1 : 2;
}
