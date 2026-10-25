-- ============================================================
--  PATCH — Quattro correzioni di sicurezza trovate nella revisione del
--  27/09/2026
--  Data: 2026-09-27
--
--  1. REGISTRO MODIFICHE NON FALSIFICABILE. La policy prof_update_self
--     bloccava sulla propria riga di profili solo ruolo e
--     deve_cambiare_password: email e nome restavano scrivibili. Con una
--     PATCH a /rest/v1/profili un operatore poteva darsi nome ed email di
--     un altro, e da quel momento ogni sua modifica a fatture, pagamenti e
--     incassi finiva nel registro a nome altrui (i trigger li leggevano da
--     profili). Ora:
--       - nessuno cambia da sé email e nome (li gestisce il super admin,
--         policy prof_admin_update, e l'app non ha mai scritto altro sulla
--         propria riga);
--       - l'email del registro viene dal token di accesso, non dal profilo.
--
--  2. PASSWORD PROVVISORIA OBBLIGATORIA ANCHE FUORI DAL BROWSER. L'obbligo
--     di cambiarla al primo accesso lo faceva rispettare solo l'app: con la
--     password provvisoria (che conosce anche l'admin che l'ha generata)
--     l'API REST dava accesso a tutto. Ora ruolo_sezione() — da cui passano
--     tutte le policy del portale — non riconosce ruoli finché il flag è
--     acceso. Il flag si spegne da solo quando la password cambia davvero
--     (trigger handle_password_changed).
--
--  3. CONSUMA_QUOTA SOLO PER I SERVIZI VERI. Accettava qualunque testo come
--     nome del servizio e qualunque utente autenticato, anche sospeso o in
--     attesa: in un ciclo poteva riempire consumi_api di righe inventate.
--     Ora conta solo i quattro servizi con un tetto (functions/_lib/quota.js)
--     e solo per chi ha un profilo attivo; altrimenti restituisce NULL, che
--     il Worker tratta come "nessun limite noto" come già faceva per gli
--     errori.
--
--  4. FUNZIONI INTERNE NON PIÙ CHIAMABILI DALL'ESTERNO. pulisci_consumi_api
--     e ricalcola_stato_fattura(_attiva) sono security definer e, per i
--     privilegi di default di Supabase, si potevano chiamare via RPC da
--     chiunque (anche senza login). Le usano solo i trigger, che girano già
--     come proprietario: il permesso agli altri si toglie.
--
--  È idempotente.
-- ============================================================

-- 2. ------------------------------------------------------------
create or replace function public.ruolo_sezione(p_sezione text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when not exists (
      select 1 from public.profili p
       where p.id = auth.uid() and p.ruolo in ('super_admin', 'utente')
         and not p.deve_cambiare_password
    ) then null
    when exists (
      select 1 from public.profili p
       where p.id = auth.uid() and p.ruolo = 'super_admin'
    ) then 'admin'
    else (select a.ruolo from public.autorizzazioni a
           where a.utente_id = auth.uid() and a.sezione = p_sezione)
  end;
$$;

-- 1. ------------------------------------------------------------
create or replace function public.log_utente_info()
returns table(email text, nome text) language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'email', p.email), p.nome
    from public.profili p where p.id = auth.uid();
$$;

drop policy if exists prof_update_self on public.profili;
create policy prof_update_self on public.profili for update
  using (id = auth.uid())
  with check (id = auth.uid() and (ruolo, deve_cambiare_password, email, nome) = (
    select p.ruolo, p.deve_cambiare_password, p.email, p.nome from public.profili p where p.id = auth.uid()));

-- 3. ------------------------------------------------------------
create or replace function public.consuma_quota(p_endpoint text)
returns integer language sql volatile security definer set search_path = public as $$
  insert into public.consumi_api (utente_id, giorno, endpoint, conteggio)
  select auth.uid(), current_date, p_endpoint, 1
   where p_endpoint in ('estrai-fattura', 'geocode', 'route', 'prezzo-eu')
     and exists (select 1 from public.profili p
                  where p.id = auth.uid() and p.ruolo in ('super_admin', 'utente'))
  on conflict (utente_id, giorno, endpoint)
    do update set conteggio = public.consumi_api.conteggio + 1
  returning conteggio;
$$;
revoke all on function public.consuma_quota(text) from public, anon;
grant execute on function public.consuma_quota(text) to authenticated;

-- 4. ------------------------------------------------------------
revoke all on function public.pulisci_consumi_api() from public, anon, authenticated;
revoke all on function public.ricalcola_stato_fattura(uuid) from public, anon, authenticated;
revoke all on function public.ricalcola_stato_fattura_attiva(uuid) from public, anon, authenticated;
