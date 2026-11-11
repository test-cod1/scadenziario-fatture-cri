-- ============================================================
--  PATCH — ANALISI STACCATA DALLO SCADENZIARIO
--  Data: 2026-11-11
--
--  Fino a oggi i centri di costo non avevano numeri propri: prendevano
--  in prestito le fatture dello scadenziario e dicevano soltanto quanto
--  di ciascuna pesava su quale attività (tabella `imputazioni`). Ne
--  seguiva che un costo poteva entrare in un centro solo se prima era
--  stato registrato come fattura da pagare — e i costi di un'attività
--  non sono tutti fatture dello scadenziario: il carburante pagato con le
--  carte, un intervento già saldato, un costo stimato, un ricavo che non
--  passa da una fattura attiva.
--
--  Da qui Analisi tiene i SUOI movimenti: entrate e uscite scritte nel
--  centro di costo, con data, controparte, documento e importo. Nessuna
--  lettura e nessun legame con le tabelle delle fatture, in un verso o
--  nell'altro:
--
--   1. nuova tabella `movimenti_analisi`;
--   2. via `imputazioni`, i suoi trigger e quello sulle fatture che le
--      proteggeva (alla data della patch la tabella è vuota: la patch si
--      ferma da sola se non lo fosse, invece di cancellare quote);
--   3. `puo_leggere()` torna allo scadenziario soltanto: chi ha solo la
--      sezione Analisi non legge più le fatture del Comitato;
--   4. i centri di costo si leggono solo da Analisi.
--
--  È idempotente.
-- ============================================================

-- ---------- 0. Non si butta via niente per sbaglio ----------
do $$
begin
  if to_regclass('public.imputazioni') is not null
     and exists (select 1 from public.imputazioni) then
    raise exception 'La tabella imputazioni contiene dati: trasformali in movimenti_analisi prima di eseguire questa patch.';
  end if;
end $$;

-- ---------- 1. I movimenti di Analisi ----------
create table if not exists public.movimenti_analisi (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centri_costo(id) on delete cascade,
  -- 'uscita' = un costo dell'attività, 'entrata' = un ricavo.
  tipo text not null check (tipo in ('entrata','uscita')),
  data date,
  controparte text,               -- fornitore o cliente
  documento text,                 -- es. «Fatt. 1250 del 31/07/2025»
  descrizione text,               -- che cosa è: «rifornimento», «tagliando»
  -- Sempre positivo: il verso lo dice `tipo`. Un importo che cambia segno
  -- a seconda di chi lo scrive è il modo più rapido di sbagliare un totale.
  importo numeric(12,2) not null check (importo > 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_movimenti_analisi_centro on public.movimenti_analisi(centro_id);
create index if not exists idx_movimenti_analisi_data on public.movimenti_analisi(data);

alter table public.movimenti_analisi enable row level security;

-- Leggere e registrare movimenti è il lavoro di chi ha la sezione;
-- creare e chiudere i centri resta dell'admin (policy più sotto).
drop policy if exists movimenti_analisi_read on public.movimenti_analisi;
create policy movimenti_analisi_read on public.movimenti_analisi for select to authenticated
  using (public.accede_a('analisi'));
drop policy if exists movimenti_analisi_write on public.movimenti_analisi;
create policy movimenti_analisi_write on public.movimenti_analisi for all to authenticated
  using (public.accede_a('analisi')) with check (public.accede_a('analisi'));

-- Nel registro delle modifiche del portale, come le altre tabelle
-- (patch-2026-10-18-registro.sql).
drop trigger if exists on_movimenti_analisi_registro on public.movimenti_analisi;
create trigger on_movimenti_analisi_registro after insert or update or delete on public.movimenti_analisi
  for each row execute procedure public.trg_registro();

-- ---------- 2. Via le imputazioni sulle fatture ----------
drop trigger if exists fatture_importo_imputato on public.fatture;
drop trigger if exists fatture_attive_importo_imputato on public.fatture_attive;
drop function if exists public.trg_fatture_importo_imputato();
drop table if exists public.imputazioni;
drop function if exists public.trg_imputazioni_controlla();

-- ---------- 3. Le fatture si leggono solo dallo scadenziario ----------
create or replace function public.puo_leggere()
returns boolean language sql stable security definer set search_path = public as $$
  select public.accede_a('scadenziario');
$$;

-- ---------- 4. I centri di costo sono di Analisi ----------
drop policy if exists centri_costo_read on public.centri_costo;
create policy centri_costo_read on public.centri_costo for select to authenticated
  using (public.accede_a('analisi'));

comment on table public.centri_costo is
  'Attività seguite dalla sezione Analisi: ognuna ha i suoi movimenti in movimenti_analisi';
comment on table public.movimenti_analisi is
  'Entrate e uscite di un centro di costo, registrate in Analisi: nessun legame con lo scadenziario';

-- ---------- VERIFICA ----------
-- movimenti a zero, imputazioni sparita (null), lettura fatture solo da scadenziario.
select (select count(*) from public.movimenti_analisi) as movimenti,
       to_regclass('public.imputazioni')               as imputazioni,
       pg_get_functiondef('public.puo_leggere()'::regprocedure) like '%analisi%' as analisi_legge_ancora_le_fatture;
