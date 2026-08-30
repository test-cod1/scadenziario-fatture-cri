-- ============================================================
--  PATCH 2026-08-30 — Vincolo importo > 0 su pagamenti e incassi
-- ------------------------------------------------------------
--  Le tabelle pagamenti e incassi non avevano, a differenza delle tabelle
--  gemelle note_credito_righe e proposte_pagamento, un vincolo a livello di
--  database che impedisse un importo zero o negativo: la sola validazione
--  esisteva lato client (js/views/fattura.js e fatturaAttiva.js). Un errore
--  applicativo, o una scrittura diretta via API REST di Supabase con un
--  token operatore/admin valido, poteva quindi inserire un pagamento/incasso
--  invalido senza che nulla lo impedisse, alterando silenziosamente lo stato
--  calcolato dai trigger di ricalcolo.
--  Se nel frattempo esistessero già righe con importo <= 0, l'ALTER TABLE
--  fallisce segnalandole: vanno corrette o rimosse prima di applicare
--  questo patch.
--  Su un database creato dopo il 30/08/2026 questo patch non serve:
--  schema.sql crea già le tabelle con questo vincolo.
-- ============================================================

alter table public.pagamenti add constraint pagamenti_importo_positivo check (importo > 0);
alter table public.incassi add constraint incassi_importo_positivo check (importo > 0);
