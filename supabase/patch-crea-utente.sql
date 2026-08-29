-- ============================================================
--  PATCH — creazione utenti da admin con password provvisoria
--  Da eseguire nell'SQL Editor di Supabase sul progetto dello
--  Scadenziario (è idempotente: si può rilanciare).
--  Le stesse modifiche sono già riportate in schema.sql.
-- ============================================================

-- true per gli utenti creati da un admin (endpoint /api/crea-utente) con una
-- password provvisoria generata automaticamente: l'app li costringe a
-- impostarne una propria al primo accesso, prima di mostrare qualunque altra
-- pagina. Nessuna policy nuova serve: l'endpoint scrive con la service role
-- key (bypassa le RLS), e l'utente stesso può già azzerare il flag sul
-- proprio profilo grazie alla policy prof_update_self esistente.
alter table public.profili
  add column if not exists deve_cambiare_password boolean not null default false;
