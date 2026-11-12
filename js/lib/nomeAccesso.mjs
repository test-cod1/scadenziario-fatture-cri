// ============================================================
//  ACCESSO CON NOME E COGNOME
//  Alcuni account entrano scrivendo nome e cognome invece dell'email.
//  Serve quando più persone condividono la stessa casella: Supabase vuole
//  un'email diversa per ogni account, quindi ognuna ha un alias «+» della
//  casella comune (genova.amministrazione+nayyab@…, che Gmail recapita a
//  genova.amministrazione@…), ma un alias così non lo ricorda nessuno.
//
//  Il nome con cui si entra sta in app_metadata.nome_accesso dell'utente
//  Supabase: lo scrive solo la service role key (l'utente non può
//  cambiarselo da sé), e un account senza quel campo si trova solo per email.
//  /api/email-accesso traduce il nome nell'email, poi il login prosegue
//  come sempre dal browser verso Supabase — con i suoi limiti ai tentativi.
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
