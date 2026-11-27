-- ============================================================
--  PATCH — Registro accessi al portale
--  Data: 2026-11-27
--
--  Il registro modifiche dice chi ha cambiato cosa; questo dice chi è
--  entrato, quando, da quale dispositivo e fino a quando ha usato il
--  portale. Una riga per sessione:
--
--  - inizio:   la sessione nasce in Supabase Auth (login con email oppure
--              con nome e cognome: entrambi finiscono in auth.sessions);
--  - attivita: l'ultimo rinnovo del token, circa una volta l'ora finché la
--              scheda resta aperta;
--  - fine:     la sessione viene chiusa («Esci», password cambiata, sessione
--              scaduta e ripulita da Supabase).
--
--  Lo scrivono i trigger su auth.sessions, che girano come proprietario: il
--  browser non può né scriverlo né falsarlo. Lo legge solo il super admin
--  (pagina «Registro accessi»). Nessun indirizzo IP: per gli accessi con
--  nome e cognome sarebbe quello del server Cloudflare, non della persona.
--
--  Un errore qui NON deve mai impedire un login: ogni trigger inghiotte i
--  propri errori (exception when others). Al peggio manca una riga.
--
--  Si tiene un anno: pulisci_registro_accessi() toglie il resto.
--  È idempotente.
-- ============================================================

create table if not exists public.registro_accessi (
  id bigint generated always as identity primary key,
  sessione_id uuid unique,
  utente_id uuid,
  utente_email text,
  utente_nome text,
  inizio timestamptz not null default now(),
  attivita timestamptz,
  fine timestamptz,
  dispositivo text          -- lo user agent del browser
);
create index if not exists idx_accessi_inizio on public.registro_accessi(inizio desc);
create index if not exists idx_accessi_utente on public.registro_accessi(utente_id);

alter table public.registro_accessi enable row level security;
drop policy if exists accessi_sa_read on public.registro_accessi;
create policy accessi_sa_read on public.registro_accessi for select using (public.e_super_admin());

create or replace function public.pulisci_registro_accessi()
returns void language sql security definer set search_path = public as $$
  delete from public.registro_accessi where inizio < now() - interval '1 year';
$$;

-- Le colonne di auth.sessions si leggono dal jsonb e non per nome: cambiano
-- tra versioni di Supabase Auth, e un nome sparito farebbe fallire il trigger.
create or replace function public.trg_accessi_sessioni()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_utente uuid;
begin
  begin
    if tg_op = 'INSERT' then
      v := to_jsonb(new);
      v_utente := (v ->> 'user_id')::uuid;
      insert into public.registro_accessi (sessione_id, utente_id, utente_email, utente_nome, inizio, attivita, dispositivo)
      select (v ->> 'id')::uuid, v_utente, u.email, p.nome,
             coalesce((v ->> 'created_at')::timestamptz, now()), coalesce((v ->> 'created_at')::timestamptz, now()),
             left(v ->> 'user_agent', 500)
        from auth.users u left join public.profili p on p.id = u.id
       where u.id = v_utente
      on conflict (sessione_id) do nothing;
      if exists (select 1 from public.registro_accessi where inizio < now() - interval '1 year') then
        perform public.pulisci_registro_accessi();
      end if;
    elsif tg_op = 'UPDATE' then
      v := to_jsonb(new);
      update public.registro_accessi
         set attivita = greatest(attivita, coalesce((v ->> 'refreshed_at')::timestamptz, (v ->> 'updated_at')::timestamptz, now()))
       where sessione_id = (v ->> 'id')::uuid;
    else
      update public.registro_accessi set fine = now()
       where sessione_id = (to_jsonb(old) ->> 'id')::uuid and fine is null;
    end if;
  exception when others then
    raise warning 'registro_accessi: %', sqlerrm;
  end;
  return null;
end; $$;

drop trigger if exists on_sessione_registro_accessi on auth.sessions;
create trigger on_sessione_registro_accessi
  after insert or update or delete on auth.sessions
  for each row execute procedure public.trg_accessi_sessioni();

-- Le sessioni già aperte al momento della patch: senza, chi è dentro adesso
-- comparirebbe solo al prossimo login.
insert into public.registro_accessi (sessione_id, utente_id, utente_email, utente_nome, inizio, attivita, dispositivo)
select (to_jsonb(s) ->> 'id')::uuid, s.user_id, u.email, p.nome,
       s.created_at, coalesce((to_jsonb(s) ->> 'refreshed_at')::timestamptz, s.updated_at, s.created_at),
       left(to_jsonb(s) ->> 'user_agent', 500)
  from auth.sessions s join auth.users u on u.id = s.user_id
  left join public.profili p on p.id = u.id
on conflict (sessione_id) do nothing;

revoke all on function public.trg_accessi_sessioni() from public, anon, authenticated;
revoke all on function public.pulisci_registro_accessi() from public, anon, authenticated;
