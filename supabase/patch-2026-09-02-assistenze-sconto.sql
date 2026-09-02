-- ============================================================
--  PATCH — Sconti sui preventivi delle assistenze sanitarie
--  Da eseguire dopo patch-2026-09-02-assistenze.sql.
--
--  Due campi indipendenti, utilizzabili anche insieme: una percentuale sul
--  totale e un importo fisso. La colonna `totale` continua a contenere
--  quanto il cliente deve davvero pagare (al netto degli sconti): è il
--  numero che conta nell'elenco e nelle statistiche, e non deve dipendere
--  da come lo sconto è stato scritto.
--
--  Se hai già eseguito la primissima versione di questa patch (quella con
--  `sconto_tipo`), gli `alter` qui sotto la portano alla forma nuova senza
--  perdere nulla: chi aveva uno sconto in percentuale se lo ritrova nella
--  colonna giusta.
-- ============================================================

alter table public.preventivi_assistenze
  add column if not exists sconto_percentuale numeric(5,2)
    check (sconto_percentuale >= 0 and sconto_percentuale <= 100),
  add column if not exists sconto_valore numeric(12,2) check (sconto_valore >= 0);

-- Migrazione dalla versione precedente (campo unico + tipo), se presente.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preventivi_assistenze'
      and column_name = 'sconto_tipo'
  ) then
    update public.preventivi_assistenze
      set sconto_percentuale = sconto_valore, sconto_valore = null
      where sconto_tipo = 'percentuale';
    alter table public.preventivi_assistenze drop column sconto_tipo;
  end if;
end $$;

comment on column public.preventivi_assistenze.sconto_percentuale is
  'sconto in percentuale sul totale (0-100), nullo se non applicato';
comment on column public.preventivi_assistenze.sconto_valore is
  'sconto in euro, tolto da quanto resta dopo la percentuale; nullo se non applicato';
