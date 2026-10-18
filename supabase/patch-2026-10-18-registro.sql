-- ============================================================
--  PATCH — Registro modifiche unico, per tutto il portale
--  Data: 2026-10-18
--
--  Fin qui il registro c'era solo per lo scadenziario (log_modifiche e
--  log_modifiche_attive): chi cambiava un preventivo, un impegno del
--  Direttore, un centro di costo, una riga di straordinari o i permessi di
--  un utente non lasciava traccia. Qui un'unica tabella, `registro`, e un
--  unico trigger generico attaccato a tutte le tabelle con dati di lavoro:
--  per ogni inserimento, modifica o cancellazione si conservano la riga
--  prima e dopo, i campi cambiati e chi l'ha fatto.
--
--  - Lo legge solo il super admin (pagina "Registro modifiche" del
--    portale). Nessuno lo scrive a mano: lo scrive il trigger, che gira
--    come proprietario. Nessuno lo modifica né lo cancella via API.
--  - Un UPDATE che cambia solo updated_at (i ricalcoli automatici) non
--    lascia righe: sarebbe rumore.
--  - I due registri dello scadenziario restano dove sono, con le loro
--    pagine: questo li affianca, non li sostituisce.
--  - Si tiene tre anni: pulisci_registro() toglie il resto, e la chiama il
--    trigger stesso quando trova righe scadute.
--
--  È idempotente.
-- ============================================================

create table if not exists public.registro (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  tabella text not null,
  riga_id text,
  azione text not null check (azione in ('inserimento','modifica','cancellazione')),
  campi text[],          -- per le modifiche: i campi cambiati
  prima jsonb,
  dopo jsonb,
  utente_id uuid,
  utente_email text,
  utente_nome text
);
create index if not exists idx_registro_created on public.registro(created_at desc);
create index if not exists idx_registro_riga on public.registro(tabella, riga_id);
create index if not exists idx_registro_utente on public.registro(utente_id);

alter table public.registro enable row level security;
drop policy if exists registro_sa_read on public.registro;
create policy registro_sa_read on public.registro for select using (public.e_super_admin());

create or replace function public.pulisci_registro()
returns void language sql security definer set search_path = public as $$
  delete from public.registro where created_at < now() - interval '3 years';
$$;

create or replace function public.trg_registro()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_prima jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_dopo  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_riga  jsonb := coalesce(v_dopo, v_prima);
  v_campi text[];
  v_email text; v_nome text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_campi
      from jsonb_object_keys(v_dopo) k
     where k <> 'updated_at' and (v_prima -> k) is distinct from (v_dopo -> k);
    if v_campi is null then return null; end if;
  end if;

  select email, nome into v_email, v_nome from public.log_utente_info();

  insert into public.registro (tabella, riga_id, azione, campi, prima, dopo, utente_id, utente_email, utente_nome)
  values (
    tg_table_name,
    coalesce(v_riga ->> 'id', concat_ws(':', v_riga ->> 'utente_id', v_riga ->> 'sezione')),
    case tg_op when 'INSERT' then 'inserimento' when 'UPDATE' then 'modifica' else 'cancellazione' end,
    v_campi, v_prima, v_dopo, auth.uid(), v_email, v_nome
  );

  -- Pulizia: solo quando c'è davvero qualcosa di scaduto (con l'indice su
  -- created_at il controllo costa una lettura).
  if exists (select 1 from public.registro where created_at < now() - interval '3 years') then
    perform public.pulisci_registro();
  end if;
  return null;
end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profili','autorizzazioni',
    'fatture','pagamenti','note_credito','note_credito_righe','impostazioni','proposte_pagamento',
    'fatture_attive','incassi','note_credito_attive','note_credito_attive_righe',
    'preventivi','impostazioni_trasferte',
    'preventivi_assistenze','clienti_assistenze','impostazioni_assistenze',
    'preventivi_formazione','clienti_formazione','impostazioni_formazione',
    'dipendenti_straordinari','straordinari','impostazioni_straordinari',
    'impegni_direttore','centri_costo','imputazioni'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists on_%1$s_registro on public.%1$I', t);
      execute format('create trigger on_%1$s_registro after insert or update or delete on public.%1$I
                      for each row execute procedure public.trg_registro()', t);
    end if;
  end loop;
end $$;

revoke all on function public.trg_registro() from public, anon, authenticated;
revoke all on function public.pulisci_registro() from public, anon, authenticated;
