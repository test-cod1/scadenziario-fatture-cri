-- ============================================================
--  NOTE DI CREDITO
--  Esegui questo file nell'editor SQL di Supabase (SQL Editor > New query),
--  DOPO schema.sql e patch-proposte-pagamento.sql.
-- ------------------------------------------------------------
--  Una nota di credito è un documento (numero, data, note) che può stornare
--  PIÙ fatture insieme, ciascuna per una quota diversa — capita spesso nella
--  pratica. Per questo è modellata su due livelli, come le fatture con le
--  loro righe:
--    - note_credito       = la testata del documento
--    - note_credito_righe = una riga per ciascuna fattura stornata, con
--                            l'importo che va a coprire proprio quella
--  Lo stato di ciascuna fattura viene ricalcolato sommando i pagamenti E le
--  righe di note di credito che la riguardano:
--    - coperto (pagato + stornato) = 0        -> 'da_pagare'
--    - 0 < coperto < importo                   -> 'pagata_parziale'
--    - coperto >= importo, e c'è uno storno    -> 'stornata'
--    - coperto >= importo, solo pagamenti      -> 'pagata'
--  Anche l'operatore può registrarle (sono documenti ricevuti dai fornitori,
--  non un'esecuzione di pagamento): a differenza dei pagamenti veri, qui non
--  si è ristretta la scrittura al solo admin.
-- ============================================================

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

-- ---------- stato fattura: aggiunto 'stornata' ----------
alter table public.fatture drop constraint if exists fatture_stato_check;
alter table public.fatture add constraint fatture_stato_check
  check (stato in ('da_pagare','pagata_parziale','pagata','stornata'));

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
    when v_stornato > 0                        then 'stornata'
    else                                             'pagata'
  end;
  update public.fatture
     set stato = v_stato, updated_at = now()
   where id = p_fattura_id
     and stato is distinct from v_stato;
end; $$;

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

-- Se cambia l'importo della fattura va rifatto lo stesso conto (pagato +
-- stornato vs nuovo importo), non solo quello dei pagamenti.
create or replace function public.trg_fatture_stato()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pagato numeric(12,2); v_stornato numeric(12,2);
begin
  if new.importo is distinct from old.importo then
    select coalesce(sum(importo),0) into v_pagato   from public.pagamenti         where fattura_id = new.id;
    select coalesce(sum(importo),0) into v_stornato from public.note_credito_righe where fattura_id = new.id;
    new.stato := case
      when (v_pagato + v_stornato) <= 0           then 'da_pagare'
      when (v_pagato + v_stornato) <  new.importo then 'pagata_parziale'
      when v_stornato > 0                         then 'stornata'
      else                                              'pagata'
    end;
  end if;
  return new;
end; $$;

-- ---------- audit trail: una riga di log per ogni fattura toccata da una
-- nota di credito, stesso pattern già usato per i pagamenti ----------
alter table public.log_modifiche drop constraint if exists log_modifiche_azione_check;
alter table public.log_modifiche add constraint log_modifiche_azione_check
  check (azione in ('creazione','modifica','cancellazione','pagamento_aggiunto','pagamento_rimosso','nota_credito_aggiunta','nota_credito_rimossa'));

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

-- ---------- RLS ----------
alter table public.note_credito       enable row level security;
alter table public.note_credito_righe enable row level security;

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
