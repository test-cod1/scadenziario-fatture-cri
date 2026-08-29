-- ============================================================
--  PATCH — rimozione conservazione file allegato (29/08/2026)
--  Da eseguire nell'SQL Editor di Supabase sul progetto dello
--  Scadenziario, DOPO schema.sql e patch-2026-08-29.sql (idempotente).
--  Le stesse modifiche sono già riportate in schema.sql.
-- ============================================================

-- L'app non carica più il file (PDF/immagine/XML) su storage: viene letto
-- solo per estrarre i campi (AI o parsing XML) e poi scartato. Nessuna
-- fattura era ancora stata inserita, quindi non c'è nulla da migrare.

drop policy if exists fatture_pdf_read on storage.objects;
drop policy if exists fatture_pdf_write on storage.objects;
drop policy if exists fatture_pdf_delete on storage.objects;

-- Supabase blocca la DELETE diretta su storage.buckets/objects (trigger
-- storage.protect_delete): il bucket va eliminato dalla dashboard, non da SQL.
--   Dashboard → Storage → bucket "fatture-pdf" → menu (⋮) → Delete bucket
-- (nessun file al suo interno, quindi l'eliminazione è immediata).

alter table public.fatture drop column if exists pdf_path;
