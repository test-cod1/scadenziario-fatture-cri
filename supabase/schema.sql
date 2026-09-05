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
  -- Ruolo DI PORTALE, da non confondere con il ruolo dentro una sezione (che
  -- sta in public.autorizzazioni): 'super_admin' governa utenti e permessi di
  -- tutto il portale, 'utente' accede solo alle sezioni che gli sono state
  -- assegnate. 'in_attesa' e' il ruolo di partenza di ogni profilo creato
  -- automaticamente: non legge e non scrive nulla finche' non viene abilitato,
  -- cosi' un'eventuale registrazione pubblica su Supabase non da' accesso a
  -- nulla.
  ruolo text not null default 'in_attesa' check (ruolo in ('super_admin','utente','in_attesa')),
  -- true per gli utenti creati da un admin con password provvisoria: l'app li
  -- costringe a impostarne una propria al primo accesso, prima di mostrare
  -- qualunque altra pagina.
  deve_cambiare_password boolean not null default false,
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

-- Il flag "deve cambiare password" si spegne QUI, guardando la password vera,
-- e non su richiesta del client: prima lo azzerava l'app subito dopo il
-- cambio, ma la policy prof_update_self lasciava scrivere quella colonna a
-- chiunque sulla propria riga — bastava una PATCH per saltare l'obbligo
-- continuando a usare la password provvisoria comunicata dall'admin. Con il
-- trigger il flag cade solo quando l'hash della password cambia davvero.
create or replace function public.handle_password_changed()
returns trigger language plpgsql security definer as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profili set deve_cambiare_password = false where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row execute procedure public.handle_password_changed();

-- ---------- SEZIONI DEL PORTALE ----------
-- L'elenco sta a database (e non solo nel codice) perche' le autorizzazioni vi
-- fanno riferimento con una chiave esterna: una sezione scritta male in un
-- insert viene rifiutata, invece di creare un permesso che non porta da
-- nessuna parte.
create table if not exists public.sezioni (
  id text primary key,
  etichetta text not null,
  ordine int not null default 0
);

insert into public.sezioni (id, etichetta, ordine) values
  ('scadenziario', 'Scadenziario',          1),
  ('formazione',   'Formazione Esterna',    2),
  ('trasporti',    'Trasporti lunghi',      3),
  ('assistenze',   'Assistenze sanitarie',  4)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;

-- ---------- AUTORIZZAZIONI (utente x sezione x ruolo) ----------
-- L'assenza di riga significa "nessun accesso": non serve un ruolo "nessuno",
-- e revocare un permesso e' una delete, non un valore speciale da gestire
-- ovunque.
create table if not exists public.autorizzazioni (
  utente_id uuid not null references auth.users(id) on delete cascade,
  sezione   text not null references public.sezioni(id) on delete cascade,
  ruolo     text not null default 'operatore' check (ruolo in ('operatore','admin')),
  assegnata_da uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  primary key (utente_id, sezione)
);
create index if not exists idx_autorizzazioni_utente on public.autorizzazioni(utente_id);

-- ---------- CONTROLLO ACCESSI ----------
create or replace function public.e_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profili where id = auth.uid() and ruolo = 'super_admin');
$$;

-- Ruolo dell'utente corrente nella sezione indicata: 'admin', 'operatore'
-- oppure NULL se non vi ha accesso. Il super admin e' admin ovunque.
create or replace function public.ruolo_sezione(p_sezione text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.profili where id = auth.uid() and ruolo = 'super_admin') then 'admin'
    else (select a.ruolo from public.autorizzazioni a
          where a.utente_id = auth.uid() and a.sezione = p_sezione)
  end;
$$;

