// ============================================================
//  PROMEMORIA EMAIL — cosa scrivere a chi, e come spedirlo
// ------------------------------------------------------------
//  Ogni utente li attiva da sé (pagina "Promemoria email" del portale,
//  tabella notifiche_preferenze): spenti finché non li accende. Riceve solo
//  quello che riguarda le sezioni a cui ha accesso:
//    - Scadenziario: fatture passive ancora da pagare scadute o in scadenza
//      entro N giorni, e fatture attive non incassate da più di 90 giorni;
//    - Direttore: impegni non fatti scaduti o in scadenza entro N giorni;
//    - Scadenze: quelle non fatte già passate o entrate nel loro preavviso
//      (ognuna ha il suo: per un contratto servono settimane, per un bollo
//      un giorno).
//  Se non c'è niente da segnalare non parte nessuna email: un promemoria
//  che arriva anche vuoto smette presto di essere letto.
//
//  Qui solo funzioni pure (selezione e testo), più l'invio vero e proprio:
//  le prove in test/promemoria.prove.mjs lavorano sulle prime, senza rete.
// ============================================================

export const GIORNI_CREDITO = 90;

// La data di oggi a Genova, non in UTC: il cron gira alle 6 italiane, che
// d'inverno sono ancora "ieri" per l'UTC solo di rado, ma d'estate a
// mezzanotte e mezza lo sarebbero.
export function oggiRoma(adesso = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(adesso);
}

export function sommaGiorni(iso, giorni) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function giornoDellaSettimana(iso) {   // 1 = lunedì … 7 = domenica
  return new Date(iso + 'T00:00:00Z').getUTCDay() || 7;
}

// Deve partire oggi il promemoria di questa persona?
export function tocca(pref, oggi) {
  if (!pref.attive) return false;
  if (pref.ultimo_invio === oggi) return false;               // già inviato
  if (pref.frequenza === 'settimanale') return giornoDellaSettimana(oggi) === 1;
  return true;
}

// Residuo di una fattura con i suoi pagamenti/incassi e storni annidati.
export function residuo(f, campoVersamenti, campoStorni) {
  const somma = (arr) => (arr || []).reduce((s, r) => s + Number(r.importo || 0), 0);
  return Math.round((Number(f.importo || 0) - somma(f[campoVersamenti]) - somma(f[campoStorni])) * 100) / 100;
}

// Cosa spetta a questa persona: `accessi` è l'insieme delle sezioni che
// può vedere, `dati` le righe già lette dal database (le stesse per tutti).
export function selezionaPerUtente(pref, accessi, dati, oggi) {
  const limite = sommaGiorni(oggi, Number(pref.giorni_anticipo) || 7);
  const vecchie = sommaGiorni(oggi, -GIORNI_CREDITO);
  const out = { passive: [], attive: [], impegni: [], scadenze: [] };
  if (accessi.has('scadenziario') && pref.fatture_passive) {
    out.passive = (dati.passive || [])
      .filter(f => f.scadenza && f.scadenza <= limite && f._residuo > 0.005)
      .sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  }
  if (accessi.has('scadenziario') && pref.crediti_attive) {
    out.attive = (dati.attive || [])
      .filter(f => f.data_fattura && f.data_fattura <= vecchie && f._residuo > 0.005)
      .sort((a, b) => a.data_fattura.localeCompare(b.data_fattura));
  }
  if (accessi.has('direttore') && pref.impegni) {
    out.impegni = (dati.impegni || [])
      .filter(i => !i.fatto && i.scadenza && i.scadenza <= limite)
      .sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  }
  if (accessi.has('scadenze') && pref.scadenze !== false) {
    out.scadenze = (dati.scadenze || [])
      .filter(s => !s.fatta && s.data_scadenza && s.data_scadenza <= sommaGiorni(oggi, Number(s.preavviso_giorni) || 0))
      .sort((a, b) => a.data_scadenza.localeCompare(b.data_scadenza));
  }
  return out;
}

const euro = (n) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const data = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function quando(scadenza, oggi) {
  if (scadenza < oggi) return 'scaduta il ' + data(scadenza);
  if (scadenza === oggi) return 'scade oggi';
  return 'scade il ' + data(scadenza);
}

