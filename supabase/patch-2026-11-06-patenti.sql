-- ============================================================
--  PATCH — Sezione Patenti
--  Data: 2026-11-06
--
--  1. La sezione nel portale (permessi come le altre: Operatore/Admin).
--  2. La tabella `richieste_patenti`: una riga per ogni modulo che un
--     volontario ha compilato dal link pubblico (patenti.html).
--
--  Chi scrive qui dal modulo non è un utente del portale: passa da
--  /api/patenti, che controlla i dati e scrive con la service role key.
--  Nessuna policy apre la tabella agli anonimi.
--
--  È idempotente.
-- ============================================================

-- 1. Sezione ---------------------------------------------------------------
insert into public.sezioni (id, etichetta, ordine) values
  ('patenti', 'Patenti', 9)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;

-- 2. Richieste -------------------------------------------------------------
create table if not exists public.richieste_patenti (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> '' and length(nome) <= 80),
  cognome text not null check (btrim(cognome) <> '' and length(cognome) <= 80),
  patente smallint not null check (patente between 1 and 8),
  percorso text not null check (percorso in ('diretta','pratica','esame')),
  -- I documenti che il volontario ha confermato di aver caricato su Gaia.
  documenti_gaia text[] not null default '{}',
  -- Avanzamento, lo segna la segreteria.
  stato text not null default 'nuova' check (stato in ('nuova','in_lavorazione','completata')),
  note text check (note is null or length(note) <= 2000),
  -- Impronta (non l'indirizzo) di chi ha inviato: serve solo a fermare
  -- chi usasse il modulo per riempire il database.
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists richieste_patenti_ip on public.richieste_patenti (ip_hash, created_at);
create index if not exists richieste_patenti_data on public.richieste_patenti (created_at desc);

alter table public.richieste_patenti enable row level security;

-- Chi ha accesso alla sezione legge e aggiorna (stato e note); eliminare
-- resta all'admin. L'inserimento lo fa solo il server.
drop policy if exists richieste_patenti_read on public.richieste_patenti;
create policy richieste_patenti_read on public.richieste_patenti for select
  using (public.accede_a('patenti'));
drop policy if exists richieste_patenti_update on public.richieste_patenti;
create policy richieste_patenti_update on public.richieste_patenti for update
  using (public.accede_a('patenti')) with check (public.accede_a('patenti'));
drop policy if exists richieste_patenti_delete on public.richieste_patenti;
create policy richieste_patenti_delete on public.richieste_patenti for delete
  using (public.e_admin_sezione('patenti'));

-- Dal portale si cambiano solo stato e note: i dati del volontario restano
-- quelli che ha mandato lui.
revoke update on public.richieste_patenti from authenticated;
grant update (stato, note, updated_at, updated_by) on public.richieste_patenti to authenticated;

-- Nel registro modifiche, come le altre tabelle di lavoro.
do $$
begin
  if to_regprocedure('public.trg_registro()') is not null then
    drop trigger if exists on_richieste_patenti_registro on public.richieste_patenti;
    create trigger on_richieste_patenti_registro after insert or update or delete on public.richieste_patenti
      for each row execute procedure public.trg_registro();
  end if;
end $$;

comment on table public.richieste_patenti is
  'Richieste di emissione o rinnovo delle patenti CRI, inviate dai volontari dal modulo pubblico';
