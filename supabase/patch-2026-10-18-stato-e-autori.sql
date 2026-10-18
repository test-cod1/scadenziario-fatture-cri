-- ============================================================
--  PATCH — Stato delle fatture, proposte e autori non falsificabili
--  Data: 2026-10-18
--
--  Tre buchi trovati nella revisione del 18/10/2026, tutti dello stesso
--  tipo: colonne che il database prendeva per buone così come le mandava il
--  browser, mentre le RLS lasciano scrivere la riga a chi ha la sezione.
--
--  1. STATO DELLE FATTURE PASSIVE. I pagamenti li scrive solo l'admin, ma
--     la colonna `stato` di fatture era scrivibile dall'operatore: con una
--     PATCH {"stato":"pagata"} (o un INSERT già "pagata") la fattura spariva
--     da "Da pagare", dagli avvisi e dai totali senza alcun pagamento. Ora
--     lo stato si ricalcola SEMPRE da pagamenti e note di credito, a ogni
--     INSERT e UPDATE: quello che manda il client non conta.
--
--  2. PROPOSTE DI PAGAMENTO. La policy d'inserimento controllava solo
--     l'autore: un operatore poteva creare una proposta già "confermata",
--     con decisa_da_nome di un admin e il nome di un collega come autore.
--     Ora una proposta nasce solo "in attesa" e senza esito, nome ed email
--     dell'autore li scrive il database (da profili e dal token), e chi
--     decide è sempre chi ha fatto l'UPDATE. Le policy di lettura e ritiro
--     delle proprie proposte tengono conto della sospensione.
--
--  3. AUTORE DELLE RIGHE (created_by). Arrivava dal client: si poteva
--     inserire una fattura o un pagamento "a nome" di un altro. Ora lo
--     impone un trigger (auth.uid() all'inserimento, invariato in modifica).
--     Le operazioni senza utente (service role: import, ripristino) restano
--     libere di scriverlo.
--
--  È idempotente.
-- ============================================================

-- 1. Stato delle fatture passive ------------------------------------------
create or replace function public.trg_fatture_stato()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pagato numeric(12,2); v_stornato numeric(12,2);
begin
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
  return new;
end; $$;

drop trigger if exists on_fattura_importo_change on public.fatture;
drop trigger if exists on_fattura_stato on public.fatture;
create trigger on_fattura_stato
  before insert or update on public.fatture
  for each row execute procedure public.trg_fatture_stato();

-- 2. Proposte di pagamento ------------------------------------------------
drop policy if exists proposte_read on public.proposte_pagamento;
create policy proposte_read on public.proposte_pagamento for select
  using (public.e_admin() or (proposta_da = auth.uid() and public.puo_leggere()));

drop policy if exists proposte_insert on public.proposte_pagamento;
create policy proposte_insert on public.proposte_pagamento for insert
  with check (
    public.puo_scrivere() and proposta_da = auth.uid()
    and stato = 'proposta'
    and decisa_da is null and decisa_da_nome is null and decisa_il is null
    and motivo_rifiuto is null and pagamento_id is null
  );

drop policy if exists proposte_delete_own on public.proposte_pagamento;
create policy proposte_delete_own on public.proposte_pagamento for delete
  using (proposta_da = auth.uid() and stato = 'proposta' and public.puo_scrivere());

create or replace function public.trg_proposte_autori()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- service role: import, ripristino
  if tg_op = 'INSERT' then
    new.proposta_da := auth.uid();
    select p.nome into new.proposta_da_nome from public.profili p where p.id = auth.uid();
    new.proposta_da_email := coalesce(auth.jwt() ->> 'email', new.proposta_da_email);
  else
    new.proposta_da := old.proposta_da;
    new.proposta_da_nome := old.proposta_da_nome;
    new.proposta_da_email := old.proposta_da_email;
    if new.stato is distinct from old.stato then
      new.decisa_da := auth.uid();
      select p.nome into new.decisa_da_nome from public.profili p where p.id = auth.uid();
      new.decisa_il := now();
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists on_proposta_autori on public.proposte_pagamento;
create trigger on_proposta_autori
  before insert or update on public.proposte_pagamento
  for each row execute procedure public.trg_proposte_autori();

-- 3. Autore delle righe ---------------------------------------------------
create or replace function public.trg_forza_autore()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.created_by := auth.uid(); end if;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['fatture','pagamenti','note_credito','fatture_attive','incassi','note_credito_attive'] loop
    execute format('drop trigger if exists on_%1$s_autore on public.%1$I', t);
    execute format('create trigger on_%1$s_autore before insert or update on public.%1$I
                    for each row execute procedure public.trg_forza_autore()', t);
  end loop;
end $$;

revoke all on function public.trg_forza_autore() from public, anon, authenticated;
revoke all on function public.trg_proposte_autori() from public, anon, authenticated;
