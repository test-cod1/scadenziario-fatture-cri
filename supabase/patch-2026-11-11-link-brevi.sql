-- ============================================================
--  PATCH — LINK DEI CENTRI DI COSTO PIÙ BREVI
--  Data: 2026-11-11
--
--  Il link di sola lettura passa da «…/centro-condiviso.html#<43 caratteri>»
--  a «…/conto#automedica-Xk3pQ9aZb2»: il nome dell'attività, leggibile, più
--  dieci caratteri casuali (vedi js/lib/linkCentri.mjs). Il vincolo sulla
--  forma del codice va allargato: lettere, cifre, trattini e trattini bassi,
--  da 10 a 60 caratteri. I codici vecchi restano validi.
--
--  È idempotente. Va dopo patch-2026-11-11-link-centri.sql.
-- ============================================================

alter table public.centri_costo drop constraint if exists centri_costo_link_token_forma;
alter table public.centri_costo add constraint centri_costo_link_token_forma
  check (link_token is null or link_token ~ '^[A-Za-z0-9_-]{10,60}$');

-- ---------- VERIFICA ----------
select pg_get_constraintdef(oid) from pg_constraint where conname = 'centri_costo_link_token_forma';
