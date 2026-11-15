// ============================================================
//  Chiavi di sessionStorage con cui i Report passano un filtro all'elenco
//  fatture (clic su un fornitore/cliente → elenco già filtrato), e le poche
//  regole pure che Report ed elenco devono applicare allo stesso modo.
//  Stanno qui e non nei report perché le dashboard le leggono all'apertura:
//  importarle da views/report.js obbligava a scaricare tutto il report solo
//  per due stringhe. Niente DOM: le provano i test in Node.
// ============================================================
import { normNome } from './soggetti.js';

export const FILTRO_FORNITORE_KEY = 'report:filtroFornitore';
export const FILTRO_CLIENTE_KEY = 'reportAttive:filtroCliente';

// ------------------------------------------------------------
//  Filtro "questo soggetto", dal Report all'elenco
// ------------------------------------------------------------
//  Il Report raggruppa per partita IVA (lib/soggetti.js): "ENEL S.P.A." ed
//  "Enel SpA" sono una riga sola. Il clic passava però all'elenco il solo
//  nome prevalente come testo da cercare, e le fatture scritte con l'altra
//  grafia restavano fuori: il totale del Report non tornava con l'elenco.
//  Con la partita IVA si passa quindi il gruppo intero (partita IVA e nomi
//  usati); senza, il nome come testo, come prima (il gruppo è fatto proprio
//  da quel nome).
export function valoreFiltroSoggetto(gruppo, campoNome) {
  const nome = gruppo.nome === '—' ? '' : gruppo.nome;
  if (!gruppo.partita_iva) return nome;
  const nomi = [...new Set(gruppo.righe.map(f => normNome(f[campoNome])).filter(Boolean))];
  return JSON.stringify({ nome, partita_iva: gruppo.partita_iva, nomi });
}

// Il contrario: { testo } per un filtro di solo testo (anche quelli salvati
// dalle versioni precedenti), { nome, partita_iva, nomi } per un gruppo.
export function leggiFiltroSoggetto(valore) {
  const v = String(valore == null ? '' : valore);
  if (v.startsWith('{')) {
    try {
      const o = JSON.parse(v);
      if (o && o.partita_iva) return { nome: String(o.nome || ''), partita_iva: String(o.partita_iva), nomi: Array.isArray(o.nomi) ? o.nomi : [] };
    } catch { /* non era un gruppo: lo si tratta come testo */ }
  }
  return { testo: v };
}

// Stessa regola di raggruppaPerSoggetto: chi ha la partita IVA sta nel
// gruppo se è quella; chi non ce l'ha (fatture registrate prima della
// colonna, inserimenti a mano) se il suo nome è uno di quelli del gruppo.
export function nelSoggetto(filtro, fattura, campoNome) {
  if (fattura.partita_iva) return fattura.partita_iva === filtro.partita_iva;
  return filtro.nomi.includes(normNome(fattura[campoNome]));
}

// ------------------------------------------------------------
//  Rate F24 nel Report delle passive
// ------------------------------------------------------------
//  Nello scadenziario si registrano anche le rate dei modelli F24 (imposte),
//  per non dimenticarne la scadenza: non sono fatture, e sommate al
//  "Fatturato" e alla "Spesa per fornitore" gonfiavano la spesa verso i
//  fornitori con le tasse. Il Report le tiene a parte.
export function separaF24(righe) {
  const fatture = [], f24 = [];
  for (const f of righe) (f.tipo_documento === 'f24' ? f24 : fatture).push(f);
  return { fatture, f24 };
}
