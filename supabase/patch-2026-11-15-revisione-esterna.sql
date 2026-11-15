-- ============================================================
--  PATCH — REVISIONE ESTERNA DEL 15/11/2026
--  Da eseguire nel SQL Editor PRIMA di pubblicare il codice.
--  È idempotente: si può rieseguire senza danni.
--
--  1. Limite di tentativi per chi non ha fatto il login (accesso con nome
--     e cognome, link dei centri di costo): tabella limiti_anonimi e
--     funzione consuma_limite_anonimo, chiamabile solo dalla service role
--     (functions/_lib/limiti.js). Senza questa parte i limiti non contano
--     (il codice lascia passare e lo scrive nei log), ma niente si rompe.
--  2. Codice per collegare Telegram: 10 caratteri da un alfabeto di 32
--     (50 bit) invece di 8 cifre esadecimali (32 bit).
--  3. Aggiornamenti di Telegram già ricevuti: lo stesso messaggio rimandato
--     da Telegram non salva l'idea due volte.
--  4. Le due funzioni dei trigger su auth.users, che girano coi permessi
--     del proprietario, fissano lo schema in cui cercare le tabelle
--     (search_path), come già tutte le altre.
--  5. Scadenza facoltativa dei link dei centri di costo (link_scade_il).
-- ============================================================

-- ---------- 1. Limiti per gli anonimi ----------
create table if not exists public.limiti_anonimi (
  chiave    text not null,
  finestra  timestamptz not null,
  conteggio integer not null default 0,
  primary key (chiave, finestra)
);
comment on table public.limiti_anonimi is
  'Tentativi per impronta di indirizzo (o per nome) sugli endpoint pubblici: accesso per nome, link dei centri';
-- Nessuna policy: con la RLS attiva e nessuna regola, via API non la legge
-- né la scrive nessuno. L'unica scrittura passa dalla funzione qui sotto.
alter table public.limiti_anonimi enable row level security;

-- Incrementa il contatore della finestra in corso (di p_finestra_secondi
-- secondi) e restituisce il valore raggiunto, in un'unica istruzione: due
-- richieste in parallelo non leggono lo stesso numero. Le righe di più di
-- due giorni si cancellano qui, così la tabella resta piccola da sola.
create or replace function public.consuma_limite_anonimo(p_chiave text, p_finestra_secondi integer)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_finestra timestamptz;
  v_conteggio integer;
begin
  if p_chiave is null or length(p_chiave) > 200 or p_finestra_secondi is null
     or p_finestra_secondi < 1 or p_finestra_secondi > 86400 then
    raise exception 'Parametri non validi';
  end if;
  v_finestra := to_timestamp(floor(extract(epoch from now()) / p_finestra_secondi) * p_finestra_secondi);
  insert into public.limiti_anonimi (chiave, finestra, conteggio)
  values (p_chiave, v_finestra, 1)
  on conflict (chiave, finestra) do update set conteggio = public.limiti_anonimi.conteggio + 1
  returning conteggio into v_conteggio;
  if random() < 0.02 then
    delete from public.limiti_anonimi where finestra < now() - interval '2 days';
  end if;
  return v_conteggio;
end; $$;
revoke all on function public.consuma_limite_anonimo(text, integer) from public, anon, authenticated;
grant execute on function public.consuma_limite_anonimo(text, integer) to service_role;

-- ---------- 2. Codice Telegram più lungo ----------
-- 10 caratteri dall'alfabeto senza 0/O e 1/I (32 simboli: 256 è multiplo
-- di 32, quindi nessun simbolo esce più spesso degli altri). I byte casuali
-- vengono da gen_random_uuid(), scartando quelli fissi di versione e variante.
create or replace function public.genera_codice_telegram()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_byte bytea := substr(uuid_send(gen_random_uuid()), 1, 6) || substr(uuid_send(gen_random_uuid()), 10, 4);
  v_codice text := '';
  i integer;
begin
  if not public.accede_a('direttore') then
    raise exception 'Non autorizzato: serve l''accesso alla sezione Direttore.';
  end if;
  for i in 0..9 loop
    v_codice := v_codice || substr(v_alfabeto, (get_byte(v_byte, i) % 32) + 1, 1);
  end loop;
  insert into public.telegram_collegamenti (utente_id, codice, codice_scade)
  values (auth.uid(), v_codice, now() + interval '15 minutes')
  on conflict (utente_id) do update set codice = excluded.codice, codice_scade = excluded.codice_scade;
  return v_codice;
end; $$;
revoke all on function public.genera_codice_telegram() from public, anon;
grant execute on function public.genera_codice_telegram() to authenticated;

-- ---------- 3. Aggiornamenti Telegram già ricevuti ----------
create table if not exists public.telegram_aggiornamenti (
  update_id   bigint primary key,
  ricevuto_il timestamptz not null default now()
);
alter table public.telegram_aggiornamenti enable row level security;
-- Si tengono una settimana: Telegram rimanda un aggiornamento per al
-- massimo qualche ora.
create or replace function public.pulisci_telegram_aggiornamenti()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.05 then
    delete from public.telegram_aggiornamenti where ricevuto_il < now() - interval '7 days';
  end if;
  return new;
end; $$;
revoke all on function public.pulisci_telegram_aggiornamenti() from public, anon, authenticated;
drop trigger if exists telegram_aggiornamenti_pulizia on public.telegram_aggiornamenti;
create trigger telegram_aggiornamenti_pulizia after insert on public.telegram_aggiornamenti
  for each row execute function public.pulisci_telegram_aggiornamenti();

-- ---------- 4. search_path delle funzioni dei trigger su auth.users ----------
alter function public.handle_new_user() set search_path = public;
alter function public.handle_password_changed() set search_path = public;

-- ---------- 5. Scadenza dei link dei centri di costo ----------
-- null = nessuna scadenza (i link creati prima restano così finché non si
-- cambiano). Dal giorno dopo la data il link non apre più il conto.
alter table public.centri_costo add column if not exists link_scade_il date;

-- ---------- VERIFICA ----------
select 'limiti_anonimi' as cosa, to_regclass('public.limiti_anonimi') is not null as ok
union all select 'telegram_aggiornamenti', to_regclass('public.telegram_aggiornamenti') is not null
union all select 'link_scade_il', exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'centri_costo' and column_name = 'link_scade_il')
union all select 'search_path handle_new_user', exists (select 1 from pg_proc
  where proname = 'handle_new_user' and proconfig::text like '%search_path%');
