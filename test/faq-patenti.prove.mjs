// ============================================================
//  Domande e risposte sulle patenti (js/lib/faqPatenti.mjs): ogni voce ha
//  domanda, risposta e fonte, e la ricerca trova anche senza accenti.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { FAQ, tutteLeDomande, testoCercabile, htmlFaq, filtraFaq } from '../js/lib/faqPatenti.mjs';

// Un elenco finto con le domande vere: filtraFaq legge solo data-testo e
// scrive hidden e open, non serve un DOM.
function elencoFinto() {
  const voci = tutteLeDomande().map(q => ({ dataset: { testo: testoCercabile(q) }, hidden: false, open: false }));
  return { voci, querySelectorAll: (s) => (s === '.faq-voce' ? voci : []) };
}

gruppo('Patenti — domande e risposte');

prova('ogni domanda ha testo, risposta e fonte', () => {
  for (const q of tutteLeDomande()) {
    vero(q.d && q.d.trim().endsWith('?'), `domanda senza punto interrogativo: ${q.d}`);
    vero(q.r && q.r.trim().length > 40, `risposta troppo corta: ${q.d}`);
    vero(q.fonte && q.fonte.trim(), `manca la fonte: ${q.d}`);
  }
});

prova('nessuna domanda ripetuta, nessun gruppo vuoto', () => {
  const d = tutteLeDomande().map(q => q.d);
  uguale(new Set(d).size, d.length);
  vero(FAQ.every(g => g.domande.length));
});

prova('la ricerca ignora maiuscole e accenti', () => {
  const eta = tutteLeDomande().find(q => q.d === 'Che età serve?');
  vero(testoCercabile(eta).includes('che eta serve'));
});

// Fino al 07/11/2026 la ricerca divideva il testo con /s+/ (la lettera
// «s») invece di /\s+/ (gli spazi): «rinnovo patente» trovava 0 domande
// invece di 6, e due parole funzionavano solo vicine e nell'ordine del testo.
prova('la ricerca con più parole le cerca in qualunque ordine', () => {
  const e = elencoFinto();
  const dritto = filtraFaq(e, 'rinnovo patente');
  vero(dritto > 0, '«rinnovo patente» deve trovare qualcosa');
  uguale(filtraFaq(e, 'patente rinnovo'), dritto, 'l\'ordine delle parole non conta');
  uguale(filtraFaq(e, '  medica   visita '), filtraFaq(e, 'visita medica'), 'spazi in più e ordine invertito');
  for (const v of e.voci.filter(x => !x.hidden)) vero(v.dataset.testo.includes('visita') && v.dataset.testo.includes('medica'));
});

prova('una parola con la «s» non si spezza', () => {
  const e = elencoFinto();
  const n = filtraFaq(e, 'scadenza');
  uguale(n, e.voci.filter(v => v.dataset.testo.includes('scadenza')).length);
  uguale(filtraFaq(e, ''), e.voci.length, 'ricerca vuota: tutte visibili');
});

prova('l\'HTML ha una voce per domanda e chiude i tag', () => {
  const h = htmlFaq(s => String(s));
  uguale((h.match(/<details/g) || []).length, tutteLeDomande().length);
  for (const tag of ['ul', 'li', 'table', 'tr', 'td', 'b', 'details', 'section']) {
    uguale((h.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (h.match(new RegExp(`</${tag}>`, 'g')) || []).length, `<${tag}> non bilanciato`);
  }
});
