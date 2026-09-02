-- ============================================================
--  PATCH — Sconto sui preventivi delle assistenze sanitarie
--  Da eseguire dopo patch-2026-09-02-assistenze.sql.
--
--  Lo sconto si esprime in percentuale sul totale oppure come importo fisso
--  da togliere. La colonna `totale` continua a contenere quanto il cliente
--  deve davvero pagare (al netto): è il numero che conta nell'elenco e nelle
--  statistiche, e non deve dipendere da come è stato scritto lo sconto.
-- ============================================================

alter table public.preventivi_assistenze
  add column if not exists sconto_tipo text
    check (sconto_tipo in ('percentuale','valore')),
  add column if not exists sconto_valore numeric(12,2) check (sconto_valore >= 0);

comment on column public.preventivi_assistenze.sconto_tipo is
  'percentuale | valore — nullo quando non c''è sconto';
comment on column public.preventivi_assistenze.sconto_valore is
  'la percentuale (0-100) o l''importo in euro, secondo sconto_tipo';
