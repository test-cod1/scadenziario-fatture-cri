-- ============================================================
--  PATCH — Idee del Direttore, anche da Telegram
--  Data: 2026-10-19
--
--  1. `idee_direttore`: le idee annotate al volo, dal portale o scrivendo
--     al bot Telegram. Ognuna ha uno stato (nuova → in valutazione →
--     approvata / scartata / realizzata) e può diventare un impegno.
--     Legge e scrive chi ha accesso alla sezione Direttore; l'autore lo
--     scrive il database.
--  2. `telegram_collegamenti`: quale chat Telegram appartiene a quale
--     utente. Si crea solo con un codice monouso generato dal portale
--     (genera_codice_telegram, 15 minuti di validità) e mandato al bot;
--     l'abbinamento chat → utente lo fa il webhook /api/telegram con la
--     service role. Dal browser ognuno vede e può cancellare solo il suo.
--
--  È idempotente.
-- ============================================================

-- 1. Idee ------------------------------------------------------------------
create table if not exists public.idee_direttore (
  id uuid primary key default gen_random_uuid(),
  testo text not null check (btrim(testo) <> '' and length(testo) <= 4000),
  stato text not null default 'nuova'
    check (stato in ('nuova', 'in_valutazione', 'approvata', 'scartata', 'realizzata')),
  origine text not null default 'portale' check (origine in ('portale', 'telegram')),
  autore_id uuid references auth.users(id) on delete set null,
  autore_nome text,
  -- L'impegno nato da questa idea, se c'è.
  impegno_id uuid references public.impegni_direttore(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_idee_dir_stato on public.idee_direttore(stato, created_at desc);

alter table public.idee_direttore enable row level security;
drop policy if exists idee_dir_read on public.idee_direttore;
create policy idee_dir_read on public.idee_direttore for select
  using (public.accede_a('direttore'));
drop policy if exists idee_dir_write on public.idee_direttore;
create policy idee_dir_write on public.idee_direttore for all
  using (public.accede_a('direttore')) with check (public.accede_a('direttore'));

-- Autore: dal portale è chi è collegato, e non si cambia dopo. Dal webhook
-- Telegram (service role, auth.uid() nullo) lo scrive il webhook stesso.
create or replace function public.trg_idee_autore()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.autore_id := auth.uid();
      select p.nome into new.autore_nome from public.profili p where p.id = auth.uid();
      new.origine := 'portale';
    end if;
  else
    new.autore_id := old.autore_id;
    new.autore_nome := old.autore_nome;
    new.origine := old.origine;
    new.created_at := old.created_at;
  end if;
  return new;
end; $$;
drop trigger if exists on_idee_autore on public.idee_direttore;
create trigger on_idee_autore before insert or update on public.idee_direttore
  for each row execute procedure public.trg_idee_autore();
revoke all on function public.trg_idee_autore() from public, anon, authenticated;

-- 2. Collegamenti Telegram -------------------------------------------------
create table if not exists public.telegram_collegamenti (
  utente_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint unique,
  telegram_nome text,
  codice text unique,
  codice_scade timestamptz,
  collegato_il timestamptz
);

alter table public.telegram_collegamenti enable row level security;
drop policy if exists telegram_propri_read on public.telegram_collegamenti;
create policy telegram_propri_read on public.telegram_collegamenti for select
  using (utente_id = auth.uid());
drop policy if exists telegram_propri_delete on public.telegram_collegamenti;
create policy telegram_propri_delete on public.telegram_collegamenti for delete
  using (utente_id = auth.uid());
-- Nessuna policy di insert/update: si scrive solo con la funzione qui
-- sotto (il codice) e con la service role (l'abbinamento della chat).

-- Codice monouso per collegare il proprio Telegram: 8 caratteri, valido 15
-- minuti. Solo chi ha accesso al Direttore. Generarne uno nuovo invalida il
-- precedente; il collegamento già fatto resta finché non si scollega.
create or replace function public.genera_codice_telegram()
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_codice text;
begin
  if not public.accede_a('direttore') then
    raise exception 'Non autorizzato: serve l''accesso alla sezione Direttore.';
  end if;
  v_codice := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.telegram_collegamenti (utente_id, codice, codice_scade)
  values (auth.uid(), v_codice, now() + interval '15 minutes')
  on conflict (utente_id) do update set codice = excluded.codice, codice_scade = excluded.codice_scade;
  return v_codice;
end; $$;
revoke all on function public.genera_codice_telegram() from public, anon;
grant execute on function public.genera_codice_telegram() to authenticated;

-- 3. Registro modifiche (se c'è) --------------------------------------------
do $$
begin
  if to_regprocedure('public.trg_registro()') is not null then
    drop trigger if exists on_idee_direttore_registro on public.idee_direttore;
    create trigger on_idee_direttore_registro after insert or update or delete on public.idee_direttore
      for each row execute procedure public.trg_registro();
  end if;
end $$;
