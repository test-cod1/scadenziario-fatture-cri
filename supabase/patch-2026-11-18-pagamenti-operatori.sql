-- ============================================================
--  PATCH — Anche l'operatore registra i pagamenti
--  Data: 2026-11-18
--
--  Fino a oggi i pagamenti delle fatture passive li scriveva solo l'admin
--  dello scadenziario; l'operatore poteva soltanto proporli. Da qui in poi
--  chi ha accesso allo scadenziario (operatore o admin) può registrarli e
--  rimuoverli, come già fa con le note di credito e con gli incassi. Ogni
--  aggiunta e rimozione resta nel registro modifiche col nome di chi l'ha
--  fatta (trigger on_pagamenti_log, invariato).
--
--  Le proposte di pagamento restano com'erano: confermarle o rifiutarle è
--  sempre dell'admin.
--
--  Il versamento delle ritenute (ritenute_versamenti) resta dell'admin.
--
--  È idempotente.
-- ============================================================

-- created_by deve essere chi scrive: un operatore non può registrare un
-- pagamento "a nome" di un collega.
drop policy if exists pagamenti_write on public.pagamenti;
drop policy if exists pagamenti_insert on public.pagamenti;
create policy pagamenti_insert on public.pagamenti for insert
  with check (public.puo_scrivere() and created_by = auth.uid());
-- Modificare un pagamento resta dell'admin: l'app non lo fa mai (si rimuove
-- e si registra di nuovo) e il registro modifiche traccia solo aggiunte e
-- rimozioni, quindi una modifica dell'operatore non lascerebbe traccia.
drop policy if exists pagamenti_update on public.pagamenti;
create policy pagamenti_update on public.pagamenti for update
  using (public.e_admin()) with check (public.e_admin());
drop policy if exists pagamenti_delete on public.pagamenti;
create policy pagamenti_delete on public.pagamenti for delete
  using (public.puo_scrivere());

-- Un pagamento registrato direttamente chiude l'unica proposta ancora in
-- attesa per quella fattura (vedi pagamenti.add in js/data/store.js). Il
-- client lo faceva con un UPDATE, che le RLS concedono solo all'admin: per
-- l'operatore non toccava niente, la proposta restava aperta e l'admin
-- poteva confermarla più tardi — un pagamento doppio. Ora lo fa questa
-- funzione, con le stesse regole per tutti: solo sul pagamento appena
-- scritto da chi la chiama, e solo se le proposte aperte sono esattamente una.
create or replace function public.chiudi_proposta_unica(p_pagamento_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_fattura uuid; v_ids uuid[]; v_nome text;
begin
  if not public.puo_scrivere() then raise exception 'Non autorizzato'; end if;
  select fattura_id into v_fattura from public.pagamenti
    where id = p_pagamento_id and created_by = auth.uid();
  if v_fattura is null then return null; end if;
  select array_agg(id) into v_ids from public.proposte_pagamento
    where fattura_id = v_fattura and stato = 'proposta';
  if coalesce(array_length(v_ids, 1), 0) <> 1 then return null; end if;
  select nome into v_nome from public.log_utente_info();
  update public.proposte_pagamento
     set stato = 'confermata', pagamento_id = p_pagamento_id,
         decisa_da = auth.uid(), decisa_da_nome = v_nome, decisa_il = now()
   where id = v_ids[1] and stato = 'proposta';
  return v_ids[1];
end; $$;

revoke execute on function public.chiudi_proposta_unica(uuid) from public, anon;
grant execute on function public.chiudi_proposta_unica(uuid) to authenticated;
