// ============================================================
//  Proposte di pagamento: totale e testo per il presidente
//  Il totale delle proposte in attesa (sommato in centesimi, così non
//  si accumulano gli arrotondamenti) e l'elenco da copiare e mandare al
//  presidente: una riga per fattura proposta — fornitore, numero, data e
//  importo — e in fondo il totale. Testo semplice, da incollare in una
//  mail o in un messaggio. `righe` sono gli elementi di proposte.list().
// ============================================================
import { euroTesto, dataTesto } from './ritenute.js';

const cent = (n) => Math.round((Number(n) || 0) * 100);

export function totaleProposte(righe) {
  return righe.reduce((s, r) => s + cent(r.importo), 0) / 100;
}

export function testoPresidente(righe) {
  const totale = totaleProposte(righe);
  const elenco = righe.map((r, i) => {
    const f = r.fatture || {};
    const doc = [f.numero_fattura ? `fattura n. ${f.numero_fattura}` : 'fattura', f.data_fattura ? `del ${dataTesto(f.data_fattura)}` : '']
      .filter(Boolean).join(' ');
    return `${i + 1}. ${f.fornitore || 'Fornitore non indicato'} — ${doc} — ${euroTesto(r.importo)}`;
  });
  // Solo l'elenco e il totale, senza oggetto né saluti: il resto del
  // messaggio lo scrive chi lo manda.
  return [...elenco, '', `Totale: ${euroTesto(totale)}`].join('\n');
}
