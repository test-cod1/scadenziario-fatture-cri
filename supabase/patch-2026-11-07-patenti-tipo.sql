-- ============================================================
--  PATCH — Patenti: nuova patente o rinnovo
--  Data: 2026-11-07
--
--  Il modulo per i volontari chiede ora se vogliono ottenere una nuova
--  patente CRI o rinnovare quella che hanno. La risposta si salva in
--  `tipo`. Le richieste arrivate prima restano senza (null).
--
--  Va eseguita PRIMA di pubblicare il codice: il modulo nuovo scrive la
--  colonna, e senza di lei l'invio fallirebbe.
--
--  È idempotente.
-- ============================================================

alter table public.richieste_patenti
  add column if not exists tipo text check (tipo is null or tipo in ('nuova','rinnovo'));