// Testo e HTML dell'email. `vuoto` = niente da dire: l'email non si manda.
export function componiPromemoria({ nome, oggi, sel, indirizzo }) {
  const { passive, attive, impegni } = sel;
  const scadenze = sel.scadenze || [];
  const vuoto = !passive.length && !attive.length && !impegni.length && !scadenze.length;
  const pezzi = [];
  if (passive.length) pezzi.push(`${passive.length} ${passive.length === 1 ? 'fattura da pagare' : 'fatture da pagare'}`);
  if (attive.length) pezzi.push(`${attive.length} ${attive.length === 1 ? 'credito da sollecitare' : 'crediti da sollecitare'}`);
  if (impegni.length) pezzi.push(`${impegni.length} ${impegni.length === 1 ? 'impegno' : 'impegni'}`);
  if (scadenze.length) pezzi.push(`${scadenze.length} ${scadenze.length === 1 ? 'scadenza' : 'scadenze'}`);
  const oggetto = vuoto ? 'Promemoria: nulla in scadenza' : 'Promemoria: ' + pezzi.join(', ');

  const blocchi = [];
  if (passive.length) blocchi.push({
    titolo: 'Fatture passive scadute o in scadenza', link: '#/scadenziario/passive/fatture',
    righe: passive.map(f => [`${f.fornitore}${f.numero_fattura ? ' · n. ' + f.numero_fattura : ''}`, `${euro(f._residuo)} — ${quando(f.scadenza, oggi)}`, f.scadenza < oggi]),
  });
  if (attive.length) blocchi.push({
    titolo: `Fatture attive non incassate da oltre ${GIORNI_CREDITO} giorni`, link: '#/scadenziario/attive/fatture',
    righe: attive.map(f => [`${f.cliente}${f.numero_fattura ? ' · n. ' + f.numero_fattura : ''}`, `${euro(f._residuo)} — emessa il ${data(f.data_fattura)}`, false]),
  });
  if (impegni.length) blocchi.push({
    titolo: 'Impegni del Direttore', link: '#/direttore/impegni',
    righe: impegni.map(i => [i.titolo, quando(i.scadenza, oggi) + (i.importanza === 'alta' ? ' · importante' : ''), i.scadenza < oggi]),
  });
  if (scadenze.length) blocchi.push({
    titolo: 'Scadenze', link: '#/scadenze/elenco',
    righe: scadenze.map(s => [`${s.titolo}${s.riferimento ? ' · ' + s.riferimento : ''}${s.categoria ? ' (' + s.categoria + ')' : ''}`, quando(s.data_scadenza, oggi), s.data_scadenza < oggi]),
  });

  const saluto = `Buongiorno${nome ? ' ' + nome : ''},`;
  const testo = [
    saluto, '',
    vuoto ? 'oggi non c\'è niente in scadenza nelle sezioni che segui.' : 'ecco cosa richiede attenzione nel portale Amministrazione:',
    ...blocchi.flatMap(b => ['', b.titolo.toUpperCase(), ...b.righe.map(([a, c]) => `- ${a}: ${c}`), `  ${indirizzo}/${b.link}`]),
    '', '—', `Ricevi questa email perché hai attivato i promemoria. Per cambiarli o spegnerli: ${indirizzo}/#/portale/promemoria`,
  ].join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1d1d1f;max-width:620px">
<p>${esc(saluto)}</p>
<p>${vuoto ? 'oggi non c\'è niente in scadenza nelle sezioni che segui.' : 'ecco cosa richiede attenzione nel portale Amministrazione:'}</p>
${blocchi.map(b => `<h3 style="font-size:15px;margin:22px 0 8px;color:#cc0000">${esc(b.titolo)}</h3>
<table style="border-collapse:collapse;width:100%">${b.righe.map(([a, c, rosso]) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e5ea">${esc(a)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e5ea;white-space:nowrap;${rosso ? 'color:#cc0000;font-weight:bold' : ''}">${esc(c)}</td></tr>`).join('')}</table>
<p style="margin:8px 0 0"><a href="${esc(indirizzo + '/' + b.link)}" style="color:#cc0000">Apri nel portale →</a></p>`).join('\n')}
<p style="margin-top:28px;font-size:12px;color:#6e6e73">Ricevi questa email perché hai attivato i promemoria nel portale. <a href="${esc(indirizzo)}/#/portale/promemoria" style="color:#6e6e73">Cambiali o spegnili qui</a>.</p>
</div>`;
  return { vuoto, oggetto, testo, html };
}

