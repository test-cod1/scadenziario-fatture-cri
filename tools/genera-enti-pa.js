// ============================================================
//  GENERATORE DI assets/enti-pa.json
//  Scarica l'elenco ufficiale delle pubbliche amministrazioni da IndicePA
//  (AgID) e ne ricava un file compatto con i soli campi che servono a
//  compilare il destinatario di un preventivo: denominazione, codice fiscale
//  e indirizzo completo.
//
//  Perché un file statico invece di chiamare un servizio a ogni ricerca:
//  IndicePA non ha una API di ricerca per denominazione aperta e senza
//  registrazione, l'elenco cambia di rado, e così la ricerca funziona anche
//  con la rete lenta — nessuna chiave da custodire, nessun dato del nostro
//  cliente che esce verso terzi mentre si digita.
//
//  Uso:  node tools/genera-enti-pa.js
//  Da rilanciare una volta l'anno, o quando un ente non si trova.
//
//  Fonte: https://www.indicepa.gov.it/ipa-dati/dataset/amministrazioni
//  Licenza dei dati: CC BY 4.0 (AgID) — l'attribuzione è mostrata nell'app.
// ============================================================
import { writeFileSync } from 'node:fs';

const DATASET = 'https://www.indicepa.gov.it/ipa-dati/api/3/action/package_show?id=amministrazioni';

// Due file invece di uno: gli enti liguri sono 618 (60 KB) e coprono quasi
// tutti i clienti veri, mentre l'elenco nazionale è 23.000 enti e 2,4 MB.
// L'app carica il primo alla prima ricerca e il secondo solo se glielo si
// chiede, così chi lavora dal telefono non scarica l'Italia per trovare il
// Comune di Genova.
const REGIONE_LOCALE = 'Liguria';
const USCITA_LOCALE = new URL('../assets/enti-pa-liguria.json', import.meta.url);
const USCITA_ITALIA = new URL('../assets/enti-pa.json', import.meta.url);

// Le colonne del TXT che ci interessano, nell'ordine in cui finiscono nel
// file generato (array e non oggetti: a 23.000 righe le chiavi ripetute
// triplicherebbero il peso da scaricare).
const CAMPI = ['des_amm', 'cf', 'Indirizzo', 'Cap', 'Comune', 'Provincia'];

const risposta = await fetch(DATASET);
if (!risposta.ok) throw new Error(`IndicePA non raggiungibile (${risposta.status})`);
const pacchetto = await risposta.json();
const risorsa = pacchetto.result.resources.find(r => r.format === 'TXT' && r.url.endsWith('.txt'));
if (!risorsa) throw new Error('Risorsa TXT non trovata nel dataset');

console.log('Scarico', risorsa.url);
const testo = (await (await fetch(risorsa.url)).text()).replace(/^﻿/, '');
const righe = testo.split(/\r?\n/).filter(Boolean);
const colonne = righe[0].split('\t').map(c => c.trim());
const posizione = CAMPI.map(c => {
  const i = colonne.indexOf(c);
  if (i < 0) throw new Error(`Colonna "${c}" non più presente nel dataset: controllare il tracciato`);
  return i;
});

const posizioneRegione = colonne.indexOf('Regione');
const enti = [];
const entiLocali = [];
for (const riga of righe.slice(1)) {
  const celle = riga.split('\t');
  const valori = posizione.map(i => (celle[i] || '').trim());
  if (!valori[0] || !valori[1]) continue;        // senza nome o senza CF non serve a nulla
  enti.push(valori);
  if ((celle[posizioneRegione] || '').trim() === REGIONE_LOCALE) entiLocali.push(valori);
}

// Ordine alfabetico: il file è anche leggibile a mano, e la ricerca a parità
// di punteggio propone i risultati in un ordine stabile.
const perNome = (a, b) => a[0].localeCompare(b[0], 'it');
enti.sort(perNome);
entiLocali.sort(perNome);

function scrivi(percorso, elenco, ambito) {
  writeFileSync(percorso, JSON.stringify({
    fonte: 'IndicePA — AgID',
    licenza: 'CC BY 4.0',
    aggiornato: new Date().toISOString().slice(0, 10),
    ambito,
    campi: CAMPI,
    enti: elenco,
  }));
  const kb = Math.round(JSON.stringify(elenco).length / 1024);
  console.log(`  ${percorso.pathname.split('/').pop()}: ${elenco.length} enti, ${kb} KB`);
}

scrivi(USCITA_LOCALE, entiLocali, REGIONE_LOCALE);
scrivi(USCITA_ITALIA, enti, 'Italia');
