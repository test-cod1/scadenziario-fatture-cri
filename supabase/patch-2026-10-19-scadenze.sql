-- ============================================================
--  PATCH — Sezione Scadenze
--  Data: 2026-10-19
--
--  Un posto unico per le scadenze di ogni tipo che non sono fatture né
--  impegni della direzione: assicurazioni e bolli dei mezzi, revisioni,
--  contratti e abbonamenti da rinnovare, certificazioni, adempimenti,
--  corsi da ripetere, licenze software… La categoria è libera (la pagina
--  suggerisce quelle già usate), e una scadenza può ripetersi: segnandola
--  fatta, la successiva nasce da sola alla data giusta.
--
--  1. La sezione nel portale (permessi come le altre: Operatore/Admin).
--  2. La tabella `scadenze`, con le sue policy: legge e scrive chi ha
--     accesso alla sezione; cancella l'admin della sezione, o chi l'ha
--     appena creata (primi 15 minuti).
--  3. Autore, registro modifiche e (se la patch dei promemoria c'è) la
--     voce "Scadenze" fra le cose che i promemoria email possono mandare.
--
--  È idempotente.
-- ============================================================

-- 1. Sezione ---------------------------------------------------------------
insert into public.sezioni (id, etichetta, ordine) values
  ('scadenze', 'Scadenze', 8)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;

-- 2. Tabella ---------------------------------------------------------------
create table if not exists public.scadenze (
  id uuid primary key default gen_random_uuid(),
  titolo text not null check (btrim(titolo) <> ''),
  categoria text not null default 'Altro',
  data_scadenza date not null,
  -- Ogni quanto si ripete: segnandola fatta nasce la successiva.
  ricorrenza text not null default 'nessuna'
    check (ricorrenza in ('nessuna','mensile','bimestrale','trimestrale','semestrale','annuale','biennale','triennale','quinquennale')),
  -- Quanti giorni prima comincia a "chiamare" (pagina e promemoria email).
  preavviso_giorni integer not null default 30 check (preavviso_giorni between 0 and 365),
  riferimento text,          -- targa, n. di polizza, contratto, fornitore…
  responsabile text,
  importo numeric(12,2) check (importo is null or importo >= 0),
  note text,
  fatta boolean not null default false,
  fatta_il timestamptz,
  -- La scadenza da cui questa è nata (ricorrenze): serve ad annullare.
  precedente_id uuid references public.scadenze(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scadenze_aperte on public.scadenze(fatta, data_scadenza);
create index if not exists idx_scadenze_categoria on public.scadenze(categoria);

alter table public.scadenze enable row level security;
drop policy if exists scadenze_read on public.scadenze;
create policy scadenze_read on public.scadenze for select
  using (public.accede_a('scadenze'));
drop policy if exists scadenze_insert on public.scadenze;
create policy scadenze_insert on public.scadenze for insert
  with check (public.accede_a('scadenze'));
drop policy if exists scadenze_update on public.scadenze;
create policy scadenze_update on public.scadenze for update
  using (public.accede_a('scadenze')) with check (public.accede_a('scadenze'));
-- Cancella l'admin della sezione; chi l'ha appena creata può toglierla
-- nei primi 15 minuti (un errore di battitura, o l'"Annulla" dopo una
-- spunta che ha fatto nascere la scadenza successiva).
drop policy if exists scadenze_delete on public.scadenze;
create policy scadenze_delete on public.scadenze for delete
  using (public.e_admin_sezione('scadenze')
         or (public.accede_a('scadenze') and created_by = auth.uid()
             and created_at > now() - interval '15 minutes'));

-- La data di creazione la scrive il database e non cambia più: la regola
-- dei "primi 15 minuti" per cancellare si basa su questa, e un client che
-- potesse riscriverla potrebbe cancellare quando vuole.
create or replace function public.trg_scadenze_creazione()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.created_at := now();
  else new.created_at := old.created_at;
  end if;
  return new;
end; $$;
drop trigger if exists on_scadenze_creazione on public.scadenze;
create trigger on_scadenze_creazione before insert or update on public.scadenze
  for each row execute procedure public.trg_scadenze_creazione();

-- 3. Autore, registro, promemoria ------------------------------------------
do $$
begin
  if to_regprocedure('public.trg_forza_autore()') is not null then
    drop trigger if exists on_scadenze_autore on public.scadenze;
    create trigger on_scadenze_autore before insert or update on public.scadenze
      for each row execute procedure public.trg_forza_autore();
  end if;
  if to_regprocedure('public.trg_registro()') is not null then
    drop trigger if exists on_scadenze_registro on public.scadenze;
    create trigger on_scadenze_registro after insert or update or delete on public.scadenze
      for each row execute procedure public.trg_registro();
  end if;
  if to_regclass('public.notifiche_preferenze') is not null then
    alter table public.notifiche_preferenze add column if not exists scadenze boolean not null default true;
  end if;
end $$;
