// ============================================================
//  Lo stesso fornitore (o cliente) scritto in modi diversi
// ------------------------------------------------------------
//  "ENEL S.P.A." e "Enel SpA" sono lo stesso soggetto, e la partita IVA
//  letta dall'XML lo dice. Qui le due regole che usano Report e controllo
//  dei doppioni, in un posto solo per passive e attive:
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
