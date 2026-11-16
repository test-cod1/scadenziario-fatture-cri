-- ============================================================
--  PATCH — Sezione Progetto Sturline
--  Data: 2026-11-16
--
--  La sezione nel portale (permessi come le altre: Operatore/Admin).
--  Non ha tabelle: i contenuti stanno in js/sturline/dati.js. La riga
--  serve perché public.sezioni è la chiave esterna di autorizzazioni:
--  senza, non si può abilitare nessuno alla sezione.
--
--  È idempotente.
-- ============================================================

insert into public.sezioni (id, etichetta, ordine) values
  ('sturline', 'Progetto Sturline', 10)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;
