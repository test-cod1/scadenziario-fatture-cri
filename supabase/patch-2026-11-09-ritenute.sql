-- ============================================================
--  PATCH — Ritenute d'acconto sulle fatture passive
--  Data: 2026-11-09
--
--  Quando il Comitato paga un professionista (o un altro percipiente
--  soggetto a ritenuta), trattiene la ritenuta d'acconto e la versa lui
--  all'Erario con l'F24, entro il 16 del mese successivo a quello del
--  PAGAMENTO (non della fattura). Fin qui lo scadenziario registrava solo
--  il netto da pagare, e la ritenuta restava scritta, quando andava bene,
--  nelle note: per sapere quanto versare il 16 bisognava ricostruirlo a mano.
--
--  1. Due colonne sulle fatture passive:
--     - ritenuta: l'importo della ritenuta d'acconto (null = fattura senza
--       ritenuta). L'importo della fattura resta il NETTO da pagare, come
--       già prima: la ritenuta non passa dal fornitore.
--     - ritenuta_codice_tributo: il codice tributo con cui si versa
--       (1040 per il lavoro autonomo, il caso di gran lunga più comune).
--
--  2. Una tabella ritenute_versamenti: un F24 versato per ogni mese di
--     competenza (il mese dei pagamenti), con data e importo. Serve a
--     sapere quali mesi sono già stati versati e quali no.
--     Legge chi legge lo scadenziario; scrive solo l'admin, come per i
--     pagamenti: è lui che paga davvero.
--
--  Va eseguita PRIMA di pubblicare la versione dell'app che mostra le
--  ritenute: altrimenti il salvataggio di una fattura fallisce perché le
--  colonne non esistono.
--
--  È idempotente.
-- ============================================================

alter table public.fatture
  add column if not exists ritenuta numeric(12,2),
  add column if not exists ritenuta_codice_tributo text;

alter table public.fatture drop constraint if exists fatture_ritenuta_check;
alter table public.fatture add constraint fatture_ritenuta_check
  check (ritenuta is null or ritenuta > 0);

create index if not exists idx_fatture_ritenuta on public.fatture(ritenuta) where ritenuta is not null;

create table if not exists public.ritenute_versamenti (
  id uuid primary key default gen_random_uuid(),
  -- primo giorno del mese di competenza (il mese dei pagamenti)
  mese date not null unique check (extract(day from mese) = 1),
  data_versamento date not null,
  importo numeric(12,2) not null check (importo >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.ritenute_versamenti enable row level security;
drop policy if exists ritenute_versamenti_read on public.ritenute_versamenti;
create policy ritenute_versamenti_read on public.ritenute_versamenti for select using (public.puo_leggere());
drop policy if exists ritenute_versamenti_write on public.ritenute_versamenti;
create policy ritenute_versamenti_write on public.ritenute_versamenti for all
  using (public.e_admin()) with check (public.e_admin());

-- Registro modifiche, come tutte le altre tabelle dello scadenziario.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'trg_registro') then
    drop trigger if exists on_ritenute_versamenti_registro on public.ritenute_versamenti;
    create trigger on_ritenute_versamenti_registro after insert or update or delete on public.ritenute_versamenti
      for each row execute procedure public.trg_registro();
  end if;
end $$;

-- Fa rileggere subito lo schema all'API REST (altrimenti le colonne nuove
-- possono risultare sconosciute per qualche minuto).
notify pgrst, 'reload schema';
