-- ============================================================
--  PATCH — LINK DI SOLA LETTURA DEI CENTRI DI COSTO
--  Data: 2026-11-11
--
--  Il conto di un'attività va spesso mostrato a chi il portale non ce
--  l'ha: un consigliere, il referente di una convenzione, un revisore.
--  Ogni centro può avere un link («…/centro-condiviso.html#codice») che
--  apre una pagina di sola lettura con i suoi numeri.
--
--  Il codice sta in `link_token`: 32 byte casuali in base64url (43
--  caratteri), come quello dei dati di fatturazione. Chi ha il link vede
--  quel centro e nient'altro; null = nessun link attivo. Rigenerarlo
--  invalida il link vecchio.
--
--  Nessuna policy nuova per gli anonimi: la pagina pubblica non legge il
--  database, chiede a /api/centro-condiviso, che controlla il codice e
--  legge con la service role key soltanto i campi da mostrare. Crearlo e
--  toglierlo è dell'admin di Analisi, come ogni altra modifica al centro
--  (policy centri_costo_write).
--
--  È idempotente.
-- ============================================================

alter table public.centri_costo add column if not exists link_token text;
alter table public.centri_costo add column if not exists link_creato_il timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'centri_costo_link_token_forma') then
    alter table public.centri_costo add constraint centri_costo_link_token_forma
      check (link_token is null or link_token ~ '^[A-Za-z0-9_-]{43}$');
  end if;
end $$;
create unique index if not exists ux_centri_costo_link_token
  on public.centri_costo (link_token) where link_token is not null;

-- ---------- VERIFICA ----------
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'centri_costo' and column_name like 'link_%';
