-- ============================================================
--  PATCH — Promemoria email (facoltativi, ognuno decide per sé)
--  Data: 2026-10-18
--
--  1. Le preferenze: una riga per persona in notifiche_preferenze, che
--     nasce solo quando la persona apre la pagina "Promemoria email" e li
--     accende. Senza riga, o con attive = false, non riceve nulla. Ognuno
--     legge e scrive solo la propria; il super admin le vede tutte.
--  2. consuma_quota() accetta anche 'promemoria-prova' (l'email di prova).
--  3. IN FONDO, COMMENTATO: il timer giornaliero. Pages non ha un cron suo,
--     quindi è il database a chiamare /api/promemoria ogni mattina, con
--     pg_cron + pg_net. Va attivato a mano DOPO aver configurato i secret
--     del portale (vedi README, "Promemoria email"), sostituendo il token.
--
--  È idempotente.
-- ============================================================

create table if not exists public.notifiche_preferenze (
  utente_id uuid primary key references auth.users(id) on delete cascade,
  attive boolean not null default false,
  frequenza text not null default 'settimanale' check (frequenza in ('giornaliera', 'settimanale')),
  giorni_anticipo integer not null default 7 check (giorni_anticipo between 1 and 60),
  fatture_passive boolean not null default true,
  crediti_attive boolean not null default true,
  impegni boolean not null default true,
  ultimo_invio date,
  updated_at timestamptz not null default now()
);

alter table public.notifiche_preferenze enable row level security;
drop policy if exists notifiche_proprie_read on public.notifiche_preferenze;
create policy notifiche_proprie_read on public.notifiche_preferenze for select
  using (utente_id = auth.uid() or public.e_super_admin());
drop policy if exists notifiche_proprie_insert on public.notifiche_preferenze;
create policy notifiche_proprie_insert on public.notifiche_preferenze for insert
  with check (utente_id = auth.uid());
drop policy if exists notifiche_proprie_update on public.notifiche_preferenze;
create policy notifiche_proprie_update on public.notifiche_preferenze for update
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());
drop policy if exists notifiche_proprie_delete on public.notifiche_preferenze;
create policy notifiche_proprie_delete on public.notifiche_preferenze for delete
  using (utente_id = auth.uid());

create or replace function public.consuma_quota(p_endpoint text)
returns integer language sql volatile security definer set search_path = public as $$
  insert into public.consumi_api (utente_id, giorno, endpoint, conteggio)
  select auth.uid(), current_date, p_endpoint, 1
   -- solo i servizi con un tetto (functions/_lib/quota.js) e solo per chi
   -- ha un profilo attivo (patch-2026-09-27-sicurezza.sql)
   where p_endpoint in ('estrai-fattura', 'geocode', 'route', 'prezzo-eu', 'promemoria-prova')
     and exists (select 1 from public.profili p
                  where p.id = auth.uid() and p.ruolo in ('super_admin', 'utente'))
  on conflict (utente_id, giorno, endpoint)
    do update set conteggio = public.consumi_api.conteggio + 1
  returning conteggio;
$$;
revoke all on function public.consuma_quota(text) from public, anon;
grant execute on function public.consuma_quota(text) to authenticated;

-- ------------------------------------------------------------
--  3. Timer giornaliero (da attivare a mano, una volta sola)
-- ------------------------------------------------------------
--  Supabase → Database → Extensions: abilitare pg_cron e pg_net. Poi,
--  sostituendo <TOKEN> con lo stesso valore del secret PROMEMORIA_TOKEN
--  del portale, eseguire:
--
--    select cron.schedule(
--      'promemoria-email',
--      '0 5 * * *',      -- ogni giorno alle 05:00 UTC = 6 o 7 a Genova
--      $cron$
--        select net.http_post(
--          url     := 'https://amministrazione.crigenova.it/api/promemoria',
--          headers := jsonb_build_object('Content-Type', 'application/json',
--                                        'X-Promemoria-Token', '<TOKEN>'),
--          body    := '{}'::jsonb
--        );
--      $cron$
--    );
--
--  Per spegnere il timer per tutti: select cron.unschedule('promemoria-email');
--  Esito delle ultime chiamate: select * from net._http_response order by created desc limit 5;
