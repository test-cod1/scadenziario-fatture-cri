// ============================================================
//  Domande e risposte sulle patenti (js/lib/faqPatenti.mjs): ogni voce ha
//  domanda, risposta e fonte, e la ricerca trova anche senza accenti.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { FAQ, tutteLeDomande, testoCercabile, htmlFaq } from '../js/lib/faqPatenti.mjs';

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

prova('l\'HTML ha una voce per domanda e chiude i tag', () => {
  const h = htmlFaq(s => String(s));
  uguale((h.match(/<details/g) || []).length, tutteLeDomande().length);
  for (const tag of ['ul', 'li', 'table', 'tr', 'td', 'b', 'details', 'section']) {
    uguale((h.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (h.match(new RegExp(`</${tag}>`, 'g')) || []).length, `<${tag}> non bilanciato`);
  }
});
