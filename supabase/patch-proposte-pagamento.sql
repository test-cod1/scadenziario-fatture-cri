-- ============================================================
--  PROPOSTE DI PAGAMENTO
--  Esegui questo file nell'editor SQL di Supabase (SQL Editor > New query),
--  DOPO schema.sql (richiede le tabelle fatture/pagamenti e le funzioni
--  puo_scrivere()/puo_leggere()/e_admin() già presenti).
-- ------------------------------------------------------------
--  Flusso: un operatore propone il pagamento di una fattura (importo, data
--  prevista, metodo). L'admin è l'unico che esegue davvero i pagamenti: puo'
--  confermare la proposta (viene creato il pagamento vero e proprio, e lo
--  stato della fattura si aggiorna da solo grazie al trigger già esistente
--  su public.pagamenti) oppure rifiutarla con un motivo. Da qui in poi solo
--  l'admin può inserire/modificare/cancellare pagamenti: agli operatori
--  resta solo la lettura dello storico e la creazione di nuove proposte.
-- ============================================================

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

alter table public.proposte_pagamento enable row level security;

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

-- ------------------------------------------------------------
--  Da qui in poi i pagamenti li scrive solo l'admin (che li esegue
--  davvero): l'operatore può solo proporli e continua a poterli leggere.
-- ------------------------------------------------------------
drop policy if exists pagamenti_write on public.pagamenti;
create policy pagamenti_write on public.pagamenti for all
  using (public.e_admin()) with check (public.e_admin());
