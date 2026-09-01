// ============================================================
//  MOTORE DI CALCOLO DEL PREVENTIVO
// ------------------------------------------------------------
//  Ricalca la logica dello storico foglio Excel "conto trasferte"
//  e la estende. Produce SEMPRE due totali affiancati:
//    • SPESA REALE  = costo effettivo sostenuto (rimborso vivo)
//    • ADDEBITO     = km × tariffa + le voci attive (pasti/pernottamento/
//                     sanitari/pedaggi/materiale), quello che si chiede
//    • MARGINE      = addebito − spesa reale
// ============================================================

import { FUEL_DATA_DATE } from './data/fuel-prices.js';

// ---- Impostazioni di default (modificabili in app) ---------------------
export const DEFAULT_IMPOSTAZIONI = {
  // Parco mezzi con consumo medio (km/litro) e alimentazione.
  // Valori di consumo presi dallo storico Excel.
  mezzi: [
    { id: 'ambulanza', nome: 'Ambulanza',  alimentazione: 'diesel',  consumo: 9.4 },
    { id: 'doblo',     nome: 'Doblò',       alimentazione: 'diesel',  consumo: 12 },
    { id: 'vettura',   nome: 'Vettura',     alimentazione: 'benzina', consumo: 13 },
  ],

  // In Italia la CRI è esente da pedaggi: si applicano SOLO ai viaggi
  // all'estero. Stima €/km di riferimento per i pedaggi/vignette esteri.
  pedaggiEsteroKm: 0.10,

  pastoCosto: 25,        // € a pasto a persona (Excel: 25)
  tariffaKm: 1.20,       // € / km per l'addebito (Excel usava 1,15 e 1,20)
  medicoTariffaOraria: 50,      // €/ora indicativa per il medico (modificabile)
  infermiereTariffaOraria: 30,  // €/ora indicativa per l'infermiere (modificabile)

  fuelDataDate: FUEL_DATA_DATE,
};

// ---- Input di default per un nuovo preventivo --------------------------
// Un nuovo preventivo parte AZZERATO, tranne le voci di listino precompilate
// (costo pasto a persona, tariffa km): così l'operatore compila solo ciò che
// serve per il viaggio specifico, senza rischiare di stampare un preventivo
// con tariffa km a 0€ per dimenticanza.
export function nuovoInput(imp = DEFAULT_IMPOSTAZIONI) {
  return {
    kmTotali: 0,
    mezzoId: imp.mezzi[0]?.id || 'ambulanza',
    alimentazione: imp.mezzi[0]?.alimentazione || 'diesel',
    prezzoCarburante: null,        // €/l, precompilato dal Paese di destinazione
    persone: 0,
    pastiPersona: 0,
    pastoCosto: imp.pastoCosto,    // UNICA voce non azzerata
    pastiOn: false,         // sezione Pasti disattivata di default (interruttore in Itinerario)
    notti: 0,
    camere: 0,
    prezzoCameraNotte: 0,          // € a camera a notte
    prezzoPersonaNotte: 0,         // € a persona a notte (opzionale)
    pernottamentoOn: false, // sezione Pernottamento disattivata di default
    sanitariOn: false,      // sezione Sanitari (medico/infermiere) disattivata di default
    medicoOre: 0,           // ore stimate dalla durata del percorso, condivise tra i ruoli (modificabili)
    medicoOn: true,         // ruolo Medico incluso di default (se la sezione è attiva)
    medicoOraria: imp.medicoTariffaOraria, // €/ora medico, modificabile
    medico: 0,              // totale medico (auto = ore x tariffa oraria, sempre modificabile)
    infermiereOn: false,    // ruolo Infermiere incluso di default
    infermiereOraria: imp.infermiereTariffaOraria, // €/ora infermiere, modificabile
    infermiere: 0,          // totale infermiere (auto = ore x tariffa oraria, sempre modificabile)
    estero: false,          // viaggio fuori Italia -> abilita i pedaggi/vignette
    pedaggi: 0,             // pedaggi/vignette esteri (0 e nascosti in Italia)
    materiale: [],                 // [{ desc, importo }]
    materialeOn: false,     // sezione Materiale di consumo disattivata di default
    tariffaKm: imp.tariffaKm,      // precompilata dal default in Impostazioni, modificabile con preset o a mano
  };
}

// Nessuna voce del preventivo ha senso negativa (km, persone, notti, importi...):
// un valore negativo incollato o inserito a mano ridurrebbe il totale in modo
// silenzioso invece di dare un errore, quindi viene clampato a 0.
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? Math.max(0, x) : 0; };

// ---- Calcolo principale -----------------------------------------------
export function calcola(input, imp = DEFAULT_IMPOSTAZIONI) {
  const mezzo = imp.mezzi.find(m => m.id === input.mezzoId) || imp.mezzi[0] || { consumo: 10, alimentazione: 'diesel' };
  const consumo = n(mezzo.consumo) || 10;
  const km = n(input.kmTotali);

  // --- Carburante ---
  const litri = consumo > 0 ? km / consumo : 0;
  const carburante = litri * n(input.prezzoCarburante);
  const isDiesel = (input.alimentazione || mezzo.alimentazione) === 'diesel';

  // --- Pasti (sezione disattivabile: conta solo se pastiOn) ---
  const pasti = input.pastiOn ? n(input.persone) * n(input.pastiPersona) * n(input.pastoCosto) : 0;

  // --- Pernottamento (sezione disattivabile: conta solo se pernottamentoOn) ---
  const pernCamere = input.pernottamentoOn ? n(input.notti) * n(input.camere) * n(input.prezzoCameraNotte) : 0;
  const pernPersone = input.pernottamentoOn ? n(input.notti) * n(input.persone) * n(input.prezzoPersonaNotte) : 0;
  const pernottamento = pernCamere + pernPersone;

  // --- Sanitari (Medico + Infermiere): sezione disattivabile, ogni ruolo
  // scelto indipendentemente (uno solo, entrambi, o nessuno anche a sezione attiva) ---
  const medico = (input.sanitariOn && input.medicoOn) ? n(input.medico) : 0;
  const infermiere = (input.sanitariOn && input.infermiereOn) ? n(input.infermiere) : 0;
  const sanitari = medico + infermiere;
  // In Italia niente pedaggi (CRI esente): contano solo se estero attivo.
  const pedaggi = input.estero ? n(input.pedaggi) : 0;
  // Materiale di consumo (sezione disattivabile: conta solo se materialeOn)
  const materiale = input.materialeOn ? (input.materiale || []).reduce((s, r) => s + n(r.importo), 0) : 0;

  // --- SPESA REALE (costo vivo) ---
  const spesaReale = carburante + pasti + pernottamento + sanitari + pedaggi + materiale;

  // --- ADDEBITO (km × tariffa + tutte le voci attive) ---
  const addebitoKm = km * n(input.tariffaKm);
  const passthrough = pasti + pernottamento + sanitari + pedaggi + materiale;
  const addebito = addebitoKm + passthrough;

  const margine = addebito - spesaReale;

  return {
    litri, carburante,
    pasti, pernottamento, pernCamere, pernPersone,
    medico, infermiere, sanitari, pedaggi, materiale,
    spesaReale,
    addebitoKm, passthrough, addebito,
    margine,
    margineperc: spesaReale > 0 ? (margine / spesaReale) * 100 : null,
    tariffaEffettiva: km > 0 ? addebito / km : null,
    consumo, isDiesel,
  };
}
