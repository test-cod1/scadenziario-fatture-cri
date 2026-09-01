-- ============================================================
--  PATCH — Sezione TRASPORTI (preventivi) dentro il portale
--  Da eseguire nell'SQL Editor di Supabase del PORTALE, dopo
--  patch-2026-09-01-portale.sql.
--
--  Porta dentro il portale le due tabelle che stavano sul progetto Supabase
--  dedicato del gestionale preventivo-trasporti. I dati veri si travasano a
--  parte, con supabase/export-trasporti.sql (da lanciare sul VECCHIO
--  progetto: stampa gli insert già pronti da incollare qui).
-- ============================================================

-- ---------- PREVENTIVI ----------
create table if not exists public.preventivi (
  id uuid primary key default gen_random_uuid(),
  titolo text,
  cliente text,
  data_servizio date,
  stato text not null default 'bozza' check (stato in ('bozza','inviato','confermato','annullato')),
  note text,
  tappe jsonb default '[]'::jsonb,        -- destinazioni [{label,lon,lat,iso2,iso3,paese}]
  andata_ritorno boolean default true,
  km_auto boolean default true,
  km_totali numeric(10,1),
  paese_dest text,                        -- ISO alpha-2 destinazione
  paese_dest_nome text,
  input jsonb,                            -- tutti i parametri di calcolo
  risultato jsonb,                        -- spesaReale, addebito, margine, ...
  created_by uuid references auth.users(id),
  -- Chi ha creato i preventivi importati dal vecchio gestionale: lì gli
  -- utenti erano account di un ALTRO progetto Supabase, e i loro id non
  -- esistono qui. L'email si porta dietro comunque l'informazione, senza
  -- inventare un collegamento che sarebbe falso.
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prev_created on public.preventivi(created_at desc);
create index if not exists idx_prev_stato on public.preventivi(stato);

-- ---------- IMPOSTAZIONI DEI PREVENTIVI (singleton) ----------
-- Parametri di calcolo, parco mezzi e prezzi carburante: una riga sola.
create table if not exists public.impostazioni_trasferte (
  id text primary key default 'default',
  dati jsonb not null,
  updated_at timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------
-- Chi ha accesso alla sezione trasporti legge e scrive; chiunque altro non
-- vede nulla. Nel gestionale di provenienza le impostazioni le modificava
-- anche l'operatore (sono i parametri del preventivo di tutti i giorni, non
-- una configurazione di sistema): quella regola resta, per non togliere una
-- funzione a chi la usava.
alter table public.preventivi             enable row level security;
alter table public.impostazioni_trasferte enable row level security;

drop policy if exists prev_read on public.preventivi;
create policy prev_read on public.preventivi for select using (public.accede_a('trasporti'));
drop policy if exists prev_write on public.preventivi;
create policy prev_write on public.preventivi for all
  using (public.accede_a('trasporti')) with check (public.accede_a('trasporti'));

drop policy if exists imp_trasf_read on public.impostazioni_trasferte;
create policy imp_trasf_read on public.impostazioni_trasferte for select using (public.accede_a('trasporti'));
drop policy if exists imp_trasf_write on public.impostazioni_trasferte;
create policy imp_trasf_write on public.impostazioni_trasferte for all
  using (public.accede_a('trasporti')) with check (public.accede_a('trasporti'));

-- ============================================================
--  DOPO L'ESECUZIONE:
--   1. lancia supabase/export-trasporti.sql sul VECCHIO progetto
--      (qgqjczswthmfxltztmgi) e incolla qui il risultato;
--   2. dal portale, in "Utenti e autorizzazioni", dai la sezione
--      "Trasporti lunghi" a chi usava il vecchio gestionale;
--   3. su Cloudflare aggiungi il secret ORS_KEY al Worker del portale
--      (stesso valore che aveva il progetto preventivo-trasporti).
-- ============================================================
