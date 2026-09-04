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
-- key, che bypassa le RLS.
--
-- NOTA (04/09/2026): questo file diceva anche che il flag lo azzera l'utente
-- stesso "grazie alla policy prof_update_self". Era vero, ed era il problema:
-- bastava una PATCH per spegnerlo senza cambiare davvero la password. Da
-- patch-2026-09-04-permessi-profili.sql il flag lo spegne un trigger su
-- auth.users che guarda l'hash della password, e la policy congela la colonna.
alter table public.profili
  add column if not exists deve_cambiare_password boolean not null default false;
