-- ============================================================
--  PATCH — Accesso in sola visualizzazione a una sezione
--  Data: 2026-11-27
--
--  Accanto a «Operatore» e «Admin» nasce il ruolo di sezione «lettore»:
--  entra nella sezione e vede tutto quello che vede un operatore, ma non
--  inserisce, non modifica e non cancella nulla.
--
--  Come funziona:
--  - autorizzazioni.ruolo accetta 'lettore';
--  - ruolo_sezione() non cambia: per il lettore risponde 'lettore', quindi
--    accede_a() resta vera e tutte le policy di LETTURA lo lasciano passare
--    senza essere toccate;
--  - nasce puo_modificare(sezione): vera per operatore e admin, falsa per il
--    lettore. puo_scrivere() (lo scadenziario) passa da lì;
--  - ogni tabella di sezione riceve tre policy RESTRICTIVE (insert, update,
--    delete) che negano la scrittura al lettore. Una policy restrictive si
--    somma IN AND a quelle esistenti, quindi non serve riscrivere le decine
--    di policy di scrittura già in uso: basta questa rete sopra a tutte.
--    Valgono solo per «authenticated»: i moduli pubblici (anon) e il Worker
--    (service_role) non ne sono toccati;
--  - il lettore dello scadenziario vede tutte le proposte di pagamento
--    (all'operatore la policy mostra solo le sue);
--  - genera_codice_telegram() chiede puo_modificare('direttore'): dal bot
--    Telegram si scrivono idee, e il lettore non deve poterlo fare.
--
--  Da eseguire PRIMA di assegnare il primo «lettore» dall'app: senza, il
--  vincolo su autorizzazioni.ruolo rifiuta il valore nuovo.
--  È idempotente.
-- ============================================================

-- ---------- 1. Il ruolo nuovo ----------
alter table public.autorizzazioni drop constraint if exists autorizzazioni_ruolo_check;
alter table public.autorizzazioni add constraint autorizzazioni_ruolo_check
  check (ruolo in ('lettore', 'operatore', 'admin'));

-- ---------- 2. Chi può modificare ----------
create or replace function public.puo_modificare(p_sezione text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.ruolo_sezione(p_sezione) in ('operatore', 'admin'), false);
$$;

-- Lo scadenziario: le policy di scrittura delle fatture passano da qui.
create or replace function public.puo_scrivere()
returns boolean language sql stable security definer set search_path = public as $$
  select public.puo_modificare('scadenziario');
$$;

-- Vera per tutti tranne il lettore della sezione (anche per chi non vi ha
-- accesso: a quello pensano già le policy permissive).
create or replace function public.non_lettore(p_sezione text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ruolo_sezione(p_sezione) is distinct from 'lettore';
$$;

-- ---------- 3. Rete restrictive su tutte le tabelle di sezione ----------
do $$
declare
  r record;
  v_cond text;
begin
  for r in
    select * from (values
      ('fatture', 'scadenziario'), ('pagamenti', 'scadenziario'),
      ('ritenute_versamenti', 'scadenziario'), ('note_credito', 'scadenziario'),
      ('note_credito_righe', 'scadenziario'), ('proposte_pagamento', 'scadenziario'),
      ('impostazioni', 'scadenziario'), ('fatture_attive', 'scadenziario'),
      ('incassi', 'scadenziario'), ('note_credito_attive', 'scadenziario'),
      ('note_credito_attive_righe', 'scadenziario'),
      ('preventivi', 'trasporti'), ('impostazioni_trasferte', 'trasporti'),
      ('preventivi_assistenze', 'assistenze'), ('impostazioni_assistenze', 'assistenze'),
      ('clienti_assistenze', 'assistenze'),
      ('preventivi_formazione', 'formazione'), ('clienti_formazione', 'formazione'),
      ('impostazioni_formazione', 'formazione'), ('corsi_formazione', 'formazione'),
      ('dati_fatturazione', null),
      ('dipendenti_straordinari', 'straordinari'), ('straordinari', 'straordinari'),
      ('impostazioni_straordinari', 'straordinari'),
      ('impegni_direttore', 'direttore'), ('idee_direttore', 'direttore'),
      ('centri_costo', 'analisi'), ('movimenti_analisi', 'analisi'),
      ('scadenze', 'scadenze'),
      ('richieste_patenti', 'patenti')
    ) as t(tabella, sezione)
  loop
    if to_regclass('public.' || r.tabella) is null then continue; end if;
    -- dati_fatturazione è condivisa: la sezione sta nella colonna della riga.
    v_cond := case when r.sezione is null then 'public.non_lettore(sezione)'
                   else format('public.non_lettore(%L)', r.sezione) end;
    execute format('drop policy if exists sola_lettura_ins on public.%I', r.tabella);
    execute format('drop policy if exists sola_lettura_upd on public.%I', r.tabella);
    execute format('drop policy if exists sola_lettura_del on public.%I', r.tabella);
    execute format('create policy sola_lettura_ins on public.%I as restrictive for insert to authenticated with check (%s)', r.tabella, v_cond);
    execute format('create policy sola_lettura_upd on public.%I as restrictive for update to authenticated using (%s) with check (%s)', r.tabella, v_cond, v_cond);
    execute format('create policy sola_lettura_del on public.%I as restrictive for delete to authenticated using (%s)', r.tabella, v_cond);
  end loop;
end $$;

-- ---------- 3b. Proposte di pagamento: il lettore le vede tutte ----------
-- All'operatore la policy mostra solo le proprie; il lettore non ne invia,
-- quindi con quella regola non ne vedrebbe nessuna. Le vede tutte, come
-- l'admin, ma non le conferma né le ritira (policy restrictive qui sopra).
drop policy if exists proposte_read on public.proposte_pagamento;
create policy proposte_read on public.proposte_pagamento for select
  using (public.e_admin()
         or public.ruolo_sezione('scadenziario') = 'lettore'
         or (proposta_da = auth.uid() and public.puo_leggere()));

-- ---------- 4. Codice Telegram: solo a chi può scrivere nel Direttore ----------
create or replace function public.genera_codice_telegram()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_byte bytea := substr(uuid_send(gen_random_uuid()), 1, 6) || substr(uuid_send(gen_random_uuid()), 10, 4);
  v_codice text := '';
  i integer;
begin
  if not public.puo_modificare('direttore') then
    raise exception 'Non autorizzato: serve l''accesso in modifica alla sezione Direttore.';
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

-- ---------- Verifica ----------
-- Le policy create (una terna per tabella):
--   select tablename, policyname, permissive from pg_policies
--    where policyname like 'sola_lettura_%' order by tablename, policyname;
-- Chi ha accessi in sola visualizzazione:
--   select p.email, a.sezione from public.autorizzazioni a
--     join public.profili p on p.id = a.utente_id where a.ruolo = 'lettore';
