-- ============================================================
--  PATCH — Tipo documento (fattura / F24) e note di credito passive
--  Data: 2026-11-07
--
--  1. TIPO DOCUMENTO. Nello scadenziario passivo finiscono anche le rate
--     dei modelli F24 (imposte), che non sono fatture ma vanno pagate a
--     scadenza come loro. Si distinguono con una colonna: tutte le righe
--     già registrate restano 'fattura'. Lo stato, i pagamenti e le
--     scadenze funzionano allo stesso modo per entrambi i tipi.
--
--  2. NOTE DI CREDITO. Sul database in uso la tabella note_credito era
--     rimasta alla prima versione, con una colonna fattura_id e una
--     colonna importo obbligatorie: oggi la fattura stornata e l'importo
--     stanno in note_credito_righe (una nota può stornarne più d'una), e
--     l'app non le valorizza. Risultato: registrare una nota di credito
--     dall'app falliva sempre con «null value in column fattura_id».
--     Le due colonne restano (le note caricate il 07/11/2026 le hanno
--     valorizzate) ma diventano facoltative.
--
--  Va eseguita PRIMA di pubblicare la versione dell'app che manda
--  tipo_documento: altrimenti il salvataggio di una fattura fallisce
--  perché la colonna non esiste.
--
--  È idempotente.
-- ============================================================

alter table public.fatture
  add column if not exists tipo_documento text not null default 'fattura';

alter table public.fatture drop constraint if exists fatture_tipo_documento_check;
alter table public.fatture add constraint fatture_tipo_documento_check
  check (tipo_documento in ('fattura','f24'));

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'note_credito' and column_name = 'fattura_id') then
    alter table public.note_credito alter column fattura_id drop not null;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'note_credito' and column_name = 'importo') then
    alter table public.note_credito alter column importo drop not null;
  end if;
end $$;

-- Fa rileggere subito lo schema all'API REST (altrimenti la colonna nuova
-- può risultare sconosciuta per qualche minuto).
notify pgrst, 'reload schema';
