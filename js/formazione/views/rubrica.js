// ============================================================
//  RUBRICA DEI COMMITTENTI DELLA FORMAZIONE
//  Le aziende che ci chiedono i corsi. Si riempie soprattutto da sola — dal
//  preventivo, con "Salva in rubrica" — e qui si sistemano le schede.
//
//  Torna utile più che altrove: gli aggiornamenti scadono ogni tre anni, e
//  chi ha fatto il corso nel 2023 richiama nel 2026.
//
//  Il funzionamento sta in js/lib/rubrica.js, condiviso con le assistenze
//  sanitarie: qui restano lo store di questa sezione e le sue parole. I dati
//  delle due sezioni NON si mescolano, sono due tabelle con permessi
//  separati.
// ============================================================
import { clienti } from '../data/store.js';
import { creaRubrica } from '../../lib/rubrica.js';

export const { renderRubrica, schedaCliente, scegliCliente } = creaRubrica({
  clienti,
  testi: {
    titolo: 'Rubrica committenti',
    sottotitolo: 'Aziende ed enti che ci chiedono i corsi',
    unoNuovo: 'Nuovo committente',
    unoModifica: 'Modifica committente',
    colonnaNome: 'Azienda / ente',
    campoNome: 'Azienda / ente',
    esempioNome: 'es. Omnia Service s.r.l.',
    cerca: 'Cerca per nome, partita IVA o referente…',
    filtra: 'Filtra per nome, partita IVA o referente…',
    vuota: 'Rubrica vuota: le aziende si aggiungono da qui o dal preventivo, con «Salva in rubrica».',
    vuotaDaPreventivo: 'La rubrica è vuota: compila il destinatario e usa «Salva in rubrica».',
    nessunRisultato: 'Nessuna azienda con questo nome.',
    mancaNome: 'Manca il nome dell\'azienda',
    aggiunto: 'Committente aggiunto in rubrica',
    aggiornato: 'Committente aggiornato',
    eliminato: 'Committente eliminato',
  },
});