create or replace function public.accede_a(p_sezione text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ruolo_sezione(p_sezione) is not null;
$$;

create or replace function public.e_admin_sezione(p_sezione text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ruolo_sezione(p_sezione) = 'admin';
$$;

-- Le tre funzioni storiche sono sinonimi di "...nella sezione scadenziario":
-- tutte le policy delle tabelle delle fatture le richiamano e non hanno
-- bisogno di sapere che attorno e' nato un portale con altre sezioni.
create or replace function public.puo_scrivere()
returns boolean language sql stable security definer set search_path = public as $$
  select public.accede_a('scadenziario');
$$;

create or replace function public.puo_leggere()
returns boolean language sql stable security definer set search_path = public as $$
  select public.accede_a('scadenziario');
$$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_admin_sezione('scadenziario');
$$;

-- ---------- FATTURE ----------
create table if not exists public.fatture (
  id uuid primary key default gen_random_uuid(),
  fornitore text not null,
  numero_fattura text,
  data_fattura date,
  importo numeric(12,2) not null check (importo > 0),
  scadenza date,
  -- 'stornata' = chiusa da una nota di credito che copre da sola l'intero
  -- importo, non da un pagamento vero: se c'è di mezzo anche un pagamento
  -- reale la fattura resta 'pagata'. Vedi note_credito più sotto.
  stato text not null default 'da_pagare' check (stato in ('da_pagare','pagata_parziale','pagata','stornata')),
  metodo_pagamento text,          -- bonifico / riba / rid / contanti / altro
  note text,
  estratta_da_ai boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fatture_data on public.fatture(data_fattura);
create index if not exists idx_fatture_scadenza on public.fatture(scadenza);
create index if not exists idx_fatture_stato on public.fatture(stato);
create index if not exists idx_fatture_fornitore on public.fatture(fornitore);

-- ---------- PAGAMENTI (acconti / rate) ----------
create table if not exists public.pagamenti (
  id uuid primary key default gen_random_uuid(),
  fattura_id uuid not null references public.fatture(id) on delete cascade,
  importo numeric(12,2) not null check (importo > 0),
  data_pagamento date not null,
  metodo text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists idx_pagamenti_fattura on public.pagamenti(fattura_id);

-- ---------- NOTE DI CREDITO ----------
-- Una nota di credito è un documento (testata) che può stornare PIÙ fatture
-- insieme, ciascuna per una quota diversa: capita spesso nella pratica. Per
-- questo ha una riga per ciascuna fattura stornata, come le fatture con i
-- loro pagamenti.
create table if not exists public.note_credito (
  id uuid primary key default gen_random_uuid(),
  numero text,
  data date not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.note_credito_righe (
  id uuid primary key default gen_random_uuid(),
  nota_credito_id uuid not null references public.note_credito(id) on delete cascade,
  fattura_id uuid not null references public.fatture(id) on delete cascade,
  importo numeric(12,2) not null check (importo > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_ncr_nota on public.note_credito_righe(nota_credito_id);
create index if not exists idx_ncr_fattura on public.note_credito_righe(fattura_id);

-- Ricalcola automaticamente lo stato della fattura in base a pagamenti E note
-- di credito collegate. L'UPDATE viene eseguito SOLO se lo stato cambia
-- davvero: altrimenti farebbe scattare il trigger di audit generando una riga
-- 'modifica' fittizia accanto a ogni 'pagamento_aggiunto'/'pagamento_rimosso'.
create or replace function public.ricalcola_stato_fattura(p_fattura_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_importo  numeric(12,2);
  v_pagato   numeric(12,2);
  v_stornato numeric(12,2);
  v_stato    text;
begin
  select importo into v_importo from public.fatture where id = p_fattura_id;
  if v_importo is null then return; end if;
  select coalesce(sum(importo),0) into v_pagato   from public.pagamenti         where fattura_id = p_fattura_id;
  select coalesce(sum(importo),0) into v_stornato from public.note_credito_righe where fattura_id = p_fattura_id;
  v_stato := case
    when (v_pagato + v_stornato) <= 0          then 'da_pagare'
    when (v_pagato + v_stornato) <  v_importo  then 'pagata_parziale'
    when v_stornato >= v_importo               then 'stornata'
    else                                             'pagata'
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

-- A differenza dei pagamenti, una riga di nota di credito può in teoria
-- cambiare fattura_id in un UPDATE: si ricalcolano entrambe le fatture
-- coinvolte, non solo quella nuova.
create or replace function public.trg_note_credito_righe_ricalcola()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.ricalcola_stato_fattura(old.fattura_id);
  elsif tg_op = 'UPDATE' then
    perform public.ricalcola_stato_fattura(new.fattura_id);
    if new.fattura_id is distinct from old.fattura_id then
      perform public.ricalcola_stato_fattura(old.fattura_id);
    end if;
  else
    perform public.ricalcola_stato_fattura(new.fattura_id);
  end if;
  return null;
end; $$;

drop trigger if exists on_nota_credito_riga_change on public.note_credito_righe;
create trigger on_nota_credito_riga_change
  after insert or update or delete on public.note_credito_righe
  for each row execute procedure public.trg_note_credito_righe_ricalcola();

-- Se cambia l'importo della fattura, lo stato va ricalcolato confrontandolo
-- con pagamenti e note di credito già registrati: senza questo trigger,
-- correggendo l'importo di una fattura già saldata lo stato sarebbe rimasto
-- 'pagata' e la fattura sarebbe sparita da "Da pagare", dagli alert e dai
-- totali pur avendo residuo.
create or replace function public.trg_fatture_stato()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pagato numeric(12,2); v_stornato numeric(12,2);
begin
  if new.importo is distinct from old.importo then
    select coalesce(sum(importo),0) into v_pagato
      from public.pagamenti where fattura_id = new.id;
    select coalesce(sum(importo),0) into v_stornato
      from public.note_credito_righe where fattura_id = new.id;
    new.stato := case
      when (v_pagato + v_stornato) <= 0           then 'da_pagare'
      when (v_pagato + v_stornato) <  new.importo then 'pagata_parziale'
      when v_stornato >= new.importo              then 'stornata'
      else                                              'pagata'
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
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists on_fatture_updated_at on public.fatture;
create trigger on_fatture_updated_at
  before update on public.fatture
  for each row execute procedure public.trg_fatture_updated_at();

-- ---------- IMPOSTAZIONI (riga singola, configurazione globale) ----------
create table if not exists public.impostazioni (
  id smallint primary key default 1 check (id = 1),   -- vincolo a una sola riga: è configurazione globale, non un elenco
  giorni_scadenza_default integer not null default 60 check (giorni_scadenza_default >= 0),
  updated_at timestamptz default now()
);
insert into public.impostazioni (id) values (1) on conflict (id) do nothing;

drop trigger if exists on_impostazioni_updated_at on public.impostazioni;
create trigger on_impostazioni_updated_at
  before update on public.impostazioni
  for each row execute procedure public.trg_fatture_updated_at();

-- ---------- LOG MODIFICHE (audit trail, sola lettura per admin) ----------
create table if not exists public.log_modifiche (
  id uuid primary key default gen_random_uuid(),
  fattura_id uuid,                -- niente FK: la riga deve restare leggibile anche dopo la cancellazione
  fornitore_snapshot text,
  numero_snapshot text,
  azione text not null check (azione in ('creazione','modifica','cancellazione','pagamento_aggiunto','pagamento_rimosso','nota_credito_aggiunta','nota_credito_rimossa')),
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

-- Una riga di log per ogni fattura toccata da una nota di credito (non una
-- per documento): risponde a "quali fatture si sono viste stornare" tanto
-- quanto "chi ha creato la nota", coerente con com'è organizzato il resto
-- del registro modifiche (sempre per fattura).
create or replace function public.trg_note_credito_righe_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text; v_nome text; v_fornitore text; v_numero text; v_nc_numero text; v_nc_data date;
begin
  select email, nome into v_email, v_nome from public.log_utente_info();
  if tg_op = 'INSERT' then
    select fornitore, numero_fattura into v_fornitore, v_numero from public.fatture where id = new.fattura_id;
    select numero, data into v_nc_numero, v_nc_data from public.note_credito where id = new.nota_credito_id;
    insert into public.log_modifiche (fattura_id, fornitore_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (new.fattura_id, v_fornitore, v_numero, 'nota_credito_aggiunta',
      jsonb_build_object('importo', new.importo, 'nota_credito_numero', v_nc_numero, 'nota_credito_data', v_nc_data),
      auth.uid(), v_email, v_nome);
  elsif tg_op = 'DELETE' then
    select fornitore, numero_fattura into v_fornitore, v_numero from public.fatture where id = old.fattura_id;
    select numero, data into v_nc_numero, v_nc_data from public.note_credito where id = old.nota_credito_id;
    insert into public.log_modifiche (fattura_id, fornitore_snapshot, numero_snapshot, azione, dettagli, utente_id, utente_email, utente_nome)
    values (old.fattura_id, v_fornitore, v_numero, 'nota_credito_rimossa',
      jsonb_build_object('importo', old.importo, 'nota_credito_numero', v_nc_numero, 'nota_credito_data', v_nc_data),
      auth.uid(), v_email, v_nome);
  end if;
  return null;
end; $$;

drop trigger if exists on_note_credito_righe_log on public.note_credito_righe;
create trigger on_note_credito_righe_log
  after insert or delete on public.note_credito_righe
  for each row execute procedure public.trg_note_credito_righe_log();

-- ---------- PROPOSTE DI PAGAMENTO ----------
-- L'operatore propone (importo, data prevista, metodo); solo l'admin può
-- confermarle (scrive il pagamento vero e proprio) o rifiutarle.
create table if not exists public.proposte_pagamento (
  id uuid primary key default gen_random_uuid(),
  fattura_id uuid not null references public.fatture(id) on delete cascade,
  importo numeric(12,2) not null check (importo > 0),
  data_prevista date,
  metodo text,
  note text,
  stato text not null default 'proposta' check (stato in ('proposta','confermata','rifiutata')),
  -- Nome/email salvati al momento della proposta (non solo l'id): restano
  -- leggibili anche se in futuro cambia il profilo, senza dover fare un
  -- embed su auth.users (non esposto da PostgREST).
  proposta_da uuid references auth.users(id),
  proposta_da_nome text,
  proposta_da_email text,
  decisa_da uuid references auth.users(id),
  decisa_da_nome text,
  decisa_il timestamptz,
  motivo_rifiuto text,
  pagamento_id uuid references public.pagamenti(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_proposte_fattura on public.proposte_pagamento(fattura_id);
create index if not exists idx_proposte_stato on public.proposte_pagamento(stato);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.profili           enable row level security;
alter table public.sezioni           enable row level security;
alter table public.autorizzazioni    enable row level security;
alter table public.fatture           enable row level security;
alter table public.pagamenti         enable row level security;
alter table public.note_credito       enable row level security;
alter table public.note_credito_righe enable row level security;
alter table public.proposte_pagamento enable row level security;
alter table public.log_modifiche     enable row level security;
alter table public.impostazioni      enable row level security;

drop policy if exists prof_self on public.profili;
create policy prof_self on public.profili for select using (id = auth.uid());
drop policy if exists prof_admin_read on public.profili;
create policy prof_admin_read on public.profili for select using (public.e_super_admin());
-- Ciascuno corregge il proprio nome, ma non si tocca né il ruolo di portale né
-- il flag della password provvisoria: quest'ultimo lo spegne il trigger
-- on_auth_password_changed quando la password cambia sul serio (vedi sopra),
-- perché lasciarlo scrivere al client rendeva l'obbligo aggirabile con una
-- semplice PATCH.
drop policy if exists prof_update_self on public.profili;
create policy prof_update_self on public.profili for update
  using (id = auth.uid())
  with check (id = auth.uid() and (ruolo, deve_cambiare_password) = (
    select p.ruolo, p.deve_cambiare_password from public.profili p where p.id = auth.uid()));
-- Il super admin gestisce i profili dei colleghi dall'app (Impostazioni >
-- Utenti e autorizzazioni): abilitare chi è rimasto 'in_attesa', correggere un
-- nome. Non può però togliersi da solo il ruolo di super admin: senza questa
-- rete di sicurezza un clic distratto sull'ultimo super admin chiudeva fuori
-- tutti dalla gestione utenti, e si tornava per forza all'SQL Editor di
-- Supabase.
-- ...e non può nemmeno NOMINARE un altro super admin: il README lo dava già
-- per scontato ("quel ruolo si assegna solo dal database, altrimenti chi
-- gestisce gli utenti potrebbe auto-promuoversi"), ma la policy controllava
-- solo il caso dell'auto-declassamento — bastava una chiamata REST per
-- promuovere un complice, o sé stessi passando per un secondo account.
-- Conseguenza voluta: sulla riga di un altro super admin questa policy non
-- lascia passare alcun update, nemmeno del nome. Va bene: l'app non ne
-- propone (quelle righe non hanno né tendine né pulsante Sospendi) e un
-- ruolo che si assegna solo dall'SQL Editor si corregge nello stesso posto.
drop policy if exists prof_admin_update on public.profili;
create policy prof_admin_update on public.profili for update
  using (public.e_super_admin())
  with check (public.e_super_admin() and case
    when id = auth.uid() then ruolo = 'super_admin'   -- non ci si declassa da soli
    else ruolo <> 'super_admin'                        -- non si promuove nessuno
  end);

-- Le sezioni non sono un dato riservato (sono gli stessi nomi che si leggono
-- in home): l'elenco serve a chiunque abbia fatto il login per disegnare il
-- menu, comprese le card bloccate.
drop policy if exists sezioni_read on public.sezioni;
create policy sezioni_read on public.sezioni for select to authenticated using (true);

-- Ognuno legge i propri permessi (l'app li usa per capire cosa mostrare);
-- il super admin li legge e li scrive tutti.
drop policy if exists autor_self on public.autorizzazioni;
create policy autor_self on public.autorizzazioni for select using (utente_id = auth.uid());
drop policy if exists autor_sa_read on public.autorizzazioni;
create policy autor_sa_read on public.autorizzazioni for select using (public.e_super_admin());
drop policy if exists autor_sa_write on public.autorizzazioni;
create policy autor_sa_write on public.autorizzazioni for all
  using (public.e_super_admin()) with check (public.e_super_admin());

drop policy if exists fatture_read on public.fatture;
create policy fatture_read on public.fatture for select using (public.puo_leggere());
drop policy if exists fatture_write on public.fatture;
create policy fatture_write on public.fatture for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

drop policy if exists pagamenti_read on public.pagamenti;
create policy pagamenti_read on public.pagamenti for select using (public.puo_leggere());
-- Solo l'admin scrive pagamenti: è lui che li esegue davvero. L'operatore
-- può solo proporli (vedi proposte_pagamento più sotto).
drop policy if exists pagamenti_write on public.pagamenti;
create policy pagamenti_write on public.pagamenti for all
  using (public.e_admin()) with check (public.e_admin());

-- A differenza dei pagamenti (dove scrive solo l'admin, perché è lui che li
-- esegue davvero), le note di credito sono documenti ricevuti dai fornitori:
-- anche l'operatore può registrarle, come già può fare con le fatture.
drop policy if exists note_credito_read on public.note_credito;
create policy note_credito_read on public.note_credito for select using (public.puo_leggere());
drop policy if exists note_credito_write on public.note_credito;
create policy note_credito_write on public.note_credito for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

drop policy if exists note_credito_righe_read on public.note_credito_righe;
create policy note_credito_righe_read on public.note_credito_righe for select using (public.puo_leggere());
drop policy if exists note_credito_righe_write on public.note_credito_righe;
create policy note_credito_righe_write on public.note_credito_righe for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

-- Lettura: l'admin vede tutte le proposte, l'operatore solo le proprie.
drop policy if exists proposte_read on public.proposte_pagamento;
create policy proposte_read on public.proposte_pagamento for select
  using (public.e_admin() or proposta_da = auth.uid());
-- Creazione: chiunque possa scrivere (admin/operatore) può proporre, ma solo
-- a proprio nome (non si può proporre "per conto di" un collega).
drop policy if exists proposte_insert on public.proposte_pagamento;
create policy proposte_insert on public.proposte_pagamento for insert
  with check (public.puo_scrivere() and proposta_da = auth.uid());
-- Conferma/rifiuto: solo l'admin può cambiare stato/esito di una proposta.
drop policy if exists proposte_update_admin on public.proposte_pagamento;
create policy proposte_update_admin on public.proposte_pagamento for update
  using (public.e_admin()) with check (public.e_admin());
-- Ritiro: l'autore può cancellare una propria proposta finché è ancora in
-- attesa (non più se l'admin l'ha già confermata o rifiutata).
drop policy if exists proposte_delete_own on public.proposte_pagamento;
create policy proposte_delete_own on public.proposte_pagamento for delete
  using (proposta_da = auth.uid() and stato = 'proposta');
drop policy if exists proposte_delete_admin on public.proposte_pagamento;
create policy proposte_delete_admin on public.proposte_pagamento for delete
  using (public.e_admin());

-- Il log è sola lettura per gli admin: nessuna policy di insert/update/delete
-- per il ruolo authenticated, quindi solo le funzioni trigger (security
-- definer) possono scriverci, mai un client anche in caso di bug lato app.
drop policy if exists log_admin_read on public.log_modifiche;
create policy log_admin_read on public.log_modifiche for select using (public.e_admin());

-- Le impostazioni le leggono tutti gli abilitati (servono per calcolare la
-- scadenza di default), ma solo gli admin possono modificarle. Niente insert/
-- delete: la riga è seminata dallo schema stesso e resta unica per il vincolo
-- id=1.
drop policy if exists impostazioni_read on public.impostazioni;
create policy impostazioni_read on public.impostazioni for select using (public.puo_leggere());
drop policy if exists impostazioni_write on public.impostazioni;
create policy impostazioni_write on public.impostazioni for update
  using (public.e_admin()) with check (public.e_admin());

-- ============================================================
--  FATTURE ATTIVE (emesse ai clienti) — sezione indipendente
-- ============================================================

-- ---------- FATTURE ATTIVE ----------
create table if not exists public.fatture_attive (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  numero_fattura text,
  data_fattura date,
  importo numeric(12,2) not null check (importo > 0),
  -- 'stornata' = chiusa da una nota di credito emessa che copre da sola
  -- l'intero importo, non da un incasso vero: se c'è di mezzo anche un incasso
  -- reale la fattura resta 'incassata'. Vedi note_credito_attive più sotto.
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
create index if not exists idx_fatture_attive_data on public.fatture_attive(data_fattura);
create index if not exists idx_fatture_attive_stato on public.fatture_attive(stato);
create index if not exists idx_fatture_attive_cliente on public.fatture_attive(cliente);

-- ---------- INCASSI (acconti / rate ricevute dal cliente) ----------
create table if not exists public.incassi (
  id uuid primary key default gen_random_uuid(),
  fattura_attiva_id uuid not null references public.fatture_attive(id) on delete cascade,
  importo numeric(12,2) not null check (importo > 0),
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
    when v_stornato >= v_importo                  then 'stornata'
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
      when v_stornato >= new.importo                 then 'stornata'
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

-- ============================================================
--  SEZIONE TRASPORTI (preventivi trasporti sanitari fuori Genova)
--  Arrivata nel portale dal gestionale preventivo-trasporti, che aveva un
--  progetto Supabase tutto suo. Vedi patch-2026-09-01-trasporti.sql (tabelle)
--  ed export-trasporti.sql (travaso dei dati dal vecchio progetto).
-- ============================================================
create table if not exists public.preventivi (
  id uuid primary key default gen_random_uuid(),
  titolo text,
  cliente text,
  data_servizio date,
  stato text not null default 'bozza' check (stato in ('bozza','inviato','confermato','annullato')),
  note text,
  tappe jsonb default '[]'::jsonb,        -- destinazioni [{label,lon,lat,iso2,iso3,paese}]
  andata_ritorno boolean default true,
  km_auto boolean default true,
  km_totali numeric(10,1),
  paese_dest text,                        -- ISO alpha-2 destinazione
  paese_dest_nome text,
  input jsonb,                            -- tutti i parametri di calcolo
  risultato jsonb,                        -- spesaReale, addebito, margine, ...
  created_by uuid references auth.users(id),
  -- Autore dei preventivi importati dal vecchio gestionale: la' gli utenti
  -- erano account di un ALTRO progetto Supabase e i loro id qui non esistono.
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prev_created on public.preventivi(created_at desc);
create index if not exists idx_prev_stato on public.preventivi(stato);

-- Parametri di calcolo, parco mezzi e prezzi carburante: una riga sola.
create table if not exists public.impostazioni_trasferte (
  id text primary key default 'default',
  dati jsonb not null,
  updated_at timestamptz default now()
);

-- Chi ha accesso alla sezione trasporti legge e scrive. Le impostazioni le
-- modifica anche l'operatore (sono i parametri del preventivo di tutti i
-- giorni, non una configurazione di sistema): era cosi' nel gestionale di
-- provenienza ed e' rimasto cosi'.
alter table public.preventivi             enable row level security;
alter table public.impostazioni_trasferte enable row level security;

drop policy if exists prev_read on public.preventivi;
create policy prev_read on public.preventivi for select using (public.accede_a('trasporti'));
drop policy if exists prev_write on public.preventivi;
create policy prev_write on public.preventivi for all
  using (public.accede_a('trasporti')) with check (public.accede_a('trasporti'));

drop policy if exists imp_trasf_read on public.impostazioni_trasferte;
create policy imp_trasf_read on public.impostazioni_trasferte for select using (public.accede_a('trasporti'));
drop policy if exists imp_trasf_write on public.impostazioni_trasferte;
create policy imp_trasf_write on public.impostazioni_trasferte for all
  using (public.accede_a('trasporti')) with check (public.accede_a('trasporti'));

-- ============================================================
--  NOTA: dopo aver eseguito lo schema, promuovi il tuo utente a super admin
--  (e' l'unico ruolo che non si assegna dall'app):
--    update public.profili set ruolo='super_admin' where email='tua@email';
--  Da li' in poi utenti e permessi si gestiscono dal portale, in
--  Impostazioni > Utenti e autorizzazioni. A mano si farebbe cosi':
--    update public.profili set ruolo='utente' where email='collega@cri.it';
--    insert into public.autorizzazioni (utente_id, sezione, ruolo)
--      select id, 'scadenziario', 'operatore' from public.profili
--      where email='collega@cri.it';
--
--  Ricorda inoltre di disattivare le iscrizioni pubbliche:
--    Authentication > Sign In / Providers > Allow new users to sign up = OFF
-- ============================================================

-- ============================================================
--  SEZIONE ASSISTENZE SANITARIE (generatore di preventivi)
--  Vedi patch-2026-09-02-assistenze.sql.
-- ============================================================
create table if not exists public.preventivi_assistenze (
  id uuid primary key default gen_random_uuid(),
  cliente text,
  cliente_indirizzo text,
  cliente_cf text,
  referente text,
  referente_email text,
  referente_telefono text,
  oggetto text,
  luogo text,
  data_documento date,
  stato text not null default 'bozza' check (stato in ('bozza','inviato','confermato','annullato')),
  -- Voci del tariffario usate in QUESTO preventivo, col prezzo del momento:
  -- [{id, nome, tipo: 'oraria'|'fissa', prezzo}]. Sono una copia, non un
  -- riferimento: un preventivo gia' inviato deve continuare a mostrare i
  -- prezzi con cui e' stato fatto anche se il tariffario cambia.
  voci jsonb not null default '[]'::jsonb,
  -- Calendario: una riga per turno. [{data, dalle, alle, qta: {voceId: n}, note}]
  calendario jsonb not null default '[]'::jsonb,
  -- Sconti: due campi indipendenti, utilizzabili anche insieme. La
  -- percentuale si calcola sul totale, l'importo fisso si toglie da quello
  -- che resta. La colonna 'totale' e' sempre il netto, cioe' quanto il
  -- cliente paga davvero.
  sconto_percentuale numeric(5,2) check (sconto_percentuale >= 0 and sconto_percentuale <= 100),
  sconto_valore numeric(12,2) check (sconto_valore >= 0),
  note text,
  totale numeric(12,2),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prev_ass_created on public.preventivi_assistenze(created_at desc);
create index if not exists idx_prev_ass_stato on public.preventivi_assistenze(stato);

-- Tariffario e testi fissi del documento: una riga sola.
create table if not exists public.impostazioni_assistenze (
  id text primary key default 'default',
  dati jsonb not null,
  updated_at timestamptz default now()
);

alter table public.preventivi_assistenze   enable row level security;
alter table public.impostazioni_assistenze enable row level security;

-- Leggere, inserire e modificare sono il lavoro di tutti i giorni e li fa
-- chiunque abbia accesso alla sezione; CANCELLARE no, resta agli admin: di un
-- preventivo eliminato non resta niente, e un operatore poteva buttare via
-- quello preparato da un collega. Il cestino nascosto nell'app è solo cortesia
-- verso l'utente, la regola che conta è questa.
--
-- Questo blocco era rimasto indietro rispetto a
-- patch-2026-09-03-assistenze-cancellazione.sql, che aveva già sostituito
-- l'unica policy "for all" con le tre separate: un database creato da zero con
-- questo file nasceva quindi SENZA la restrizione, e rieseguire schema.sql su
-- un database aggiornato la riapriva (le policy permissive si sommano, quindi
-- un "for all" rimesso qui avrebbe ridato il permesso di cancellare anche
-- accanto a prev_ass_delete).
drop policy if exists prev_ass_read on public.preventivi_assistenze;
create policy prev_ass_read on public.preventivi_assistenze for select using (public.accede_a('assistenze'));
-- La vecchia policy unica: si toglie sempre, anche su un database nuovo dove
-- non è mai esistita, così un file eseguito due volte non lascia in giro un
-- permesso più largo di quello voluto.
drop policy if exists prev_ass_write on public.preventivi_assistenze;
drop policy if exists prev_ass_insert on public.preventivi_assistenze;
create policy prev_ass_insert on public.preventivi_assistenze for insert
  with check (public.accede_a('assistenze'));
drop policy if exists prev_ass_update on public.preventivi_assistenze;
create policy prev_ass_update on public.preventivi_assistenze for update
  using (public.accede_a('assistenze')) with check (public.accede_a('assistenze'));
drop policy if exists prev_ass_delete on public.preventivi_assistenze;
create policy prev_ass_delete on public.preventivi_assistenze for delete
  using (public.e_admin_sezione('assistenze'));

-- Tariffario e testi del documento li modifica chiunque abbia accesso alla
-- sezione, operatori compresi: sono i parametri con cui si fanno i preventivi
-- tutti i giorni, non una configurazione di sistema — stessa scelta fatta per
-- le impostazioni dei trasporti, e diversa da quelle dello SCADENZIARIO (dove
-- servono i permessi di admin). E' voluto, ma non era scritto da nessuna
-- parte: se un domani il tariffario deve diventare materia da soli admin,
-- basta sostituire accede_a('assistenze') con e_admin_sezione('assistenze')
-- nella policy di scrittura qui sotto e aggiungere il controllo del ruolo in
-- js/assistenze/views/impostazioni.js.
drop policy if exists imp_ass_read on public.impostazioni_assistenze;
create policy imp_ass_read on public.impostazioni_assistenze for select using (public.accede_a('assistenze'));
drop policy if exists imp_ass_write on public.impostazioni_assistenze;
create policy imp_ass_write on public.impostazioni_assistenze for all
  using (public.accede_a('assistenze')) with check (public.accede_a('assistenze'));

-- ============================================================
--  ELIMINAZIONE DI UN UTENTE — chiavi esterne verso auth.users
--  (equivalente di supabase/patch-2026-09-05-elimina-utente.sql, tenuto
--  qui in fondo perché deve girare dopo la creazione di TUTTE le tabelle)
--
--  Le colonne che indicano chi ha inserito una riga (created_by, e
--  analoghe: proposta_da, decisa_da, richiesto_da, assegnata_da) puntano
--  ad auth.users. Lasciate senza regola di cancellazione impedirebbero di
--  eliminare un utente che abbia mai inserito qualcosa — cioè chiunque —
--  facendo fallire /api/elimina-utente con una violazione di chiave
--  esterna. Portandole a ON DELETE SET NULL l'account si può cancellare e
--  i dati restano tutti: perdono soltanto l'indicazione dell'autore.
--
--  Restano fuori, di proposito, profili.id e autorizzazioni.utente_id
--  (già ON DELETE CASCADE: profilo e permessi devono sparire con
--  l'account) e i log, che non hanno chiave esterna e conservano email e
--  nome come testo.
-- ============================================================
do $$
declare r record;
begin
  for r in
    select c.conname,
           c.conrelid::regclass::text as tabella,
           a.attname                  as colonna
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum   = c.conkey[1]
     where c.contype      = 'f'
       and c.confrelid    = 'auth.users'::regclass
       and c.connamespace = 'public'::regnamespace
       and array_length(c.conkey, 1) = 1
       and c.confdeltype in ('a', 'r')
       and not a.attnotnull
  loop
    execute format('alter table %s drop constraint %I', r.tabella, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      r.tabella, r.conname, r.colonna);
  end loop;
end $$;
