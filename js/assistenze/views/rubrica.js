// ============================================================
//  RUBRICA DEI CLIENTI DELLE ASSISTENZE
//  L'elenco di chi ci commissiona le assistenze. Si riempie soprattutto da
//  solo — dal preventivo, con "Salva in rubrica" — e qui si sistemano le
//  schede: correggere un indirizzo, aggiungere il telefono del referente,
//  togliere un cliente che non c'è più.
//
//  Il funzionamento sta in js/lib/rubrica.js, condiviso con la formazione
//  esterna: qui restano lo store di questa sezione e le sue parole. I dati
//  delle due sezioni NON si mescolano, sono due tabelle con permessi
//  separati.
// ============================================================
import { clienti } from '../data/store.js';
import { creaRubrica } from '../../lib/rubrica.js';

export const { renderRubrica, schedaCliente, scegliCliente } = creaRubrica({
  clienti,
  testi: {
    titolo: 'Rubrica clienti',
    sottotitolo: 'Enti e società per cui prepariamo le assistenze',
    unoNuovo: 'Nuovo cliente',
    unoModifica: 'Modifica cliente',
    colonnaNome: 'Cliente',
    campoNome: 'Nome del cliente / ente',
    esempioNome: 'es. Comune di Genova',
    cerca: 'Cerca per nome, codice fiscale o referente…',
    filtra: 'Filtra per nome, codice fiscale o referente…',
    vuota: 'Rubrica vuota: i clienti si aggiungono da qui o dal preventivo, con «Salva in rubrica».',
    vuotaDaPreventivo: 'La rubrica è vuota: compila il destinatario e usa «Salva in rubrica».',
    nessunRisultato: 'Nessun cliente con questo nome.',
    mancaNome: 'Manca il nome del cliente',
    aggiunto: 'Cliente aggiunto in rubrica',
    aggiornato: 'Cliente aggiornato',
    eliminato: 'Cliente eliminato',
  },
});
