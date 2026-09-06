// ============================================================
//  IL PREVENTIVO DEI CORSI COME MODELLO DI BLOCCHI
//  Un preventivo esce in due formati (PDF di stampa e Word sulla carta
//  intestata) che non hanno nulla in comune tecnicamente. Per non scrivere
//  due volte il documento — e non ritrovarsi con un PDF e un Word diversi —
//  il contenuto si costruisce una volta sola qui, come elenco di blocchi
//  neutri; poi js/lib/stampaBlocchi.js li rende in HTML e
//  js/lib/docxBlocchi.js in OOXML.
//
//  Rispetto al preventivo scritto a mano che questa sezione sostituisce, il
//  documento guadagna quattro cose che lì mancavano: i corsi in tabella con
//  il numero dei discenti e il totale (prima erano righe discorsive senza
//  somma), le attestazioni rilasciate corso per corso, la validità
//  dell'offerta e la riga sul regime IVA.
//
//  Tipi di blocco: 'p' (paragrafo), 'titolo', 'tabella', 'firma', 'spazio'.
// ============================================================
import { calcola, inLettere, ALIQUOTA_IVA } from '../calc.js';

const euro = (n) => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const num = (n, d = 0) => Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
  return isNaN(d) ? String(iso) : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function costruisciBlocchi(prev, imp) {
  const r = calcola(prev);
  const testi = imp?.testi || {};
  const firma = imp?.firma || {};
  const blocchi = [];

  // ---- destinatario ----
  // "Spett.le" e "Alla c.a." sono le due formule con cui il Comitato indirizza
  // i preventivi alle aziende: restano fisse, il resto arriva dalla rubrica.
  blocchi.push({ t: 'p', testo: 'Spett.le' });
  const dest = [prev.cliente, prev.cliente_indirizzo, prev.cliente_cf ? `C.F./P.I. ${prev.cliente_cf}` : '']
    .filter(Boolean);
  for (const [i, riga] of dest.entries()) {
    blocchi.push({ t: 'p', testo: riga, grassetto: i === 0 });
  }
  if (prev.referente) blocchi.push({ t: 'p', testo: `Alla c.a. ${prev.referente}` });
  const rif = [
    prev.referente_email ? `Email: ${prev.referente_email}` : '',
    prev.referente_telefono ? `Telefono: ${prev.referente_telefono}` : '',
  ].filter(Boolean);
  for (const riga of rif) blocchi.push({ t: 'p', testo: riga, piccolo: true });

  // ---- protocollo e data ----
  // Il protocollo si scrive a mano quando serve (non tutti i preventivi lo
  // hanno): se è vuoto, la riga non compare affatto.
  blocchi.push({ t: 'spazio' });
  if (prev.protocollo) blocchi.push({ t: 'p', testo: `Prot. n. ${prev.protocollo}` });
  blocchi.push({ t: 'p', testo: `Genova, ${fmtData(prev.data_documento)}`, allineamento: 'destra' });

  // ---- oggetto ----
  blocchi.push({ t: 'p', testo: `OGGETTO: ${prev.oggetto || 'PREVENTIVO CORSI DI FORMAZIONE'}`, grassetto: true });
  blocchi.push({ t: 'spazio' });

  // ---- premessa e tabella dei corsi ----
  if (testi.premessa) blocchi.push({ t: 'p', testo: testi.premessa });

  // La colonna del listino compare solo se almeno un corso è offerto sotto
  // prezzo: se il prezzo riservato coincide col listino sarebbe una colonna
  // che ripete quella accanto, e nel documento peserebbe soltanto.
  const conListino = r.righe.some(x => x.listino > x.prezzo);
  const intestazioni = ['Corso', 'Durata', 'Discenti',
    ...(conListino ? ['Listino a discente', 'Prezzo riservato'] : ['Prezzo a discente']), 'Totale'];
  const allineamenti = ['sx', 'centro', 'centro', ...(conListino ? ['dx'] : []), 'dx', 'dx'];
  const larghezze = conListino ? [34, 10, 10, 15, 15, 16] : [42, 12, 12, 17, 17];

  blocchi.push({
    t: 'tabella',
    intestazioni, allineamenti, larghezze,
    compatta: conListino,
    righe: r.righe.map(x => [
      x.nome,
      x.durata || '—',
      // Un preventivo si scrive anche senza sapere quante persone saranno:
      // in quel caso vale il prezzo a testa e il totale si farà dopo.
      x.discenti ? num(x.discenti) : 'da definire',
      ...(conListino ? [x.listino > x.prezzo ? euro(x.listino) : '—'] : []),
      euro(x.prezzo),
      x.discenti ? euro(x.importo) : '—',
    ]),
    piede: piedeTabella(r, intestazioni.length, testi),
  });

  blocchi.push({
    t: 'p',
    testo: `Importo complessivo: ${euro(r.totale)} (euro ${inLettere(r.totale)}).`,
    grassetto: true,
  });
  const rigaIva = r.conIva ? testi.iva_soggetto : (prev.regime_iva === 'esente' ? testi.iva_esente : '');
  if (rigaIva) blocchi.push({ t: 'p', testo: rigaIva });

  // ---- attestazioni ----
  // Cosa si porta a casa chi frequenta: cambia da corso a corso (l'attestato
  // triennale del primo soccorso non è l'autorizzazione all'uso del DAE), ed
  // è la parte che nel preventivo scritto a mano finiva dimenticata.
  const conAttestato = r.righe.filter(x => (x.attestato || '').trim());
  if (conAttestato.length) {
    blocchi.push({ t: 'titolo', testo: 'Attestazioni rilasciate' });
    for (const x of conAttestato) {
      blocchi.push({ t: 'p', testo: `${x.nome}: ${x.attestato}` });
    }
  }

  // ---- sede, oneri, validità ----
  blocchi.push({ t: 'spazio' });
  // L'indirizzo del committente si innesta nella frase, non le si accoda come
  // seconda proposizione: "…presso la sede indicata dal committente. Via
  // Cornigliano 34" non è italiano. Il punto finale eventualmente già scritto
  // nel testo configurato viene tolto prima di proseguire la frase.
  const sede = prev.sede_tipo === 'cliente'
    ? (prev.sede
        ? `${String(testi.sede_cliente || '').trim().replace(/[.:;]$/, '')}, in ${prev.sede}.`
        : testi.sede_cliente)
    : testi.sede_nostra;
  if (sede) blocchi.push({ t: 'p', testo: sede });
  if (testi.oneri) blocchi.push({ t: 'p', testo: testi.oneri });
  if (testi.validita) blocchi.push({ t: 'p', testo: testi.validita });

  // ---- note libere ----
  if (prev.note) {
    blocchi.push({ t: 'spazio' });
    for (const riga of String(prev.note).split('\n')) if (riga.trim()) blocchi.push({ t: 'p', testo: riga.trim() });
  }

  // ---- chiusura e firma ----
  if (testi.chiusura) {
    blocchi.push({ t: 'spazio' });
    blocchi.push({ t: 'p', testo: testi.chiusura });
  }
  blocchi.push({ t: 'firma', ruolo: firma.ruolo || '', nome: firma.nome || '' });

  return { blocchi, calcolo: r };
}

