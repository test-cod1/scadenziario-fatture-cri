// ============================================================
//  ACCESSO CON NOME E COGNOME
//  Tutti possono entrare scrivendo nome e cognome invece dell'email.
//  Il nome è quello del profilo, come compare in Utenti. In più, chi
//  condivide una casella (Supabase vuole un'email diversa per ogni account,
//  quindi ognuno ha un alias «+» della casella comune, che nessuno ricorda)
//  può avere un nome di accesso in app_metadata.nome_accesso.
//
//  Entrambi li scrive solo un amministratore (l'utente non può cambiarseli
//  da sé). /api/email-accesso trova l'account dal nome e fa il login lato
//  server, con i suoi limiti ai tentativi; l'email non torna al browser.
//
//  Il confronto ignora maiuscole, accenti, spazi in più e l'ordine delle
//  parole: «Duray Nayyab», «nayyab duray» e « DURAY  NAYYAB » sono la
//  stessa persona.
// ============================================================

export function normalizzaNome(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9' -]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .sort()
    .join(' ');
}

// È un'email (si entra come prima) o un nome da tradurre?
export function sembraEmail(s) {
  return String(s ?? '').includes('@');
}
