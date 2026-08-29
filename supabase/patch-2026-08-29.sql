-- ============================================================
--  PATCH correttiva — 29/08/2026
--  Da eseguire nell'SQL Editor di Supabase sul progetto dello
--  Scadenziario, DOPO schema.sql (è idempotente: si può rilanciare).
--  Le stesse modifiche sono già state riportate in schema.sql, che
--  resta la versione completa e aggiornata dello schema.
-- ============================================================

-- ------------------------------------------------------------
--  FIX 1 — Lo stato non veniva ricalcolato al cambio dell'importo
-- ------------------------------------------------------------
--  Prima: ricalcola_stato_fattura() era invocata solo dal trigger sui
--  pagamenti. Correggendo l'importo di una fattura già saldata (es. da
--  1.000 a 1.500 €) lo stato restava 'pagata': la fattura spariva da
--  "Da pagare", dagli alert scadenze e dai totali, pur avendo un residuo.
--  Ora un trigger BEFORE UPDATE ricalcola lo stato ogni volta che
--  l'importo cambia, confrontandolo con i pagamenti già registrati.

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

-- Riallinea le fatture già presenti il cui stato fosse incoerente
-- con i pagamenti registrati (effetto del bug prima della patch).
update public.fatture f set stato = s.atteso, updated_at = now()
from (
  select f2.id,
         case
           when coalesce(p.tot,0) <= 0          then 'da_pagare'
           when coalesce(p.tot,0) >= f2.importo then 'pagata'
           else                                      'pagata_parziale'
         end as atteso
  from public.fatture f2
  left join (
    select fattura_id, sum(importo) as tot from public.pagamenti group by fattura_id
  ) p on p.fattura_id = f2.id
) s
where s.id = f.id and f.stato is distinct from s.atteso;

-- ------------------------------------------------------------
--  FIX 7a — Ogni pagamento generava DUE righe nel registro modifiche
-- ------------------------------------------------------------
--  ricalcola_stato_fattura() eseguiva sempre l'UPDATE sulla fattura, anche
--  quando lo stato risultante era identico a quello già presente. Quell'UPDATE
--  faceva scattare il trigger di audit on_fatture_log, che registrava una riga
--  'modifica' fittizia (con prima/dopo identici) accanto al legittimo
--  'pagamento_aggiunto'. Ora l'UPDATE avviene solo se lo stato cambia davvero.

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
     and stato is distinct from v_stato;   -- <-- niente UPDATE (e niente log) se nulla cambia
end; $$;

-- ------------------------------------------------------------
--  FIX 2 — Un account creato da fuori otteneva accesso completo
-- ------------------------------------------------------------
--  Se nel progetto Supabase è attivo il signup pubblico (impostazione di
--  DEFAULT), chiunque conosca l'URL può registrarsi con la anon key. Il
--  trigger handle_new_user gli creava un profilo con ruolo 'operatore', e le
--  policy davano a ogni operatore lettura, scrittura E CANCELLAZIONE su tutte
--  le fatture, oltre alla lettura di tutti i PDF nello storage.
--
--  Difesa in profondità: i profili creati automaticamente nascono ora con
--  ruolo 'in_attesa', che non può né leggere né scrivere nulla. Un admin
--  abilita l'utente esplicitamente:
--      update public.profili set ruolo='operatore' where email='collega@cri.it';
--
--  ATTENZIONE: questa è la seconda linea di difesa. La prima resta
--  disattivare le iscrizioni pubbliche nella dashboard Supabase
--  (Authentication > Sign In / Providers > Allow new users to sign up = OFF).

alter table public.profili drop constraint if exists profili_ruolo_check;
alter table public.profili add constraint profili_ruolo_check
  check (ruolo in ('admin','operatore','in_attesa'));
alter table public.profili alter column ruolo set default 'in_attesa';

-- Chi può leggere i dati: solo utenti esplicitamente abilitati.
create or replace function public.puo_leggere()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo in ('admin','operatore')
  );
$$;

-- Le policy di lettura usavano auth.role() = 'authenticated': bastava un
-- account qualsiasi. Ora servono un profilo e un ruolo abilitato.
drop policy if exists fatture_read on public.fatture;
create policy fatture_read on public.fatture for select using (public.puo_leggere());

drop policy if exists pagamenti_read on public.pagamenti;
create policy pagamenti_read on public.pagamenti for select using (public.puo_leggere());

drop policy if exists fatture_pdf_read on storage.objects;
create policy fatture_pdf_read on storage.objects for select
  using (bucket_id = 'fatture-pdf' and public.puo_leggere());

-- ------------------------------------------------------------
--  FIX minore — updated_at non veniva mai aggiornata
-- ------------------------------------------------------------
--  La colonna era valorizzata solo alla creazione (default now()) e dal
--  ricalcolo dello stato: una modifica fatta dall'app la lasciava invariata,
--  rendendola inutilizzabile per capire quando una fattura è stata toccata.

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
