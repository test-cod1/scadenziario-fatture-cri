-- ============================================================
--  PATCH 2026-08-30 — Rimuove la scadenza dalle fatture attive
-- ------------------------------------------------------------
--  Su richiesta: le fatture attive non tracciano più una data di scadenza
--  (restano invariate le fatture passive/fornitori, dove la scadenza è
--  ancora usata per alert e filtri). Elimina definitivamente anche i
--  valori già salvati: se serve un backup, esportali prima con
--  "select id, cliente, numero_fattura, scadenza from public.fatture_attive
--  where scadenza is not null;".
--  Su un database creato dopo il 30/08/2026 questo patch non serve:
--  schema.sql non crea più questa colonna.
-- ============================================================

drop index if exists public.idx_fatture_attive_scadenza;
alter table public.fatture_attive drop column if exists scadenza;
