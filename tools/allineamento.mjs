// ============================================================
//  ALLINEARE L'ARCHIVIO A UN REGISTRO DI FATTURAZIONE — le regole.
//
//  Sta in un file a parte da chi parla con il database (che è
//  tools/allinea-fatture-attive.mjs) per una ragione sola: queste regole
//  decidono che cosa viene CANCELLATO, e vanno potute provare senza
//  toccare niente. Qui dentro non c'è una riga di rete: entra quello che
//  c'è in archivio e quello che dice il registro, esce un piano.
//
//  LA CHIAVE È NUMERO + ANNO, non numero + data. In un registro di
//  vendita il numero non si ripete dentro l'anno, mentre le date già in
//  archivio non sono affidabili: la fattura n. 1 risultava caricata al
//  28/01/2026 e il registro la dà al 14/01/2026. Cercandole per data
//  sarebbero risultate tutte mancanti, e le avremmo inserite una seconda
//  volta — cioè proprio il doppione che si vuole togliere.
// ============================================================

// Gli zeri iniziali si tolgono perché «007» e «7» sono la stessa fattura
// scritta da due programmi diversi.
export function chiave(numero, data) {
  const n = String(numero ?? '').trim().toUpperCase().replace(/^0+/, '') || '?';
  const a = String(data || '').slice(0, 4) || '?';
  return `${n}/${a}`;
}

// Una riga di CSV nei suoi campi, rispettando le virgolette: un nome di
// cliente con dentro un punto e virgola è raro ma esiste, e spezzarlo
// sposterebbe di una colonna tutto il resto della riga — cioè l'importo.
export function campiCsv(linea) {
  const campi = [];
  let corrente = '', dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (dentro) {
      if (c === '"') { if (linea[i + 1] === '"') { corrente += '"'; i++; } else dentro = false; }
      else corrente += c;
    } else if (c === '"') dentro = true;
    else if (c === ';') { campi.push(corrente); corrente = ''; }
    else corrente += c;
  }
  campi.push(corrente);
  return campi.map(x => x.trim());
}

const dataIso = (s) => (/^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s.split('/').reverse().join('-') : null);

// Il CSV è lo stesso che si rilegge a occhio prima di eseguire: se lo
// strumento leggesse un formato suo, quello che si è controllato e quello
// che viene applicato sarebbero due cose diverse.
//
// Le colonne si riconoscono dall'intestazione e non dalla posizione: un
// registro con una colonna in più (o in ordine diverso) è la cosa più
// probabile che succeda al prossimo riversamento, e contarle a dita
// avrebbe fatto leggere l'importo dalla casella sbagliata.
//
// «Incassata il» è facoltativa: dov'è valorizzata, la fattura risulta
// incassata per intero a quella data.
export function leggiRegistro(testo) {
  const linee = String(testo).replace(/^﻿/, '').split(/\r?\n/);
  const intestazione = campiCsv(linee[0] || '').map(x => x.toLowerCase());
  const dove = (...nomi) => intestazione.findIndex(h => nomi.some(n => h.includes(n)));
  const iNumero = dove('n. fattura', 'numero');
  const iData = dove('data');
  const iCliente = dove('cliente');
  const iImporto = dove('totale', 'importo');
  const iIncasso = dove('incassata', 'incasso', 'pagata');
  if (iNumero < 0 || iData < 0 || iCliente < 0 || iImporto < 0) {
    throw new Error('Il registro non ha le colonne attese: N. fattura, Data, Cliente, Totale documento.');
  }

  const righe = [];
  for (const linea of linee.slice(1)) {
    const c = campiCsv(linea);
    if (c.length <= iImporto) continue;
    const numero = c[iNumero];
    const data = dataIso(c[iData]);
    if (!numero || !data) continue;                    // salta la riga dei totali e le vuote
    righe.push({
      numero,
      data,
      cliente: c[iCliente],
      importo: Number(String(c[iImporto]).replace(/\./g, '').replace(',', '.')),
      incassata: iIncasso >= 0 ? dataIso(c[iIncasso] || '') : null,
    });
  }
  return righe;
}

