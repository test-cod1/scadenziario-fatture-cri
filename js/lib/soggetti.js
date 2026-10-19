// ============================================================
//  Lo stesso fornitore (o cliente) scritto in modi diversi
// ------------------------------------------------------------
//  "ENEL S.P.A." e "Enel SpA" sono lo stesso soggetto, e la partita IVA
//  letta dall'XML lo dice. Qui le regole che usano Report, controllo dei
//  doppioni e abbinamento delle note di credito, per passive e attive:
//    - due fatture sono dello stesso soggetto se hanno la stessa partita
//      IVA; se a una delle due manca, decide il nome (normalizzato);
//    - una fattura vecchia senza partita IVA si aggrega al gruppo della
//      partita IVA che altre fatture con lo STESSO nome hanno, così le
//      fatture registrate prima della colonna non finiscono in una riga a
//      parte.
// ============================================================

export function normNome(v) {
  return String(v || '').trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

// Raggruppa `righe` per soggetto. Ritorna [{ nome, partita_iva, righe }]:
// `nome` è quello usato più spesso nel gruppo (a parità, il più recente).
export function raggruppaPerSoggetto(righe, campoNome) {
  const pivaDelNome = new Map();
  for (const f of righe) if (f.partita_iva) pivaDelNome.set(normNome(f[campoNome]), f.partita_iva);

  const gruppi = new Map();
  for (const f of righe) {
    const piva = f.partita_iva || pivaDelNome.get(normNome(f[campoNome])) || null;
    const chiave = piva ? 'piva:' + piva : 'nome:' + (f[campoNome] || '—');
    let g = gruppi.get(chiave);
    if (!g) { g = { partita_iva: piva, righe: [], nomi: new Map() }; gruppi.set(chiave, g); }
    g.righe.push(f);
    const nome = f[campoNome] || '—';
    const n = g.nomi.get(nome) || { volte: 0, data: '' };
    n.volte++;
    if ((f.data_fattura || '') > n.data) n.data = f.data_fattura || '';
    g.nomi.set(nome, n);
  }
  return [...gruppi.values()].map(g => {
    const [nome] = [...g.nomi.entries()].sort((a, b) => b[1].volte - a[1].volte || b[1].data.localeCompare(a[1].data))[0];
    return { nome, partita_iva: g.partita_iva, righe: g.righe };
  });
}

// ------------------------------------------------------------
//  Nota di credito → fatture che storna
// ------------------------------------------------------------
//  L'XML di una nota di credito dice quali fatture storna
//  (DatiFattureCollegate: numero e, spesso, data). Qui le si cerca fra le
//  fatture registrate, con prudenza:
//    - stesso numero (senza badare a spazi, maiuscole e separatori: "12/2026"
//      e "12-2026" sono lo stesso numero scritto da due gestionali);
//    - stesso soggetto: la partita IVA, o il nome se una delle due non ce
//      l'ha. Il solo numero non basta: fornitori diversi usano le stesse
//      numerazioni ("1", "2"…), e stornare la fattura sbagliata è peggio
//      che lasciar scegliere a mano;
//    - se restano più candidate, decide la data; se ancora non basta, la
//      fattura non si sceglie da sola.
//  L'importo: con una sola fattura collegata, tutto il totale della nota;
//  con più fatture, a ognuna fino al suo residuo, e l'eventuale resto
//  all'ultima — ma solo se le si è trovate tutte. Se ne manca qualcuna, il
//  resto non si assegna: spetta a quella mancante, che si sceglie a mano.
// ------------------------------------------------------------
const normNumero = (v) => String(v || '').toLowerCase().replace(/[^0-9a-z]/g, '');
const centesimi = (n) => Math.round(n * 100) / 100;

export function abbinaNotaCredito({ fatture, collegate, partita_iva, nome, campoNome, importo }) {
  const abbinate = [];
  const mancanti = [];
  const ambigue = [];
  const giaPresa = new Set();

  const stessoSoggetto = (f) => (partita_iva && f.partita_iva)
    ? f.partita_iva === partita_iva
    : normNome(f[campoNome]) === normNome(nome);

  for (const c of collegate || []) {
    let candidate = fatture.filter(f => f.stato !== 'stornata' && !giaPresa.has(f.id)
      && normNumero(f.numero_fattura) === normNumero(c.numero) && stessoSoggetto(f));
    if (candidate.length > 1 && c.data) {
      const stessaData = candidate.filter(f => f.data_fattura === c.data);
      if (stessaData.length) candidate = stessaData;
    }
    if (candidate.length === 1) { abbinate.push({ fattura: candidate[0], importo: 0 }); giaPresa.add(candidate[0].id); }
    else if (candidate.length > 1) ambigue.push(c.numero);
    else mancanti.push(c.numero);
  }

  let resto = Number(importo) || 0;
  abbinate.forEach((a, i) => {
    const ultima = i === abbinate.length - 1 && !mancanti.length && !ambigue.length;
    const quota = ultima ? resto : Math.min(resto, Math.max(0, Number(a.fattura._residuo) || 0));
    a.importo = centesimi(Math.max(0, quota));
    resto = centesimi(resto - a.importo);
  });
  return { abbinate, mancanti, ambigue };
}
