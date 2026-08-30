-- ============================================================
--  PATCH 2026-08-30 — Fatture ATTIVE (emesse ai clienti)
-- ------------------------------------------------------------
--  Sezione completamente indipendente dalle fatture fornitori (passive):
--  tabelle, trigger e RLS separati. Nessuna modifica alle tabelle esistenti.
--  Come "fornitore" nelle fatture passive è un campo testo libero (non una
--  tabella anagrafica), qui "cliente" è lo stesso: un campo testo su
--  fatture_attive, per coerenza con il resto del progetto.
--  Su un database creato dopo il 30/08/2026 questo patch non serve:
--  schema.sql lo include già.
-- ============================================================

-- ---------- FATTURE ATTIVE ----------
create table if not exists public.fatture_attive (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  numero_fattura text,
  data_fattura date,
  importo numeric(12,2) not null default 0,
  scadenza date,
  -- 'stornata' = chiusa da una nota di credito emessa (in tutto o compensando
  -- il residuo), non da un incasso vero: vedi note_credito_attive più sotto.
  stato text not null default 'da_incassare' check (stato in ('da_incassare','incassata_parziale','incassata','stornata')),
  metodo_incasso text,          -- bonifico / riba / rid / contanti / altro
  note text,
  -- Data dell'ultimo sollecito di pagamento inviato al cliente: campo
  -- puramente informativo, aggiornato a mano da chi invia il sollecito.
  data_sollecito date,
  estratta_da_ai boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fatture_attive_scadenza on public.fatture_attive(scadenza);
create index if not exists idx_fatture_attive_stato on public.fatture_attive(stato);
create index if not exists idx_fatture_attive_cliente on public.fatture_attive(cliente);

-- ---------- INCASSI (acconti / rate ricevute dal cliente) ----------
create table if not exists public.incassi (
  id uuid primary key default gen_random_uuid(),
  fattura_attiva_id uuid not null references public.fatture_attive(id) on delete cascade,
  importo numeric(12,2) not null,
  data_incasso date not null,
  metodo text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists idx_incassi_fattura on public.incassi(fattura_attiva_id);

-- ---------- NOTE DI CREDITO EMESSE ----------
-- Come per le passive: una nota di credito (testata) può stornare più
-- fatture attive insieme, ciascuna per una quota diversa.
create table if not exists public.note_credito_attive (
  id uuid primary key default gen_random_uuid(),
  numero text,
  data date not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.note_credito_attive_righe (
  id uuid primary key default gen_random_uuid(),
  nota_credito_attiva_id uuid not null references public.note_credito_attive(id) on delete cascade,
  fattura_attiva_id uuid not null references public.fatture_attive(id) on delete cascade,
  importo numeric(12,2) not null check (importo > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_ncar_nota on public.note_credito_attive_righe(nota_credito_attiva_id);
create index if not exists idx_ncar_fattura on public.note_credito_attive_righe(fattura_attiva_id);

-- Ricalcola lo stato della fattura attiva in base a incassi E note di
-- credito collegate. L'UPDATE avviene solo se lo stato cambia davvero,
-- altrimenti scatterebbe il trigger di audit generando una riga 'modifica'
-- fittizia accanto a ogni 'incasso_aggiunto'/'incasso_rimosso'.
create or replace function public.ricalcola_stato_fattura_attiva(p_fattura_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_importo  numeric(12,2);
  v_incassato numeric(12,2);
  v_stornato numeric(12,2);
  v_stato    text;
begin
  select importo into v_importo from public.fatture_attive where id = p_fattura_id;
  if v_importo is null then return; end if;
  select coalesce(sum(importo),0) into v_incassato from public.incassi                    where fattura_attiva_id = p_fattura_id;
  select coalesce(sum(importo),0) into v_stornato  from public.note_credito_attive_righe  where fattura_attiva_id = p_fattura_id;
  v_stato := case
    when (v_incassato + v_stornato) <= 0          then 'da_incassare'
    when (v_incassato + v_stornato) <  v_importo  then 'incassata_parziale'
    when v_stornato > 0                           then 'stornata'
    else                                                'incassata'
  end;
  update public.fatture_attive
     set stato = v_stato, updated_at = now()
   where id = p_fattura_id
     and stato is distinct from v_stato;
end; $$;

create or replace function public.trg_incassi_ricalcola()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.ricalcola_stato_fattura_attiva(old.fattura_attiva_id);
  else
    perform public.ricalcola_stato_fattura_attiva(new.fattura_attiva_id);
  end if;
  return null;
end; $$;

drop trigger if exists on_incasso_change on public.incassi;
create trigger on_incasso_change
  after insert or update or delete on public.incassi
  for each row execute procedure public.trg_incassi_ricalcola();

create or replace function public.trg_note_credito_attive_righe_ricalcola()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.ricalcola_stato_fattura_attiva(old.fattura_attiva_id);
  elsif tg_op = 'UPDATE' then
    perform public.ricalcola_stato_fattura_attiva(new.fattura_attiva_id);
    if new.fattura_attiva_id is distinct from old.fattura_attiva_id then
      perform public.ricalcola_stato_fattura_attiva(old.fattura_attiva_id);
    end if;
  else
    perform public.ricalcola_stato_fattura_attiva(new.fattura_attiva_id);
  end if;
  return null;
end; $$;

drop trigger if exists on_nota_credito_attiva_riga_change on public.note_credito_attive_righe;
create trigger on_nota_credito_attiva_riga_change
  after insert or update or delete on public.note_credito_attive_righe
  for each row execute procedure public.trg_note_credito_attive_righe_ricalcola();

-- Se cambia l'importo della fattura, lo stato va ricalcolato confrontandolo
-- con incassi e note di credito già registrati (stessa ragione delle passive:
-- senza questo, correggendo l'importo di una fattura già incassata lo stato
-- resterebbe 'incassata' pur avendo un residuo).
create or replace function public.trg_fatture_attive_stato()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_incassato numeric(12,2); v_stornato numeric(12,2);
begin
  if new.importo is distinct from old.importo then
    select coalesce(sum(importo),0) into v_incassato
      from public.incassi where fattura_attiva_id = new.id;
    select coalesce(sum(importo),0) into v_stornato
      from public.note_credito_attive_righe where fattura_attiva_id = new.id;
    new.stato := case
      when (v_incassato + v_stornato) <= 0           then 'da_incassare'
      when (v_incassato + v_stornato) <  new.importo then 'incassata_parziale'
      when v_stornato > 0                            then 'stornata'
      else                                                 'incassata'
    end;
  end if;
  return new;
end; $$;

drop trigger if exists on_fattura_attiva_importo_change on public.fatture_attive;
create trigger on_fattura_attiva_importo_change
  before update on public.fatture_attive
  for each row execute procedure public.trg_fatture_attive_stato();

drop trigger if exists on_fatture_attive_updated_at on public.fatture_attive;
create trigger on_fatture_attive_updated_at
  before update on public.fatture_attive
  for each row execute procedure public.trg_fatture_updated_at();  -- funzione generica già definita per le fatture passive

-- ---------- LOG MODIFICHE FATTURE ATTIVE (audit trail, sola lettura per admin) ----------
create table if not exists public.log_modifiche_attive (
  id uuid primary key default gen_random_uuid(),
  fattura_attiva_id uuid,          -- niente FK: la riga deve restare leggibile anche dopo la cancellazione
  cliente_snapshot text,
  numero_snapshot text,
  azione text not null check (azione in ('creazione','modifica','cancellazione','incasso_aggiunto','incasso_rimosso','nota_credito_aggiunta','nota_credito_rimossa')),
  dettagli jsonb,
  utente_id uuid,
  utente_email text,
  utente_nome text,
  created_at timestamptz default now()
);
create index if not exists idx_log_attive_fattura on public.log_modifiche_attive(fattura_attiva_id);
create index if not exists idx_log_attive_created on public.log_modifiche_attive(created_at desc);

create or replace function public.trg_fatture_attive_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_nome text;
begin
  select email, nome into v_email, v_nome from public.log_utente_info();  -- funzione generica già definita per le passive
  if tg_op = 'INSERT' then
    insert into public.log_modifiche_attive (fattura_attiva_id, cliente_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.id, new.cliente, new.numero_fattura, 'creazione', jsonb_build_object('nuovo', to_jsonb(new)), auth.uid(), v_email, v_nome);
  elsif tg_op = 'UPDATE' then
    insert into public.log_modifiche_attive (fattura_attiva_id, cliente_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.id, new.cliente, new.numero_fattura, 'modifica', jsonb_build_object('prima', to_jsonb(old), 'dopo', to_jsonb(new)), auth.uid(), v_email, v_nome);
  elsif tg_op = 'DELETE' then
    insert into public.log_modifiche_attive (fattura_attiva_id, cliente_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (old.id, old.cliente, old.numero_fattura, 'cancellazione', jsonb_build_object('rimosso', to_jsonb(old)), auth.uid(), v_email, v_nome);
  end if;
  return null;
end; $$;

drop trigger if exists on_fatture_attive_log on public.fatture_attive;
create trigger on_fatture_attive_log
  after insert or update or delete on public.fatture_attive
  for each row execute procedure public.trg_fatture_attive_log();

create or replace function public.trg_incassi_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_nome text; v_cliente text; v_numero text;
begin
  select email, nome into v_email, v_nome from public.log_utente_info();
  if tg_op = 'INSERT' then
    select cliente, numero_fattura into v_cliente, v_numero from public.fatture_attive where id = new.fattura_attiva_id;
    insert into public.log_modifiche_attive (fattura_attiva_id, cliente_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.fattura_attiva_id, v_cliente, v_numero, 'incasso_aggiunto', jsonb_build_object('incasso', to_jsonb(new)), auth.uid(), v_email, v_nome);
  elsif tg_op = 'DELETE' then
    select cliente, numero_fattura into v_cliente, v_numero from public.fatture_attive where id = old.fattura_attiva_id;
    insert into public.log_modifiche_attive (fattura_attiva_id, cliente_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (old.fattura_attiva_id, v_cliente, v_numero, 'incasso_rimosso', jsonb_build_object('incasso', to_jsonb(old)), auth.uid(), v_email, v_nome);
  end if;
  return null;
end; $$;

drop trigger if exists on_incassi_log on public.incassi;
create trigger on_incassi_log
  after insert or delete on public.incassi
  for each row execute procedure public.trg_incassi_log();

create or replace function public.trg_note_credito_attive_righe_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_nome text; v_cliente text; v_numero text; v_nc_numero text; v_nc_data date;
begin
  select email, nome into v_email, v_nome from public.log_utente_info();
  if tg_op = 'INSERT' then
    select cliente, numero_fattura into v_cliente, v_numero from public.fatture_attive where id = new.fattura_attiva_id;
    select numero, data into v_nc_numero, v_nc_data from public.note_credito_attive where id = new.nota_credito_attiva_id;
    insert into public.log_modifiche_attive (fattura_attiva_id, cliente_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.fattura_attiva_id, v_cliente, v_numero, 'nota_credito_aggiunta',
      jsonb_build_object('importo', new.importo, 'nota_credito_numero', v_nc_numero, 'nota_credito_data', v_nc_data),
      auth.uid(), v_email, v_nome);
  elsif tg_op = 'DELETE' then
    select cliente, numero_fattura into v_cliente, v_numero from public.fatture_attive where id = old.fattura_attiva_id;
    select numero, data into v_nc_numero, v_nc_data from public.note_credito_attive where id = old.nota_credito_attiva_id;
    insert into public.log_modifiche_attive (fattura_attiva_id, cliente_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (old.fattura_attiva_id, v_cliente, v_numero, 'nota_credito_rimossa',
      jsonb_build_object('importo', old.importo, 'nota_credito_numero', v_nc_numero, 'nota_credito_data', v_nc_data),
      auth.uid(), v_email, v_nome);
  end if;
  return null;
end; $$;

drop trigger if exists on_note_credito_attive_righe_log on public.note_credito_attive_righe;
create trigger on_note_credito_attive_righe_log
  after insert or delete on public.note_credito_attive_righe
  for each row execute procedure public.trg_note_credito_attive_righe_log();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.fatture_attive           enable row level security;
alter table public.incassi                  enable row level security;
alter table public.note_credito_attive      enable row level security;
alter table public.note_credito_attive_righe enable row level security;
alter table public.log_modifiche_attive     enable row level security;

drop policy if exists fatture_attive_read on public.fatture_attive;
create policy fatture_attive_read on public.fatture_attive for select using (public.puo_leggere());
drop policy if exists fatture_attive_write on public.fatture_attive;
create policy fatture_attive_write on public.fatture_attive for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

-- A differenza dei pagamenti delle fatture passive (dove scrive solo
-- l'admin, tramite un flusso di proposte separato), qui non è previsto un
-- sistema di proposte: anche l'operatore registra direttamente gli incassi,
-- come già fa con le note di credito.
drop policy if exists incassi_read on public.incassi;
create policy incassi_read on public.incassi for select using (public.puo_leggere());
drop policy if exists incassi_write on public.incassi;
create policy incassi_write on public.incassi for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

drop policy if exists note_credito_attive_read on public.note_credito_attive;
create policy note_credito_attive_read on public.note_credito_attive for select using (public.puo_leggere());
drop policy if exists note_credito_attive_write on public.note_credito_attive;
create policy note_credito_attive_write on public.note_credito_attive for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

drop policy if exists note_credito_attive_righe_read on public.note_credito_attive_righe;
create policy note_credito_attive_righe_read on public.note_credito_attive_righe for select using (public.puo_leggere());
drop policy if exists note_credito_attive_righe_write on public.note_credito_attive_righe;
create policy note_credito_attive_righe_write on public.note_credito_attive_righe for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

-- Sola lettura per gli admin, come il registro modifiche delle passive:
-- nessuna policy di insert/update/delete per authenticated, solo i trigger
-- (security definer) possono scriverci.
drop policy if exists log_attive_admin_read on public.log_modifiche_attive;
create policy log_attive_admin_read on public.log_modifiche_attive for select using (public.e_admin());