// ------------------------------------------------------------
//  Invio: Resend o Brevo, quello di cui c'è la chiave.
// ------------------------------------------------------------
//  PROMEMORIA_MITTENTE è l'indirizzo che compare come mittente, nella forma
//  "Amministrazione CRI Genova <amministrazione@crigenova.it>": deve essere
//  un mittente verificato presso il servizio scelto.
export function servizioEmail(env) {
  if (env.RESEND_API_KEY) return 'resend';
  if (env.BREVO_API_KEY) return 'brevo';
  return null;
}

export async function inviaEmail(env, { a, oggetto, html, testo }) {
  const mittente = env.PROMEMORIA_MITTENTE || '';
  const servizio = servizioEmail(env);
  if (!servizio || !mittente) throw new Error('Invio email non configurato: servono PROMEMORIA_MITTENTE e RESEND_API_KEY (oppure BREVO_API_KEY).');
  let res;
  if (servizio === 'resend') {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: mittente, to: [a], subject: oggetto, html, text: testo }),
    });
  } else {
    const m = mittente.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    const sender = m ? { name: m[1] || undefined, email: m[2] } : { email: mittente.trim() };
    res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender, to: [{ email: a }], subject: oggetto, htmlContent: html, textContent: testo }),
    });
  }
  if (!res.ok) {
    const dettaglio = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Il servizio email (${servizio}) ha rifiutato l'invio: ${res.status} ${dettaglio}`);
  }
}

// ------------------------------------------------------------
//  Lettura dei dati, con la service role (il cron non ha un utente).
// ------------------------------------------------------------
async function tutteLeRighe(base, headers, percorso) {
  const out = [];
  for (let da = 0; ; da += 1000) {
    const res = await fetch(`${base}/rest/v1/${percorso}`, { headers: { ...headers, Range: `${da}-${da + 999}`, 'Range-Unit': 'items' } });
    if (!res.ok) throw new Error(`Lettura di ${percorso.split('?')[0]} non riuscita: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
    const pagina = await res.json();
    out.push(...pagina);
    if (pagina.length < 1000) return out;
  }
}

// Legge solo quello che serve a chi deve ricevere qualcosa.
export async function leggiDati(base, serviceKey, { passive, attive, impegni, scadenze, giorniMax, oggi }) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const limite = sommaGiorni(oggi, giorniMax);
  const vecchie = sommaGiorni(oggi, -GIORNI_CREDITO);
  const [p, a, i, s] = await Promise.all([
    passive ? tutteLeRighe(base, headers, `fatture?select=id,fornitore,numero_fattura,scadenza,importo,pagamenti(importo),note_credito_righe(importo)&stato=in.(da_pagare,pagata_parziale)&scadenza=lte.${limite}&order=id`) : [],
    attive ? tutteLeRighe(base, headers, `fatture_attive?select=id,cliente,numero_fattura,data_fattura,importo,incassi(importo),note_credito_attive_righe(importo)&stato=in.(da_incassare,incassata_parziale)&data_fattura=lte.${vecchie}&order=id`) : [],
    impegni ? tutteLeRighe(base, headers, `impegni_direttore?select=id,titolo,scadenza,importanza,urgenza,fatto&fatto=eq.false&scadenza=lte.${limite}&order=id`) : [],
    // Il preavviso arriva a un anno: si legge fin lì e si filtra per ognuna.
    scadenze ? tutteLeRighe(base, headers, `scadenze?select=id,titolo,categoria,riferimento,data_scadenza,preavviso_giorni,fatta&fatta=eq.false&data_scadenza=lte.${sommaGiorni(oggi, 365)}&order=id`) : [],
  ]);
  return {
    passive: p.map(f => ({ ...f, _residuo: residuo(f, 'pagamenti', 'note_credito_righe') })),
    attive: a.map(f => ({ ...f, _residuo: residuo(f, 'incassi', 'note_credito_attive_righe') })),
    impegni: i,
    scadenze: s,
  };
}

// Le sezioni che una persona vede, con le stesse regole di ruolo_sezione():
// sospesi, in attesa e chi ha ancora la password provvisoria non vedono nulla.
export function accessiDi(profilo, autorizzazioni) {
  if (!profilo || profilo.deve_cambiare_password) return new Set();
  if (profilo.ruolo === 'super_admin') return new Set(['scadenziario', 'direttore', 'scadenze']);
  if (profilo.ruolo !== 'utente') return new Set();
  return new Set(autorizzazioni.filter(a => a.utente_id === profilo.id).map(a => a.sezione));
}