// Il piede della tabella: quante righe servono dipende da cosa c'è nel
// preventivo. Senza trasferta, sconti e IVA resta una riga sola col totale —
// che è il caso normale.
function piedeTabella(r, colonne, testi) {
  const righe = [];
  const riga = (etichetta, importo, forte = false) => ({
    celle: [etichetta, ...Array(colonne - 2).fill(''), importo],
    forte,
  });

  if (r.trasferta > 0) {
    righe.push(riga('Totale corsi', euro(r.totaleCorsi)));
    righe.push(riga(testi.voce_trasferta || 'Trasferta presso la sede del committente', euro(r.trasferta)));
  }
  if (r.sconto > 0) {
    righe.push(riga('Totale', euro(r.totaleLordo)));
    for (const s of r.sconti) righe.push(riga(etichettaSconto(s), '− ' + euro(s.importo)));
  }
  if (r.conIva) {
    righe.push(riga('Imponibile', euro(r.imponibile)));
    righe.push(riga(`IVA ${ALIQUOTA_IVA}%`, euro(r.iva)));
  }
  righe.push(riga(righe.length ? 'Totale da corrispondere' : 'Totale', euro(r.totale), true));
  return righe;
}

// Come si legge uno sconto nel documento: la percentuale va scritta,
// altrimenti il cliente vede un importo sottratto senza sapere su cosa.
export function etichettaSconto(s) {
  if (s.tipo !== 'percentuale') return 'Sconto';
  return `Sconto ${num(s.percentuale, s.percentuale % 1 ? 1 : 0)}%`;
}

// Nome del file (PDF o Word) proposto al salvataggio.
export function nomeFile(prev, estensione) {
  const pezzi = ['Preventivo corsi', prev.cliente, prev.data_documento].filter(Boolean);
  return pezzi.join(' - ').replace(/[\\/:*?"<>|]/g, '-') + '.' + estensione;
}
