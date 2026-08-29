-- ============================================================
--  PATCH — sezione Impostazioni: scadenza di default (giorni)
--  Da eseguire nell'SQL Editor di Supabase sul progetto dello
--  Scadenziario (è idempotente: si può rilanciare).
--  Le stesse modifiche sono già riportate in schema.sql.
-- ============================================================

-- Tabella a riga singola: contiene la configurazione globale dell'app.
-- Per ora un solo valore: quanti giorni aggiungere alla data fattura quando
-- una fattura non riporta una scadenza (né dall'AI, né dall'XML, né a mano).
create table if not exists public.impostazioni (
  id smallint primary key default 1 check (id = 1),
  giorni_scadenza_default integer not null default 60 check (giorni_scadenza_default >= 0),
  updated_at timestamptz default now()
);
insert into public.impostazioni (id) values (1) on conflict (id) do nothing;

drop trigger if exists on_impostazioni_updated_at on public.impostazioni;
create trigger on_impostazioni_updated_at
  before update on public.impostazioni
  for each row execute procedure public.trg_fatture_updated_at();

alter table public.impostazioni enable row level security;

drop policy if exists impostazioni_read on public.impostazioni;
create policy impostazioni_read on public.impostazioni for select using (public.puo_leggere());
drop policy if exists impostazioni_write on public.impostazioni;
create policy impostazioni_write on public.impostazioni for update
  using (public.e_admin()) with check (public.e_admin());