// «Storia» è tutto ciò che qualcuno ha registrato SOPRA una fattura:
// incassi, note di credito, quote sui centri di costo. È il motivo per cui
// una riga non si cancella mai in automatico — quella roba l'ha scritta
// una persona, e il registro di fatturazione non la conosce.
export function conStoria(fatture, { incassi = [], storni = [], quote = [] } = {}) {
  const somma = (righe) => righe.reduce((m, r) => {
    if (r.fattura_attiva_id) m.set(r.fattura_attiva_id, (m.get(r.fattura_attiva_id) || 0) + Number(r.importo || 0));
    return m;
  }, new Map());
  const conta = (righe) => righe.reduce((m, r) => {
    if (r.fattura_attiva_id) m.set(r.fattura_attiva_id, (m.get(r.fattura_attiva_id) || 0) + 1);
    return m;
  }, new Map());
  const perIncasso = somma(incassi), perStorno = somma(storni), perQuote = conta(quote);

  return fatture.map(f => ({
    ...f,
    _chiave: chiave(f.numero_fattura, f.data_fattura),
    _incassato: perIncasso.get(f.id) || 0,
    _stornato: perStorno.get(f.id) || 0,
    _quote: perQuote.get(f.id) || 0,
    _storia: (perIncasso.has(f.id) ? 1 : 0) + (perStorno.has(f.id) ? 1 : 0) + (perQuote.get(f.id) || 0),
  }));
}

// Il piano: che cosa cancellare, che cosa correggere, che cosa inserire e
// che cosa lasciare a una persona. Non esegue niente.
export function pianifica(registro, fatture) {
  const perChiave = new Map();
  for (const f of fatture) {
    if (!perChiave.has(f._chiave)) perChiave.set(f._chiave, []);
    perChiave.get(f._chiave).push(f);
  }

  // ---- i doppioni ----
  const daCancellare = [];
  const doppioniIrrisolti = [];
  for (const [k, gruppo] of perChiave) {
    if (gruppo.length < 2) continue;
    // Si tiene quella con più storia; a pari storia la più vecchia, che è
    // quella a cui puntano eventuali collegamenti già in giro.
    const ordinate = [...gruppo].sort((a, b) => b._storia - a._storia
      || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const scarti = ordinate.slice(1);
    if (scarti.some(f => f._storia > 0)) doppioniIrrisolti.push({ chiave: k, gruppo: ordinate });
    else daCancellare.push(...scarti);
  }
  const irrisolte = new Set(doppioniIrrisolti.map(d => d.chiave));

  // ---- il confronto col registro ----
  const daInserire = [];
  const daCorreggere = [];
  const bloccate = [];
  for (const r of registro) {
    const k = chiave(r.numero, r.data);
    const gruppo = perChiave.get(k);
    if (!gruppo) { daInserire.push(r); continue; }
    // Un numero rimasto doppio non si corregge: non si sa quale delle due
    // righe il registro stia descrivendo.
    if (irrisolte.has(k)) continue;
    const f = gruppo.find(x => !daCancellare.includes(x)) || gruppo[0];
    if (f.cliente === r.cliente && f.data_fattura === r.data && Number(f.importo) === r.importo) continue;
    // Abbassare l'importo sotto quanto risulta già incassato o stornato
    // vorrebbe dire nascondere un errore invece di mostrarlo.
    if (r.importo < f._incassato + f._stornato) { bloccate.push({ f, r }); continue; }
    daCorreggere.push({ f, r });
  }

  // ---- gli incassi ----
  // Si registra un incasso solo dove la fattura non ne ha ancora NESSUNO:
  // se qualcuno ha già messo a mano un acconto, il registro — che conosce
  // una data sola e l'importo pieno — non ne sa abbastanza per correggerlo,
  // e sovrascriverlo cancellerebbe un lavoro fatto guardando l'estratto
  // conto. Quei casi si lasciano stare e si dicono.
  const daIncassare = [];
  const incassiGiaPresenti = [];
  for (const r of registro) {
    if (!r.incassata) continue;
    const k = chiave(r.numero, r.data);
    if (irrisolte.has(k)) continue;
    const gruppo = perChiave.get(k);
    if (!gruppo) { daIncassare.push({ r, f: null }); continue; }   // la fattura nasce ora
    const f = gruppo.find(x => !daCancellare.includes(x)) || gruppo[0];
    if (f._storia && f._incassato > 0) { incassiGiaPresenti.push({ f, r }); continue; }
    daIncassare.push({ r, f });
  }

  const chiaviRegistro = new Set(registro.map(r => chiave(r.numero, r.data)));
  const anno = registro.length ? registro[0].data.slice(0, 4) : '';
  return {
    daCancellare, doppioniIrrisolti, daInserire, daCorreggere, bloccate,
    daIncassare, incassiGiaPresenti,
    chiaviRegistro,
    // Quello che sta in archivio e nel registro non c'è: i numeri mancanti
    // nella serie (annullate, o diventate note di credito) e gli errori di
    // numerazione. Non si toccano, si elencano.
    fuoriRegistro: fatture.filter(f => String(f.data_fattura || '').startsWith(anno) && !chiaviRegistro.has(f._chiave)),
    altriAnni: fatture.filter(f => !String(f.data_fattura || '').startsWith(anno)),
  };
}
