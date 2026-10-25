-- ============================================================
--  PATCH — Totali "Pagato/Incassato questo mese e quest'anno" calcolati
--  dal database
--  Data: 2026-09-27
--
--  Le dashboard dello scadenziario mostrano quanto si è pagato (passive)
--  e incassato (attive) nel mese e nell'anno. Finora per saperlo
--  scaricavano TUTTE le righe di pagamenti/incassi del periodo, a blocchi
--  da 1000, e le sommavano nel browser: a fine anno migliaia di righe, e
--  più giri di rete in fila, solo per due numeri. Queste funzioni fanno la
--  somma in Postgres e restituiscono una riga sola.
--
--  Sono SECURITY INVOKER (il default): la somma passa dalle stesse policy
--  RLS della lettura diretta (pagamenti_read / incassi_read), quindi
--  ciascuno somma esattamente le righe che potrebbe già leggere. Niente di
--  nuovo diventa visibile.
--
--  Il sito funziona anche PRIMA di questa patch: se la funzione non esiste
--  torna da sé al calcolo nel browser (vedi sommaPeriodo in
--  js/data/store.js e js/data/storeAttive.js).
--
--  È idempotente.
-- ============================================================

create or replace function public.somma_pagamenti(p_da date, p_a date)
returns numeric language sql stable set search_path = public as $$
  select coalesce(sum(importo), 0) from public.pagamenti
  where data_pagamento between p_da and p_a;
$$;

create or replace function public.somma_incassi(p_da date, p_a date)
returns numeric language sql stable set search_path = public as $$
  select coalesce(sum(importo), 0) from public.incassi
  where data_incasso between p_da and p_a;
$$;

-- Solo per chi ha fatto l'accesso: per un anonimo le policy non
-- restituirebbero comunque righe, ma non c'è motivo di esporgli la funzione.
revoke execute on function public.somma_pagamenti(date, date) from public, anon;
revoke execute on function public.somma_incassi(date, date) from public, anon;
grant execute on function public.somma_pagamenti(date, date) to authenticated;
grant execute on function public.somma_incassi(date, date) to authenticated;
