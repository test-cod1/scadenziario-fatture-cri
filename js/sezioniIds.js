// ============================================================
//  GLI ID DELLE SEZIONI DEL PORTALE
//  Un file minuscolo e senza dipendenze, perché lo leggono due mondi che non
//  si parlano: il portale nel browser (js/sezioni.js, che attorno a ogni id
//  costruisce card, menu, rotte e permessi) e il Worker
//  (functions/api/crea-utente.js, che deve sapere quali permessi accettare
//  quando si crea un utente).
//
//  Prima erano due elenchi scritti a mano, e infatti si erano disallineati:
//  aggiunta la sezione Straordinari al portale, il server continuava a non
//  conoscerla e scartava quel permesso IN SILENZIO — il form lo proponeva,
//  l'utente veniva creato senza, e nessuno vedeva un errore. Adesso l'elenco
//  è uno solo, e js/sezioni.js controlla di non essersene allontanato.
//
//  Gli id devono corrispondere a quelli della tabella public.sezioni su
//  Supabase: è la chiave esterna di public.autorizzazioni, cioè l'autorità
//  finale su cosa è una sezione.
// ============================================================

export const ID_SEZIONI = [
  'scadenziario',
  'formazione',
  'trasporti',
  'assistenze',
  'straordinari',
  'direttore',
];
