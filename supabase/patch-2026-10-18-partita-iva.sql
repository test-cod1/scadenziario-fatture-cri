-- ============================================================
--  PATCH — Partita IVA della controparte sulle fatture
--  Data: 2026-10-18
--
--  Il nome di un fornitore (o di un cliente) si scrive in mille modi —
--  "ENEL S.P.A.", "Enel SpA" — e il Report li contava come soggetti
--  diversi, mentre il controllo dei doppioni non scattava. La partita IVA
--  (o, per chi non l'ha, il codice fiscale) la legge l'XML della fattura
--  elettronica, e da oggi anche la lettura con AI dei PDF: si conserva qui.
--
--  Colonna facoltativa: le fatture già registrate restano senza, e per
--  quelle tutto continua a basarsi sul nome come prima.
--
--  È idempotente.
-- ============================================================

alter table public.fatture        add column if not exists partita_iva text;
alter table public.fatture_attive add column if not exists partita_iva text;

create index if not exists idx_fatture_partita_iva        on public.fatture(partita_iva);
create index if not exists idx_fatture_attive_partita_iva on public.fatture_attive(partita_iva);
