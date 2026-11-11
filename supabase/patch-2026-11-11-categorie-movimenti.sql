-- ============================================================
--  PATCH — CATEGORIA DEI MOVIMENTI DI ANALISI
--  Data: 2026-11-11
--
--  «Quanto è costata l'automedica?» è la prima domanda; la seconda è
--  «e in che cosa?». Senza una categoria, carburante, assicurazione e
--  riparazioni sono la stessa riga di un elenco: la categoria permette
--  alla pagina del centro di costo di dividerli e di disegnarli.
--
--  È un testo libero, con i suggerimenti presi da quelle già usate: le
--  categorie di un'automedica non sono quelle di un corso, e un elenco
--  fisso andrebbe allungato a ogni attività nuova. La pagina raggruppa
--  ignorando maiuscole e spazi, così «carburante» e «Carburante » sono
--  la stessa voce.
--
--  È idempotente.
-- ============================================================

alter table public.movimenti_analisi add column if not exists categoria text;

-- ---------- VERIFICA ----------
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'movimenti_analisi' and column_name = 'categoria';
