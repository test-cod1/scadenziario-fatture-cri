-- ============================================================
--  PATCH — Via matricola, telefono e ore di contratto
--          dall'anagrafica degli straordinari
--  Data: 2026-09-05
--
--  L'anagrafica era nata come copia ridotta del foglio mensile, dove
--  accanto al cognome c'erano la matricola e il "38" delle ore
--  settimanali. Nell'uso che si fa del registro non servono: le ore di
--  contratto non entrano in nessun calcolo (il saldo è straordinari meno
--  recuperi, non un confronto con l'orario ordinario), e matricola e
--  telefono sono dati del personale, che stanno dove si gestisce il
--  personale — qui erano tre campi in più da compilare e da tenere
--  aggiornati per niente.
--
--  Restano cognome, nome, note e il flag attivo: quanto basta a scegliere
--  una persona da un elenco.
--
--  Da eseguire insieme al deploy del codice che non li mostra più.
--  ATTENZIONE: elimina tre colonne e il loro contenuto. Se avevi già
--  compilato delle ore di contratto e vuoi conservarle, copia la tabella
--  prima di eseguire:
--    create table dipendenti_straordinari_backup_20260905 as
--      select * from public.dipendenti_straordinari;
--
--  È idempotente.
-- ============================================================

alter table public.dipendenti_straordinari drop column if exists matricola;
alter table public.dipendenti_straordinari drop column if exists telefono;
alter table public.dipendenti_straordinari drop column if exists ore_contratto;

comment on table public.dipendenti_straordinari is
  'Dipendenti a cui si possono richiedere straordinari: solo il nominativo, serve a scegliere un nome da un elenco';

-- ---------- VERIFICA ----------
-- Devono restare: id, cognome, nome, attivo, note, created_by,
-- created_at, updated_at. Niente matricola, telefono, ore_contratto.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'dipendenti_straordinari'
 order by ordinal_position;
