// ============================================================
//  Promemoria email (functions/_lib/promemoria.js): a chi partono, cosa
//  contengono, e soprattutto quando NON partono — spenti, già inviati
//  oggi, niente da dire, sezione non autorizzata.
// ============================================================
import { gruppo, prova, uguale, vero } from './aiuto.mjs';
import { oggiRoma, tocca, selezionaPerUtente, componiPromemoria, accessiDi, residuo } from '../functions/_lib/promemoria.js';

gruppo('Promemoria email');

const LUNEDI = '2026-10-19';
const MARTEDI = '2026-10-20';
const pref = (x = {}) => ({ attive: true, frequenza: 'giornaliera', giorni_anticipo: 7, fatture_passive: true, crediti_attive: true, impegni: true, ultimo_invio: null, ...x });

prova('spenti, o già inviati oggi: non parte nulla', () => {
  uguale(tocca(pref({ attive: false }), MARTEDI), false);
  uguale(tocca(pref({ ultimo_invio: MARTEDI }), MARTEDI), false);
  uguale(tocca(pref(), MARTEDI), true);
});

prova('settimanali: solo il lunedì', () => {
  uguale(tocca(pref({ frequenza: 'settimanale' }), LUNEDI), true);
  uguale(tocca(pref({ frequenza: 'settimanale' }), MARTEDI), false);
});

prova('la data di oggi è quella di Genova, non quella UTC', () => {
  // 22:30 UTC del 18 ottobre = 00:30 del 19 a Roma (ora legale)
  uguale(oggiRoma(new Date('2026-10-18T22:30:00Z')), '2026-10-19');
});

prova('il residuo tiene conto di pagamenti e note di credito', () => {
  uguale(residuo({ importo: 1000, pagamenti: [{ importo: 300 }], note_credito_righe: [{ importo: 200 }] }, 'pagamenti', 'note_credito_righe'), 500);
});

const dati = {
  passive: [
    { fornitore: 'Enel', numero_fattura: '1', scadenza: '2026-10-10', _residuo: 120 },   // scaduta
    { fornitore: 'Rossi', numero_fattura: '2', scadenza: '2026-10-25', _residuo: 50 },   // fra 5 giorni
    { fornitore: 'Bianchi', numero_fattura: '3', scadenza: '2026-12-01', _residuo: 80 }, // troppo in là
    { fornitore: 'Verdi', numero_fattura: '4', scadenza: '2026-10-12', _residuo: 0 },    // saldata
  ],
  attive: [
    { cliente: 'Comune', numero_fattura: 'A1', data_fattura: '2026-06-01', _residuo: 900 },  // oltre 90 giorni
    { cliente: 'ASL', numero_fattura: 'A2', data_fattura: '2026-10-01', _residuo: 400 },     // recente
  ],
  impegni: [
    { titolo: 'Bilancio', scadenza: '2026-10-22', importanza: 'alta', fatto: false },
    { titolo: 'Già fatto', scadenza: '2026-10-21', fatto: true },
  ],
};

prova('si sceglie solo quello che scade entro l\'anticipo, e non è saldato', () => {
  const sel = selezionaPerUtente(pref(), new Set(['scadenziario', 'direttore']), dati, MARTEDI);
  uguale(sel.passive.map(f => f.fornitore), ['Enel', 'Rossi']);
  uguale(sel.attive.map(f => f.cliente), ['Comune']);
  uguale(sel.impegni.map(i => i.titolo), ['Bilancio']);
});

prova('una sezione non autorizzata non finisce nell\'email', () => {
  const sel = selezionaPerUtente(pref(), new Set(['direttore']), dati, MARTEDI);
  uguale([sel.passive.length, sel.attive.length, sel.impegni.length], [0, 0, 1]);
});

prova('le voci spente dalla persona restano fuori', () => {
  const sel = selezionaPerUtente(pref({ crediti_attive: false, impegni: false }), new Set(['scadenziario', 'direttore']), dati, MARTEDI);
  uguale([sel.passive.length, sel.attive.length, sel.impegni.length], [2, 0, 0]);
});

prova('niente da segnalare: l\'email è "vuota" e non si manda', () => {
  const e = componiPromemoria({ nome: 'Anna', oggi: MARTEDI, sel: { passive: [], attive: [], impegni: [] }, indirizzo: 'https://x' });
  uguale(e.vuoto, true);
});

prova('oggetto e testo dicono cosa c\'è, e i nomi sono protetti nell\'HTML', () => {
  const sel = { passive: [{ fornitore: 'A&B <srl>', numero_fattura: '7', scadenza: '2026-10-10', _residuo: 120 }], attive: [], impegni: [] };
  const e = componiPromemoria({ nome: 'Anna', oggi: MARTEDI, sel, indirizzo: 'https://x' });
  uguale(e.oggetto, 'Promemoria: 1 fattura da pagare');
  vero(e.testo.includes('scaduta il 10/10/2026'), 'manca la scadenza nel testo');
  vero(e.html.includes('A&amp;B &lt;srl&gt;') && !e.html.includes('<srl>'), 'il nome del fornitore non è protetto nell\'HTML');
  vero(e.testo.includes('https://x/#/portale/promemoria'), 'manca il link per spegnerli');
});

prova('sospesi, in attesa e password provvisoria: nessuna sezione', () => {
  const aut = [{ utente_id: 'u', sezione: 'scadenziario' }];
  uguale([...accessiDi({ id: 'u', ruolo: 'utente' }, aut)], ['scadenziario']);
  uguale(accessiDi({ id: 'u', ruolo: 'in_attesa' }, aut).size, 0);
  uguale(accessiDi({ id: 'u', ruolo: 'utente', deve_cambiare_password: true }, aut).size, 0);
  uguale([...accessiDi({ id: 's', ruolo: 'super_admin' }, [])].sort(), ['direttore', 'scadenziario']);
});
