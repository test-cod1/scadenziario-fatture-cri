-- ============================================================
--  PATCH 2026-08-31 — correzioni dalla revisione completa
--  Da eseguire nell'SQL Editor di Supabase sul progetto dello
--  Scadenziario, DOPO gli altri patch (è idempotente: si può rilanciare).
--  Le stesse modifiche sono già riportate in schema.sql, che resta la
--  versione completa e aggiornata dello schema.
--
--  Contiene:
--    FIX 1 — una nota di credito su fattura già saldata la marcava 'stornata'
--    FIX 2 — vincolo importo > 0 anche su fatture e fatture_attive
--    FIX 3 — indice su data_fattura (usato da dashboard e archivio)
--    FIX 4 — un admin può cambiare ruolo/nome dei colleghi dall'app
-- ============================================================

-- ------------------------------------------------------------
--  FIX 1 — Stato 'stornata' assegnato troppo presto
-- ------------------------------------------------------------
--  Prima: bastava una qualunque riga di nota di credito perché una fattura
--  interamente coperta risultasse 'stornata'. Una fattura da 1.000 € pagata
--  per intero, seguita da una nota di credito da 100 € (cioè un rimborso a
--  nostro favore), diventava quindi "chiusa da nota di credito": spariva dai
--  conteggi del pagato e raccontava una storia sbagliata.
--  Ora 'stornata' vale solo quando è lo STORNO DA SOLO a coprire l'intero
--  importo; se c'è di mezzo anche un pagamento vero, la fattura resta 'pagata'
--  (rispettivamente 'incassata' per le attive).

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
    when v_stornato >= v_importo               then 'stornata'   -- lo storno da solo copre tutto
    else                                             'pagata'
  end;
  update public.fatture
     set stato = v_stato, updated_at = now()
   where id = p_fattura_id
     and stato is distinct from v_stato;
end; $$;

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

create or replace function public.ricalcola_stato_fattura_attiva(p_fattura_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_importo   numeric(12,2);
  v_incassato numeric(12,2);
  v_stornato  numeric(12,2);
  v_stato     text;
begin
  select importo into v_importo from public.fatture_attive where id = p_fattura_id;
  if v_importo is null then return; end if;
  select coalesce(sum(importo),0) into v_incassato from public.incassi                   where fattura_attiva_id = p_fattura_id;
  select coalesce(sum(importo),0) into v_stornato  from public.note_credito_attive_righe where fattura_attiva_id = p_fattura_id;
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

-- Riallinea le fatture già in archivio con lo stato sbagliato: quelle marcate
-- 'stornata' che in realtà erano state pagate (in tutto o in parte) in denaro.
-- Il trigger non basta, perché scatta solo su una modifica successiva.
--
-- Nota: ciascuna riga corretta produce una voce 'modifica' nel registro
-- modifiche, attribuita all'utente che esegue questo patch (il trigger di
-- audit non è disattivabile, per scelta). È corretto che resti traccia della
-- correzione, ma aspettati qualche riga in più nel registro subito dopo.
-- Per vedere in anticipo quante fatture verranno toccate:
--   select count(*) from public.fatture f where f.stato = 'stornata'
--     and coalesce((select sum(importo) from public.note_credito_righe r
--                    where r.fattura_id = f.id), 0) < f.importo;
update public.fatture f set stato = 'pagata'
 where f.stato = 'stornata'
   and coalesce((select sum(importo) from public.note_credito_righe r where r.fattura_id = f.id), 0) < f.importo;

update public.fatture_attive f set stato = 'incassata'
 where f.stato = 'stornata'
   and coalesce((select sum(importo) from public.note_credito_attive_righe r where r.fattura_attiva_id = f.id), 0) < f.importo;

-- ------------------------------------------------------------
--  FIX 2 — Vincolo importo > 0 anche sulle fatture
-- ------------------------------------------------------------
--  pagamenti, incassi, note_credito_righe e proposte_pagamento avevano già un
--  check a livello di database; fatture e fatture_attive no: accettavano 0 o
--  un importo negativo, che l'app validava solo lato client. Una fattura da 0 €
--  restava per sempre 'da_pagare' (0 pagato su 0 dovuto) senza che nulla lo
--  segnalasse. Sparisce anche il `default 0`: un importo va sempre indicato,
--  non ereditato da un default che il vincolo rifiuterebbe comunque.
--
--  Se esistono già righe con importo <= 0 l'ALTER fallisce elencandole: si
--  correggono o si eliminano prima di rilanciare il patch. Per trovarle:
--    select id, fornitore, numero_fattura, importo from public.fatture        where importo <= 0;
--    select id, cliente,   numero_fattura, importo from public.fatture_attive where importo <= 0;

alter table public.fatture        alter column importo drop default;
alter table public.fatture_attive alter column importo drop default;

do $$ begin
  alter table public.fatture add constraint fatture_importo_positivo check (importo > 0);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.fatture_attive add constraint fatture_attive_importo_positivo check (importo > 0);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
--  FIX 3 — Indice su data_fattura
-- ------------------------------------------------------------
--  data_fattura è la colonna su cui filtrano listAperte(), listArchivio() e
--  contaArchivio() — cioè ogni apertura della dashboard — ma era l'unica
--  senza indice, a differenza di scadenza, stato e fornitore.

create index if not exists idx_fatture_data on public.fatture(data_fattura);
create index if not exists idx_fatture_attive_data on public.fatture_attive(data_fattura);

-- ------------------------------------------------------------
--  FIX 4 — Un admin può gestire i profili dei colleghi dall'app
-- ------------------------------------------------------------
--  Prima l'unica policy di UPDATE su profili era prof_update_self: un admin
--  poteva CREARE un utente dall'app, ma per abilitare un profilo rimasto
--  'in_attesa', cambiare un ruolo o correggere un nome doveva passare
--  dall'SQL Editor di Supabase. Ora c'è una pagina Utenti in Impostazioni.
--
--  La condizione su auth.uid() è una rete di sicurezza: un admin non può
--  togliere il ruolo admin a SE STESSO: senza, bastava un clic distratto
--  sull'ultimo (o unico) amministratore per chiudere fuori tutti dalle
--  Impostazioni, e si sarebbe tornati per forza all'SQL Editor.
drop policy if exists prof_admin_update on public.profili;
create policy prof_admin_update on public.profili for update
  using (public.e_admin())
  with check (public.e_admin() and (id <> auth.uid() or ruolo = 'admin'));
