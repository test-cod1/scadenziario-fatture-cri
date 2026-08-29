-- ============================================================
--  SCADENZIARIO FATTURE — schema Supabase
--  Esegui questo file nell'editor SQL di Supabase (SQL Editor > New query),
--  su un progetto dedicato (regione UE), come per gli altri progetti CRI.
-- ============================================================

-- ---------- PROFILI ----------
create table if not exists public.profili (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  -- 'in_attesa' e' il ruolo di partenza di ogni profilo creato automaticamente:
  -- non legge e non scrive nulla finche' un admin non lo abilita. Serve a evitare
  -- che un'eventuale registrazione pubblica su Supabase dia accesso ai dati.
  ruolo text not null default 'in_attesa' check (ruolo in ('admin','operatore','in_attesa')),
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profili (id, email, nome)
  values (new.id, new.email, split_part(new.email,'@',1))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.puo_scrivere()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo in ('admin','operatore')
  );
$$;

-- Chi puo' LEGGERE i dati: solo utenti con un profilo e un ruolo abilitato.
create or replace function public.puo_leggere()
returns boolean language sql stable security definer set search_path = public as $
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo in ('admin','operatore')
  );
$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profili where id = auth.uid() and ruolo = 'admin');
$$;

-- ---------- FATTURE ----------
create table if not exists public.fatture (
  id uuid primary key default gen_random_uuid(),
  fornitore text not null,
  numero_fattura text,
  data_fattura date,
  importo numeric(12,2) not null default 0,
  scadenza date,
  stato text not null default 'da_pagare' check (stato in ('da_pagare','pagata_parziale','pagata')),
  metodo_pagamento text,          -- bonifico / riba / rid / contanti / altro
  note text,
  estratta_da_ai boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fatture_scadenza on public.fatture(scadenza);
create index if not exists idx_fatture_stato on public.fatture(stato);
create index if not exists idx_fatture_fornitore on public.fatture(fornitore);

-- ---------- PAGAMENTI (acconti / rate) ----------
create table if not exists public.pagamenti (
  id uuid primary key default gen_random_uuid(),
  fattura_id uuid not null references public.fatture(id) on delete cascade,
  importo numeric(12,2) not null,
  data_pagamento date not null,
  metodo text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists idx_pagamenti_fattura on public.pagamenti(fattura_id);

-- Ricalcola automaticamente lo stato della fattura in base ai pagamenti registrati.
-- L'UPDATE viene eseguito SOLO se lo stato cambia davvero: altrimenti farebbe
-- scattare il trigger di audit generando una riga 'modifica' fittizia accanto
-- a ogni 'pagamento_aggiunto'/'pagamento_rimosso'.
create or replace function public.ricalcola_stato_fattura(p_fattura_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_importo numeric(12,2);
  v_pagato  numeric(12,2);
  v_stato   text;
begin
  select importo into v_importo from public.fatture where id = p_fattura_id;
  if v_importo is null then return; end if;
  select coalesce(sum(importo),0) into v_pagato from public.pagamenti where fattura_id = p_fattura_id;
  v_stato := case
    when v_pagato <= 0          then 'da_pagare'
    when v_pagato >= v_importo  then 'pagata'
    else                             'pagata_parziale'
  end;
  update public.fatture
     set stato = v_stato, updated_at = now()
   where id = p_fattura_id
     and stato is distinct from v_stato;
end; $$;

create or replace function public.trg_pagamenti_ricalcola()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.ricalcola_stato_fattura(old.fattura_id);
  else
    perform public.ricalcola_stato_fattura(new.fattura_id);
  end if;
  return null;
end; $$;

drop trigger if exists on_pagamento_change on public.pagamenti;
create trigger on_pagamento_change
  after insert or update or delete on public.pagamenti
  for each row execute procedure public.trg_pagamenti_ricalcola();

-- Se cambia l'importo della fattura, lo stato va ricalcolato confrontandolo
-- con i pagamenti già registrati: senza questo trigger, correggendo l'importo
-- di una fattura già saldata lo stato sarebbe rimasto 'pagata' e la fattura
-- sarebbe sparita da "Da pagare", dagli alert e dai totali pur avendo residuo.
create or replace function public.trg_fatture_stato()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pagato numeric(12,2);
begin
  if new.importo is distinct from old.importo then
    select coalesce(sum(importo),0) into v_pagato
      from public.pagamenti where fattura_id = new.id;
    new.stato := case
      when v_pagato <= 0            then 'da_pagare'
      when v_pagato >= new.importo  then 'pagata'
      else                               'pagata_parziale'
    end;
  end if;
  return new;
end; $$;

drop trigger if exists on_fattura_importo_change on public.fatture;
create trigger on_fattura_importo_change
  before update on public.fatture
  for each row execute procedure public.trg_fatture_stato();

-- updated_at va aggiornata a ogni modifica: il solo default now() la lasciava
-- ferma alla creazione, rendendola inutilizzabile.
create or replace function public.trg_fatture_updated_at()
returns trigger language plpgsql as $
begin
  new.updated_at := now();
  return new;
end; $;

drop trigger if exists on_fatture_updated_at on public.fatture;
create trigger on_fatture_updated_at
  before update on public.fatture
  for each row execute procedure public.trg_fatture_updated_at();

-- ---------- LOG MODIFICHE (audit trail, sola lettura per admin) ----------
create table if not exists public.log_modifiche (
  id uuid primary key default gen_random_uuid(),
  fattura_id uuid,                -- niente FK: la riga deve restare leggibile anche dopo la cancellazione
  fornitore_snapshot text,
  numero_snapshot text,
  azione text not null check (azione in ('creazione','modifica','cancellazione','pagamento_aggiunto','pagamento_rimosso')),
  dettagli jsonb,
  utente_id uuid,
  utente_email text,
  utente_nome text,
  created_at timestamptz default now()
);
create index if not exists idx_log_fattura on public.log_modifiche(fattura_id);
create index if not exists idx_log_created on public.log_modifiche(created_at desc);

create or replace function public.log_utente_info()
returns table(email text, nome text) language sql stable security definer set search_path = public as $$
  select p.email, p.nome from public.profili p where p.id = auth.uid();
$$;

create or replace function public.trg_fatture_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_nome text;
begin
  select email, nome into v_email, v_nome from public.log_utente_info();
  if tg_op = 'INSERT' then
    insert into public.log_modifiche (fattura_id, fornitore_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.id, new.fornitore, new.numero_fattura, 'creazione', jsonb_build_object('nuovo', to_jsonb(new)), auth.uid(), v_email, v_nome);
  elsif tg_op = 'UPDATE' then
    insert into public.log_modifiche (fattura_id, fornitore_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.id, new.fornitore, new.numero_fattura, 'modifica', jsonb_build_object('prima', to_jsonb(old), 'dopo', to_jsonb(new)), auth.uid(), v_email, v_nome);
  elsif tg_op = 'DELETE' then
    insert into public.log_modifiche (fattura_id, fornitore_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (old.id, old.fornitore, old.numero_fattura, 'cancellazione', jsonb_build_object('rimosso', to_jsonb(old)), auth.uid(), v_email, v_nome);
  end if;
  return null;
end; $$;

drop trigger if exists on_fatture_log on public.fatture;
create trigger on_fatture_log
  after insert or update or delete on public.fatture
  for each row execute procedure public.trg_fatture_log();

create or replace function public.trg_pagamenti_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_nome text; v_fornitore text; v_numero text;
begin
  select email, nome into v_email, v_nome from public.log_utente_info();
  if tg_op = 'INSERT' then
    select fornitore, numero_fattura into v_fornitore, v_numero from public.fatture where id = new.fattura_id;
    insert into public.log_modifiche (fattura_id, fornitore_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.fattura_id, v_fornitore, v_numero, 'pagamento_aggiunto', jsonb_build_object('pagamento', to_jsonb(new)), auth.uid(), v_email, v_nome);
  elsif tg_op = 'DELETE' then
    select fornitore, numero_fattura into v_fornitore, v_numero from public.fatture where id = old.fattura_id;
    insert into public.log_modifiche (fattura_id, fornitore_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (old.fattura_id, v_fornitore, v_numero, 'pagamento_rimosso', jsonb_build_object('pagamento', to_jsonb(old)), auth.uid(), v_email, v_nome);
  end if;
  return null;
end; $$;

drop trigger if exists on_pagamenti_log on public.pagamenti;
create trigger on_pagamenti_log
  after insert or delete on public.pagamenti
  for each row execute procedure public.trg_pagamenti_log();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.profili       enable row level security;
alter table public.fatture       enable row level security;
alter table public.pagamenti     enable row level security;
alter table public.log_modifiche enable row level security;

drop policy if exists prof_self on public.profili;
create policy prof_self on public.profili for select using (id = auth.uid());
drop policy if exists prof_admin_read on public.profili;
create policy prof_admin_read on public.profili for select using (public.e_admin());
drop policy if exists prof_update_self on public.profili;
create policy prof_update_self on public.profili for update
  using (id = auth.uid())
  with check (id = auth.uid() and ruolo = (select p.ruolo from public.profili p where p.id = auth.uid()));

drop policy if exists fatture_read on public.fatture;
create policy fatture_read on public.fatture for select using (public.puo_leggere());
drop policy if exists fatture_write on public.fatture;
create policy fatture_write on public.fatture for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

drop policy if exists pagamenti_read on public.pagamenti;
create policy pagamenti_read on public.pagamenti for select using (public.puo_leggere());
drop policy if exists pagamenti_write on public.pagamenti;
create policy pagamenti_write on public.pagamenti for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

-- Il log è sola lettura per gli admin: nessuna policy di insert/update/delete
-- per il ruolo authenticated, quindi solo le funzioni trigger (security
-- definer) possono scriverci, mai un client anche in caso di bug lato app.
drop policy if exists log_admin_read on public.log_modifiche;
create policy log_admin_read on public.log_modifiche for select using (public.e_admin());

-- ============================================================
--  NOTA: dopo aver eseguito lo schema, promuovi il tuo utente ad admin:
--    update public.profili set ruolo='admin' where email='tua@email';
--  e abilita ogni collega (che nasce 'in_attesa') con:
--    update public.profili set ruolo='operatore' where email='collega@cri.it';
--
--  Ricorda inoltre di disattivare le iscrizioni pubbliche:
--    Authentication > Sign In / Providers > Allow new users to sign up = OFF
-- ============================================================
