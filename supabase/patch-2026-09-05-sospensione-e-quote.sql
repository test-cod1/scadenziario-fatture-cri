-- ============================================================
--  PATCH — La sospensione blocca davvero, e un tetto giornaliero
--          sugli endpoint che consumano quota
--  Data: 2026-09-05
--
--  Due correzioni di sicurezza emerse dalla revisione del 05/09/2026.
--
--  1. SOSPENSIONE (era il problema grave)
--     Il pulsante "Sospendi" scrive profili.ruolo = 'in_attesa', ma
--     nessuna policy guardava quella colonna: i permessi veri stanno in
--     `autorizzazioni`, e la sospensione li lascia intatti di proposito
--     (riattivare non deve costringere a riassegnarli uno per uno).
--     Prima del portale funzionava, perché 'in_attesa' era un ruolo DI
--     SEZIONE e le policy lo escludevano; diventato ruolo DI PORTALE con
--     patch-2026-09-01-portale.sql, il blocco è rimasto solo nel
--     browser (js/app.js). Chi era sospeso, con una sessione ancora
--     aperta, continuava a leggere e scrivere chiamando direttamente
--     l'API REST.
--
--     Si corregge in un punto solo: ruolo_sezione(). Tutte le policy di
--     tutte le sezioni passano da lì — accede_a(), e_admin_sezione(),
--     puo_leggere(), puo_scrivere(), e_admin() sono suoi sinonimi — e
--     nessuna va toccata.
--
--     La stessa modifica chiude un secondo problema: un utente
--     ELIMINATO non ha più riga in `profili`, quindi da qui in avanti
--     ruolo_sezione() gli risponde NULL. Prima il suo token restava
--     buono su PostgREST fino alla scadenza (un'ora), perché lì la
--     verifica è solo sulla firma del JWT.
--
--  2. QUOTA GIORNALIERA
--     Gemini e OpenRouteService erano protetti dall'autorizzazione di
--     sezione ma da nessun tetto: un ciclo sbagliato in una pagina
--     poteva esaurire la quota gratuita per tutti. Qui si aggiunge un
--     contatore per utente, per endpoint e per giorno, che il Worker
--     incrementa prima di ogni chiamata a pagamento.
--
--  È idempotente.
-- ============================================================

-- ------------------------------------------------------------
--  1. Il ruolo di portale torna a contare
-- ------------------------------------------------------------
-- Chi non ha un profilo attivo ('super_admin' o 'utente') non ha ruolo in
-- nessuna sezione, quali che siano le autorizzazioni scritte a suo nome.
-- Include tre casi: chi è stato sospeso, chi si è registrato da solo e
-- non è ancora stato abilitato, e chi è stato eliminato (nessuna riga).
create or replace function public.ruolo_sezione(p_sezione text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not exists (
      select 1 from public.profili p
       where p.id = auth.uid() and p.ruolo in ('super_admin', 'utente')
    ) then null
    when exists (
      select 1 from public.profili p
       where p.id = auth.uid() and p.ruolo = 'super_admin'
    ) then 'admin'
    else (select a.ruolo from public.autorizzazioni a
           where a.utente_id = auth.uid() and a.sezione = p_sezione)
  end;
$$;

comment on function public.ruolo_sezione(text) is
  'Ruolo dell''utente corrente nella sezione: admin, operatore o NULL. '
  'NULL anche se il profilo è sospeso (in_attesa) o non esiste più: '
  'è qui che la sospensione toglie l''accesso ai dati, non nel browser.';

-- ------------------------------------------------------------
--  2. Consumi giornalieri degli endpoint a quota
-- ------------------------------------------------------------
create table if not exists public.consumi_api (
  utente_id  uuid not null references auth.users(id) on delete cascade,
  giorno     date not null default current_date,
  endpoint   text not null,
  conteggio  integer not null default 0,
  primary key (utente_id, giorno, endpoint)
);

comment on table public.consumi_api is
  'Chiamate al giorno per utente e endpoint, per non esaurire le quote di Gemini e OpenRouteService';

alter table public.consumi_api enable row level security;

-- Ciascuno vede i propri consumi (utile per capire un 429 senza aprire il
-- database); il super admin vede tutto. Nessuno scrive da fuori: l'unica
-- scrittura passa dalla funzione qui sotto, che è security definer.
drop policy if exists consumi_self on public.consumi_api;
create policy consumi_self on public.consumi_api for select
  using (utente_id = auth.uid() or public.e_super_admin());

-- Incrementa il contatore di oggi e restituisce il valore RAGGIUNTO.
-- Il Worker la chiama col token dell'utente prima di spendere la quota:
-- se il valore di ritorno supera il limite, risponde 429 e non chiama
-- il servizio esterno.
--
-- L'incremento e la lettura stanno nella stessa istruzione, quindi due
-- richieste in parallelo non possono leggere lo stesso numero: senza
-- questo, il tetto si aggirava aprendo due schede.
create or replace function public.consuma_quota(p_endpoint text)
returns integer language sql volatile security definer set search_path = public as $$
  insert into public.consumi_api (utente_id, giorno, endpoint, conteggio)
  values (auth.uid(), current_date, p_endpoint, 1)
  on conflict (utente_id, giorno, endpoint)
    do update set conteggio = public.consumi_api.conteggio + 1
  returning conteggio;
$$;

revoke all on function public.consuma_quota(text) from public;
grant execute on function public.consuma_quota(text) to authenticated;

-- Le righe vecchie non servono a nulla: si tengono due mesi, per poter
-- guardare indietro se qualcuno segnala di essere stato bloccato.
create or replace function public.pulisci_consumi_api()
returns void language sql volatile security definer set search_path = public as $$
  delete from public.consumi_api where giorno < current_date - 60;
$$;

-- ---------- VERIFICA ----------
-- Con la sessione di un utente sospeso, entrambe devono dare NULL / false:
--   select public.ruolo_sezione('scadenziario');
--   select public.accede_a('scadenziario');
-- E una lettura su una tabella della sezione deve restituire zero righe.
select p.email, p.ruolo,
       public.ruolo_sezione('scadenziario') as ruolo_scadenziario_del_chiamante
  from public.profili p
 order by p.ruolo, p.email;
