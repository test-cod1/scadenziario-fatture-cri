-- ============================================================
--  IMPORT STORICO — SCADENZIARIO 2025-2026 FATT. RICEV. (da Excel)
--  Generato automaticamente da xlsx fornito dall'utente. Rivedi le note
--  "[Import storico]" sulle singole fatture/pagamenti: segnalano i punti
--  dove il file originale era ambiguo e si è dovuta fare un'assunzione.
--  Esegui DOPO schema.sql, patch-proposte-pagamento.sql e
--  patch-note-credito.sql (richiede le tabelle pagamenti/note_credito
--  aggiornate), e dopo aver verificato con un controllo a campione
--  (es. SELECT count(*) FROM fatture prima/dopo).
--  Le note di credito trovate nel file NON sono in questo script: vedi il
--  blocco di commenti in fondo, vanno collegate a mano dall'app.
-- ============================================================

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('T4TECH S.R.L.', '1930', '2025-12-03', 246.93, '2026-01-03', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 246.93, '2026-03-05', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '13983', '2025-11-05', 80.28, '2026-01-05', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 80.28, '2026-05-11', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ADRIANO DELLE PIANE', '51', '2025-12-30', 700.00, '2026-01-08', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 700.00, '2026-01-21', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('DELTA VOICE SRL', '16', '2026-01-02', 780.12, '2026-01-09', 'pagata', 'RID', NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 780.12, '2026-01-09', 'RID', '[Import storico] Data di pagamento non specificata nel file (testo originale: "RID") — approssimata alla scadenza.' FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '116830 Gennaio', '2025-12-15', 1794.00, '2026-01-10', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1794.00, '2026-03-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Dott.GHIGLIONE TOMMASO', '1', '2026-01-11', 802.00, '2026-01-11', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 802.00, '2026-01-26', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MISECOOP COOPERATIVA SOCIALE', '11', '2026-01-12', 30.00, '2026-01-12', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 30.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('TOCCAFIORI GUGLIELMO via DONGHI', '1', '2026-01-12', 2050.00, '2026-01-12', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 2050.00, '2026-01-26', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Mori Valentina', 'PROFORMA2/26', '2026-01-13', 45.00, '2026-01-13', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 45.00, '2026-02-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Mori Valentina', '18', '2026-01-20', 170.00, '2026-01-14', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 170.00, '2026-01-14', NULL, '[Import storico] Data di pagamento non specificata nel file originale — approssimata alla scadenza.' FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAMBU SRL', '166/26', '2026-01-16', 1448.14, '2026-01-16', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1448.14, '2026-03-06', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '472', '2025-12-18', 17150.00, '2026-01-17', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ASSOCIAZIONE DELLA CROCE ROSSA ITALIANA', '251600889', '2025-12-19', 300.00, '2026-01-18', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('GARAGE OFFICINA SILVA', '133', '2025-11-24', 268.40, '2026-01-23', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 268.40, '2026-03-12', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Daniela Del Duca', '2', '2026-02-05', 4487.08, '2026-01-26', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 4487.08, '2026-01-26', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Daniela Del Duca', '3', '2026-02-05', 719.68, '2026-01-26', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 719.68, '2026-01-26', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '14718', '2025-11-26', 89.77, '2026-01-26', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 89.77, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '14741', '2025-11-26', 144.95, '2026-01-26', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 144.95, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '14742', '2025-11-27', 327.73, '2026-01-27', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 327.73, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '14743', '2025-11-27', 31.23, '2026-01-27', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 31.23, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MISECOOP COOPERATIVA SOCIALE', '36', '2026-01-27', 30.00, '2026-01-27', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 30.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Akkad Wattar MBasel', '1', '2026-01-28', 802.00, '2026-01-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 802.00, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('CROCE ROSSA ITALIANA CIAMPINO', '43', '2026-01-28', 45.00, '2026-01-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 45.00, '2026-02-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('WORK SAS', '25', '2026-01-30', 12.00, '2026-01-30', 'pagata', 'carta', NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 12.00, '2026-01-30', 'carta', '[Import storico] Data di pagamento non specificata nel file (testo originale: "CARTA DI PAGAMENTO") — approssimata alla scadenza.' FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AIRLIQUIDE italia gas e servizi  Srl', '1107024750', '2025-12-31', 217.98, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 217.98, '2026-01-21', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ANNALISA GARAVENTA', '1', '2025-12-31', 3250.00, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 3250.00, '2026-05-11', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Cadenasso & C. Sas di Davide Cadenasso', '1374/2025', '2025-12-31', 20.19, '2026-01-31', 'da_pagare', NULL, '[Import storico] Nota originale colonna "data pagamento": "vedere loro mail resta da pagare € 210,95"');

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LAVALDIVARA S.R.L.', '18312', '2025-11-30', 772.08, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 772.08, '2026-04-09', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LIGURBONIFICHE', '763', '2025-12-31', 183.00, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 183.00, '2026-03-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LIGURBONIFICHE', '764', '2025-12-31', 183.00, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 183.00, '2026-03-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LIGURBONIFICHE', '765', '2025-12-31', 1220.00, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1220.00, '2026-03-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '15531', '2025-12-12', 79.97, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 79.97, '2026-01-31', NULL, '[Import storico] Data di pagamento non specificata nel file originale — approssimata alla scadenza.' FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MISECOOP COOPERATIVA SOCIALE', '57', '2026-01-31', 30.00, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 30.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Mondoffice S.r.l.', '9077', '2025-12-05', 197.42, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 197.42, '2026-02-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('RICCI GOMME SRL', '152262', '2025-12-30', 65.00, '2026-01-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 65.00, '2026-03-10', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ERREBI SPA', '1', '2026-01-02', 326.72, '2026-02-02', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('PROTEX MARKET', '22', '2026-02-03', 166.46, '2026-02-03', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 166.46, '2026-01-17', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('T4TECH S.R.L.', '20', '2026-01-05', 246.93, '2026-02-04', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 246.93, '2026-03-05', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '2', '2026-01-08', 17150.00, '2026-02-07', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Dott.GHIGLIONE TOMMASO', '3', '2026-02-09', 402.00, '2026-02-09', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 402.00, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '4230 febbraio', '2026-01-20', 1751.64, '2026-02-11', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1751.64, '2026-03-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ARCHE'' Studio Legale Arché Studio Legale', '17', '2026-02-13', 1361.36, '2026-02-13', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1361.36, '2026-05-11', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('DE CHIARA SRL', '501', '2026-02-13', 478.68, '2026-02-13', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 478.68, '2026-05-07', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AMG SRL GENOVA SESTRI', '7/137', '2026-02-16', 31.96, '2026-02-16', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('INAIL', '110030', '2025-12-05', 42.65, '2026-02-16', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MISECOOP COOPERATIVA SOCIALE', '113', '2026-02-17', 30.00, '2026-02-17', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 30.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MASTERFIRE 4.0 S.R.L.', '249', '2026-02-19', 820.20, '2026-02-19', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 820.20, '2026-05-07', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AIRLIQUIDE italia gas e servizi  Srl', '1107001936', '2026-01-31', 264.89, '2026-02-28', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ATTILIO TRUCCO', '189', '2026-02-28', 270.34, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 270.34, '2026-05-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ECO ERIDANIA S.P.A.', '9924', '2025-12-10', 255.04, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 255.04, '2026-06-17', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('FP SERVICE', '9', '2026-01-31', 835.21, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 835.21, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('GARAGE OFFICINA SILVA', '139', '2025-12-10', 3006.69, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 3006.69, '2026-03-12', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LAVALDIVARA S.R.L.', '18940', '2025-12-31', 253.66, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 253.66, '2026-04-09', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LIGURBONIFICHE', '10', '2026-01-31', 988.20, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 988.20, '2026-05-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Medical Stardust S.R.L. Unipersonale', '51', '2026-01-31', 1321.78, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1321.78, '2026-04-23', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('NAPOCAR DI NAPOLITANO VIAGGO', '50', '2026-02-28', 427.00, '2026-02-28', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('RICCI GOMME SRL', '0150115', '2026-01-31', 195.00, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 195.00, '2026-03-10', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('VOLPI SRL', '41/B', '2026-01-22', 1354.20, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1354.20, '2026-03-17', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ANNALISA GARAVENTA', '1', '2025-12-31', 3250.00, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 3250.00, '2026-05-11', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('NEXTBIT (1RATA)', '38', '2026-01-30', 443.46, '2026-02-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 443.46, '2026-05-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Maimel S.r.l.', '213', '2026-01-02', 929.64, '2026-03-03', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 929.64, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Maimel S.r.l.', '214', '2026-01-02', 929.64, '2026-03-03', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 929.64, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ALBERTENGO PANNETTONI SPA', '1213', '2026-03-04', 1421.64, '2026-03-04', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1421.64, '2026-03-05', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Akkad Wattar MBasel', '2', '2026-03-05', 802.00, '2026-03-05', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 802.00, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '14493 marzo', '2026-01-22', 1751.64, '2026-03-05', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1751.64, '2026-03-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Dott.GHIGLIONE TOMMASO', '6', '2026-03-05', 802.00, '2026-03-05', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 802.00, '2026-03-05', NULL, '[Import storico] Data di pagamento non specificata nel file originale — approssimata alla scadenza.' FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MISECOOP COOPERATIVA SOCIALE', '156', '2026-03-05', 30.00, '2026-03-05', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 30.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('T4TECH S.R.L.', '235', '2026-02-05', 254.58, '2026-03-07', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 254.58, '2026-03-24', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. BARI - GENNAIO 2026', NULL, NULL, 207.21, '2026-03-10', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 207.21, '2026-07-03', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. ISONZO - ANNUALE', '2026', NULL, 911.86, '2026-03-10', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 911.86, '2026-07-03', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. OLIVIERI - ANNUALE', '2026', NULL, 106.40, '2026-03-10', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 106.40, '2026-07-03', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('CARROZZERIA ROSATA', '59', '2026-03-13', 3400.01, '2026-03-13', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('CARROZZERIA ROSATA', '60', '2026-03-13', 2200.00, '2026-03-13', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '433', '2026-01-20', 128.91, '2026-03-20', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 128.91, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '434', '2026-01-20', 72.96, '2026-03-20', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 72.96, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '436', '2026-01-20', 146.58, '2026-03-20', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 146.58, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '450', '2026-01-20', 46.34, '2026-03-20', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 46.34, '2026-03-27', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAF DI MARIANI ALFREDO', '186', '2026-03-23', 390.40, '2026-03-23', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AVS SRL', '53', '2026-02-24', 283.04, '2026-03-24', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 283.04, '2026-06-13', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ACQUA SU MISURA', '61', '2026-01-27', 1441.13, '2026-03-27', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1441.13, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAESTRIPIERI', '986', '2026-01-30', 16.00, '2026-03-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 16.00, '2026-05-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MISECOOP COOPERATIVA SOCIALE', '212', '2026-03-30', 30.00, '2026-03-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 30.00, '2026-05-18', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AIRLIQUIDE italia gas e servizi  Srl', '4083', '2026-02-28', 371.85, '2026-03-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Cadenasso & C. Sas di Davide Cadenasso', '123', '2026-02-06', 56.64, '2026-03-31', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('F2 SRL', '240', '2026-02-28', 365.00, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 365.00, '2026-03-27', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('GARAGE OFFICINA SILVA', '9', '2026-01-24', 430.05, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 430.05, '2026-05-11', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('GARAGE OFFICINA SILVA', '10', '2026-01-24', 385.52, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 385.52, '2026-05-11', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LAVALDIVARA S.R.L.', '1/430', '2026-01-31', 632.40, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 632.40, '2026-04-09', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('SARTORIA SCHIAVI', '152', '2026-02-27', 846.72, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 846.72, '2026-05-07', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAMBU SRL', '511', '2026-03-31', 118.95, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 118.95, '2026-06-09', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ATTILIO TRUCCO', '326', '2026-03-31', 119.76, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 119.76, '2026-05-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('NEXTBIT (1 RATA)', '305', '2026-02-28', 274.50, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 274.50, '2026-05-25', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('NEXTBIT (2 RATA)', '38', '2026-01-30', 443.46, '2026-03-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 443.46, '2026-05-25', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DELTA VOICE SRL', '186', '2026-03-02', 780.12, '2026-04-02', 'da_pagare', 'RID', NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Akkad Wattar MBasel', '3', '2026-04-02', 1002.00, '2026-04-02', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1002.00, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('T4TECH S.R.L.', '403', '2026-03-05', 254.58, '2026-04-04', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 254.58, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. BARI - FEBBRAIO 2026', NULL, NULL, 207.21, '2026-04-04', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 207.21, '2026-07-03', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('RUGGERONE ALESSANDRA', '1', '2026-03-06', 246.84, '2026-04-05', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 246.84, '2026-05-04', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ASSISTENZA MORETTI SRL', '2732', '2026-04-07', 227.28, '2026-04-07', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MAF DI MARIANI ALFREDO', '235', '2026-04-07', 658.00, '2026-04-07', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 658.00, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '24222 aprile', '2026-03-17', 1751.64, '2026-04-09', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1751.64, '2026-06-10', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Daniela Del Duca', '7', '2026-05-05', 4487.08, '2026-04-09', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 4487.08, '2026-04-09', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('SULFARO ROSARIA SARA', '3', '2026-04-14', 102.00, '2026-04-14', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Mori Valentina', '264(PROF. 155)', '2026-04-14', 750.00, '2026-04-14', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 750.00, '2026-06-30', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('TARI - AMIU (Isonzo-Apparizione-Bari)', '1RATA', '2026-03-02', 1299.00, '2026-04-15', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('PESCI CLAUDIO', '2', '2026-04-15', 210.00, '2026-04-15', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Dott.GHIGLIONE TOMMASO', '9', '2026-04-16', 802.00, '2026-04-16', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 802.00, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Dott.GHIGLIONE TOMMASO', '10', '2026-04-16', 802.00, '2026-04-16', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 802.00, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('RAM APPARECCHI MEDICALI SRL', '593', '2026-04-16', 83.64, '2026-04-17', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 83.64, '2026-04-15', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('CENTRO  GOMME DI MONICA BRAVI & C.SNC', '41', '2026-04-18', 200.00, '2026-04-18', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 200.00, '2026-06-26', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('PREMIA SRL', '322', '2026-04-20', 63.20, '2026-04-20', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 63.20, '2026-07-21', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Maimel S.r.l.', '1336', '2026-02-20', 73.20, '2026-04-21', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 73.20, '2026-05-18', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '102', '2026-03-23', 17150.00, '2026-04-22', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('DELPINO SRL', '20349', '2026-04-23', 1840.00, '2026-04-23', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1840.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('DELPINO SRL', '20350', '2026-04-23', 5880.00, '2026-04-23', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 5880.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MASTERFIRE 4.0 S.R.L.', '501', '2026-04-23', 36.60, '2026-04-23', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 36.60, '2026-05-04', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MASTERFIRE 4.0 S.R.L.', '526', '2026-04-24', 103.70, '2026-04-24', 'da_pagare', NULL, '[Import storico] Nota originale colonna "data pagamento": "ABBIAMO CREDITO DI 236,68 PER FATT. 1153 PAGATA 2 VOLTE"');

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('RUGGERONE ALESSANDRA', '2', '2026-03-27', 328.44, '2026-04-26', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 328.44, '2026-05-04', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ECO ERIDANIA S.P.A.', '1686', '2026-02-20', 110.29, '2026-04-27', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 110.29, '2026-06-17', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ECO ERIDANIA S.P.A.', '1270', '2026-02-21', 561.20, '2026-04-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 561.20, '2026-06-17', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('MISECOOP COOPERATIVA SOCIALE', '302', '2026-04-28', 30.00, '2026-04-28', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 30.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ECO ERIDANIA S.P.A.', '1271', '2026-02-22', 1574.47, '2026-04-29', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1574.47, '2026-06-17', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '103', '2026-03-30', 69.30, '2026-04-29', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('FT SRL', '95.01', '2026-04-29', 6588.00, '2026-04-29', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 6588.00, '2026-04-28', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ECO ERIDANIA S.P.A.', '1272', '2026-02-23', 82.72, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 82.72, '2026-06-17', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('GARAGE OFFICINA SILVA', '21', '2026-02-21', 180.56, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 180.56, '2026-05-11', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('LAVALDIVARA S.R.L.', '1/852', '2026-02-28', 757.89, '2026-04-30', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('VOLPI SRL', '183', '2026-03-05', 658.80, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 658.80, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('DELPINO SRL', '20272', '2026-03-24', 580.00, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 580.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('DELPINO SRL', '20279', '2026-03-26', 850.00, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 850.00, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('SARTORIA SCHIAVI', '246', '2026-03-31', 1180.96, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1180.96, '2026-05-07', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AIRLIQUIDE italia gas e servizi  Srl', '1107006192', '2026-03-31', 154.75, '2026-04-30', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('LYRECO ITALIA SRL', '7955', '2026-03-31', 155.55, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 155.55, '2026-05-07', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('F2 SRL', '444', '2026-03-31', 1095.00, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1095.00, '2026-05-25', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('RICCI GOMME SRL', '357', '2026-03-31', 25.00, '2026-04-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IMQ S.P.A.', '11043', '2026-04-30', 65.79, '2026-04-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ATTILIO TRUCCO', '455', '2026-04-30', 318.10, '2026-04-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('NEXTBIT (2 RATA)', '305', '2026-02-28', 274.50, '2026-04-30', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. BARI-MARZO 2026', NULL, NULL, 207.21, '2026-04-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 207.21, '2026-07-03', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Akkad Wattar MBasel', '4', '2026-05-03', 642.00, '2026-05-03', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Dott.GHIGLIONE TOMMASO', '12', '2026-05-03', 802.00, '2026-05-03', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '36063 maggio', '2026-03-20', 1751.64, '2026-05-05', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1751.64, '2026-06-10', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('T4TECH S.R.L.', '575', '2026-04-07', 254.58, '2026-05-07', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 254.58, '2026-06-15', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '2821', '2026-03-10', 139.58, '2026-05-10', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '2833', '2026-03-10', 162.70, '2026-05-10', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '2835', '2026-03-10', 64.09, '2026-05-10', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '123', '2026-04-13', 17150.00, '2026-05-13', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('CENTRO  GOMME DI MONICA BRAVI & C.SNC', '65', '2026-05-13', 270.00, '2026-05-13', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 270.00, '2026-06-26', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DE CHIARA SRL', '1253', '2026-05-13', 421.51, '2026-05-13', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DELPINO SRL', '20415', '2026-05-14', 145.00, '2026-05-14', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('TARI - AMIU (Isonzo-Apparizione-Bari)', '2RATA', '2026-03-02', 1299.00, '2026-05-15', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA', '59', '2026-05-16', 1678.02, '2026-05-16', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1678.02, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA', '60', '2026-05-16', 1528.38, '2026-05-16', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1528.38, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA (NOVEMBRE 25)', '61', '2026-05-16', 1608.54, '2026-05-16', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1608.54, '2026-05-18', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA (DICEMBRE 25)', '62', '2026-05-16', 1528.38, '2026-05-16', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1528.38, '2026-05-18', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('EMAC SRL', '369', '2026-04-16', 1220.00, '2026-05-16', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '3164', '2026-03-18', 26.54, '2026-05-17', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('FT SRL', '108.01', '2026-05-18', 4392.00, '2026-05-18', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 4392.00, '2026-05-04', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('F.LLI VILLA SRL', '2171', '2026-05-18', 24.03, '2026-05-18', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. BARI - APRILE 2026', NULL, NULL, 207.21, '2026-05-20', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 207.21, '2026-07-03', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MEV DI CATROPPA VALERIA', '47', '2026-05-20', 317.20, '2026-05-20', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('CE.S.CO.T', '302', '2026-05-21', 878.40, '2026-05-21', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 878.40, '2026-05-18', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '155', '2026-04-23', 17150.00, '2026-05-23', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DENTAL LEADER SPA', '2267', '2026-05-25', 174.90, '2026-05-25', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('CARROZZERIA ROSATA', '135', '2026-05-26', 1800.00, '2026-05-26', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1800.00, '2026-06-01', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DENTAL LEADER SPA', '975', '2026-05-28', 2032.45, '2026-05-28', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ATTILIO TRUCCO', '568', '2026-05-30', 95.09, '2026-05-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('LAVALDIVARA S.R.L.', '1540', '2026-03-31', 244.02, '2026-05-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AIRLIQUIDE italia gas e servizi  Srl', '9040', '2026-04-30', 299.52, '2026-05-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Cadenasso & C. Sas di Davide Cadenasso', '436', '2026-04-30', 172.55, '2026-05-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Dott.GHIGLIONE TOMMASO', '15', '2026-05-31', 802.00, '2026-05-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('VENTURI MARCO', '17', '2026-05-31', 150.00, '2026-05-31', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA (CU 2025)', '73', '2026-06-01', 908.48, '2026-06-01', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 908.48, '2026-06-01', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA  (GENNAIO 26)', '74', '2026-06-01', 1688.70, '2026-06-01', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1688.70, '2026-06-01', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ASSOCIAZIONE DELLA CROCE ROSSA ITALIANA', '422', '2026-05-05', 470.00, '2026-06-04', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('RUGGERONE ALESSANDRA', '3', '2026-05-05', 450.84, '2026-06-04', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '4626 giugno', '2026-05-13', 1751.64, '2026-06-08', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('RAM APPARECCHI MEDICALI SRL', '393', '2026-06-08', 99.34, '2026-06-09', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 99.34, '2026-06-15', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. BARI - MAGGIO 2026', NULL, NULL, 207.21, '2026-06-09', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 207.21, '2026-07-03', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Akkad Wattar MBasel', '5', '2026-06-12', 802.00, '2026-06-12', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('TARI - AMIU (Isonzo-Apparizione-Bari)', '3RATA', '2026-03-02', 1299.00, '2026-06-15', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('ARCHE'' Studio Legale Arché Studio Legale', '59', '2026-06-15', 1146.77, '2026-06-15', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1146.77, '2026-07-21', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '234', '2026-06-15', 17150.00, '2026-06-15', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DELPINO SRL', '1210', '2026-06-16', 830.00, '2026-06-16', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MISECOOP COOPERATIVA SOCIALE', '485', '2026-06-17', 30.00, '2026-06-17', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AUTORIMESSA RATTO', '28', '2026-06-17', 122.00, '2026-06-17', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ASSISTENZA MORETTI SRL', '4282', '2026-06-18', 113.64, '2026-06-18', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('GARAGE OFFICINA SILVA', '41', '2026-04-21', 1695.68, '2026-06-20', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('FLUIDA', '4804', '2026-06-22', 34.37, '2026-06-22', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 34.37, '2026-06-22', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('AUTORIMESSA RATTO', '29', '2026-06-25', 160.00, '2026-06-25', 'pagata', 'carta', NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 160.00, '2026-06-25', 'carta', NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DELPINO SRL', '20552', '2026-06-19', 1689.00, '2026-06-25', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ROSSI ALESSANDRO', '91', '2026-06-11', 1484.00, '2026-06-26', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Mori Valentina', '260 (PROF. 240)', '2026-06-26', 260.00, '2026-06-26', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 260.00, '2026-06-26', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MISECOOP COOPERATIVA SOCIALE', '505', '2026-06-26', 30.00, '2026-06-26', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('CARROZZERIA ROSATA', '155', '2026-06-26', 1586.00, '2026-06-26', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ROSSI ALESSANDRO', '97', '2026-06-26', 2200.00, '2026-06-26', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AVS SRL', '138', '2026-05-27', 183.00, '2026-06-27', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '4880', '2026-04-29', 238.83, '2026-06-29', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '4882', '2026-04-29', 36.93, '2026-06-29', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '4883', '2026-04-29', 115.27, '2026-06-29', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '4884', '2026-04-29', 45.74, '2026-06-29', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ACQUA SU MISURA', '458', '2026-04-29', 1441.13, '2026-06-29', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MISECOOP COOPERATIVA SOCIALE', '508', '2026-06-29', 30.00, '2026-06-29', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('TFA & LEGAL STUDIO ASSOCIATO', '33', '2026-06-29', 13082.94, '2026-06-29', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 13082.94, '2026-06-26', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ECO ERIDANIA S.P.A.', '3351', '2026-04-20', 81.13, '2026-06-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '5077', '2026-04-30', 106.69, '2026-06-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('GARAGE OFFICINA SILVA', '46', '2026-04-29', 294.63, '2026-06-30', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('TARI - AMIU  (Peschiera-Sturla- Bottino)', '1 RATA', '2026-05-05', 718.00, '2026-06-30', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 718.00, '2026-06-30', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('VOLPI SRL', '450', '2026-05-22', 375.76, '2026-06-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AIRLIQUIDE italia gas e servizi  Srl', '654', '2026-05-31', 282.93, '2026-06-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Cadenasso & C. Sas di Davide Cadenasso', '550', '2026-05-29', 347.35, '2026-06-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MISECOOP COOPERATIVA SOCIALE', '513', '2026-06-30', 30.00, '2026-06-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ATTILIO TRUCCO', '686', '2026-06-30', 115.66, '2026-06-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('LAVALDIVARA S.R.L.', '2625', '2026-04-30', 572.07, '2026-06-30', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('GRENKE ITALIA S.P.A.', '660', '2026-06-24', 413.51, '2026-07-01', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 413.51, '2026-07-02', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DELTA VOICE SRL', '549', '2026-07-01', 780.12, '2026-07-01', 'da_pagare', 'RID', NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DELPINO SRL', '20595', '2026-07-02', 850.00, '2026-07-02', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('RUGGERONE ALESSANDRA', '4', '2026-06-03', 450.84, '2026-07-03', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('COMUNE DI GENOVA - AFFITTO V. BARI - GIUGNO 2026', NULL, NULL, 207.21, '2026-07-03', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 207.21, '2026-07-03', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('M.C.S. SRL', '577', '2026-06-05', 691.74, '2026-07-05', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('BELLINI MAURO', '32', '2026-07-05', 602.00, '2026-07-05', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '56616 luglio', '2026-06-15', 1751.64, '2026-07-06', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('T4TECH S.R.L.', '1121', '2026-07-06', 372.10, '2026-07-06', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('Mori Valentina', '265 (PROF. 191)', '2026-07-07', 918.00, '2026-07-07', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 918.00, '2026-06-30', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('CARROZZERIA ROSATA', '168', '2026-07-07', 915.00, '2026-07-07', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MISECOOP COOPERATIVA SOCIALE', '546', '2026-07-07', 30.00, '2026-07-07', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DELPINO SRL', '20611', '2026-07-07', 495.00, '2026-07-07', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('RAM APPARECCHI MEDICALI SRL', '5593', '2026-07-07', 60.00, '2026-07-07', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 60.00, '2026-07-07', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('DEL GIALLO ALESSIO', '5', '2026-07-08', 852.00, '2026-07-08', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Dott.GHIGLIONE TOMMASO', '19', '2026-07-09', 802.00, '2026-07-09', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('CENTRO  GOMME DI MONICA BRAVI & C.SNC', '92', '2026-07-10', 305.00, '2026-07-10', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('SULFARO ROSARIA SARA', '7', '2026-07-11', 550.00, '2026-07-11', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AKKAD WATTAR MBASEL', '6', '2026-07-14', 802.00, '2026-07-14', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('IL BISCIONE SCS', '271', '2026-07-14', 17150.00, '2026-07-14', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('TARI - AMIU (Isonzo-Apparizione-Bari)', '4RATA', '2026-03-02', 1296.00, '2026-07-15', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('M.C.S. SRL', '619', '2026-06-17', 203.74, '2026-07-17', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MEV DI CATROPPA VALERIA', '73', '2026-07-18', 732.00, '2026-07-18', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA', '90', '2026-07-21', 1865.06, '2026-07-21', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1865.06, '2026-07-21', NULL, NULL FROM f;

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('STUDIO PASTORINO MARZIA', '91', '2026-07-21', 1528.38, '2026-07-21', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 1528.38, '2026-07-21', NULL, NULL FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('CARROZZERIA ROSATA', '184', '2026-07-22', 951.60, '2026-07-22', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('RUGGERONE ALESSANDRA', '5', '2026-06-25', 654.84, '2026-07-25', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('TARI - AMIU  (Peschiera-Sturla- Bottino)', '2 RATA', '2026-05-05', 718.00, '2026-07-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('LAVALDIVARA S.R.L.', '3195', '2026-05-31', 157.94, '2026-07-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AIRLIQUIDE italia gas e servizi  Srl', '3065', '2026-06-30', 242.53, '2026-07-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Cadenasso & C. Sas di Davide Cadenasso', '721', '2026-06-30', 294.33, '2026-07-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ANNALISA GARAVENTA (I RATA ACCONTO)', '1', '2026-06-30', 1964.50, '2026-07-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('RICCI GOMME SRL', '1017', '2026-06-30', 290.00, '2026-07-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AZIENDA REGIONALE TERRITORIALE PER L''EDILIZIA', '66540', '2026-07-13', 1751.64, '2026-08-05', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('T4TECH S.R.L.', '1114', '2026-07-06', 254.58, '2026-08-05', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '7073', '2026-06-12', 229.90, '2026-08-12', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('AHMAD ISMAIL', '9', '2026-07-13', 800.00, '2026-08-13', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '7255', '2026-06-17', 44.14, '2026-08-17', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('TARI - AMIU  (Peschiera-Sturla- Bottino)', '3 RATA', '2026-05-05', 718.00, '2026-08-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Maimel S.r.l.', '3349', '2026-07-01', 929.64, '2026-08-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('Maimel S.r.l.', '3350', '2026-07-01', 929.64, '2026-08-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ALDERSOFT SAS', '195', '2026-06-15', 732.00, '2026-08-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('GARAGE OFFICINA SILVA', '56', '2026-06-13', 1894.05, '2026-08-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ECO ERIDANIA S.P.A.', '5063', '2026-06-20', 561.20, '2026-08-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ECO ERIDANIA S.P.A.', '5064', '2026-06-20', 205.20, '2026-08-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ANNALISA GARAVENTA (II RATA A SALDO)', '1', '2026-06-30', 1964.50, '2026-08-31', 'da_pagare', NULL, NULL);

WITH f AS (
  INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note)
  VALUES ('CROCE ROSSA COMITATO DI CARMAGNOLA', '688', '2026-07-13', 192.00, '2026-08-31', 'pagata', NULL, NULL)
  RETURNING id
)
INSERT INTO public.pagamenti (fattura_id, importo, data_pagamento, metodo, note)
SELECT id, 192.00, '2026-08-31', NULL, '[Import storico] Data di pagamento non specificata nel file originale — approssimata alla scadenza.' FROM f;

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('LAVALDIVARA S.R.L.', '4074', '2026-06-30', 94.86, '2026-08-31', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '8688', '2026-07-16', 212.26, '2026-09-16', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '8679', '2026-07-16', 45.29, '2026-09-16', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('MAESTRIPIERI', '8763', '2026-07-17', 123.00, '2026-09-17', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('ACQUA SU MISURA', '839', '2026-07-20', 1441.13, '2026-09-20', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('S.T.I. di Bruschi e Landò snc', '22', '2026-07-03', 2562.00, '2026-09-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('GARAGE OFFICINA SILVA', '71', '2026-07-11', 80.00, '2026-09-30', 'da_pagare', NULL, NULL);

INSERT INTO public.fatture (fornitore, numero_fattura, data_fattura, importo, scadenza, stato, metodo_pagamento, note) VALUES ('P.A. CROCE BLU CASTELLETTO', '1/003', '2026-07-09', 850.00, '2026-10-09', 'da_pagare', NULL, NULL);


-- ============================================================
--  NOTE DI CREDITO DA COLLEGARE A MANO (non importate automaticamente)
--  Il file Excel indicava solo fornitore e importo, non la fattura che
--  ciascuna nota storna: dove l'importo coincide con più fatture (o con
--  nessuna) collegarle a caso avrebbe rischiato di alterare stati/importi
--  reali. Aggiungile dall'app ("+ Nota di credito" in dashboard, o "+
--  Aggiungi nota di credito" nell'editor di una fattura) dopo aver
--  verificato a mano con il fornitore/i documenti originali a quale/i
--  fattura/e ciascuna si riferisce — una nota di credito può stornarne più
--  di una insieme, se è il caso.
-- ------------------------------------------------------------
--  Riga 56: MAESTRIPIERI — "NOTA CREDITO 254" — 79.97 € del 2026-01-14
--    Possibili fatture corrispondenti (stesso fornitore, stesso importo):
--      - riga 33 (n. 15531, 2025-12-12, stato PAGATA)
--
--  Riga 70: Dott.GHIGLIONE TOMMASO — "NOTA CREDITO 8" — 802.00 € del 2026-04-16
--    Possibili fatture corrispondenti (stesso fornitore, stesso importo):
--      - riga 7 (n. 1, 2026-01-11, stato PAGATA)
--      - riga 68 (n. 6, 2026-03-05, stato PAGATA)
--      - riga 112 (n. 9, 2026-04-16, stato PAGATA)
--      - riga 113 (n. 10, 2026-04-16, stato PAGATA)
--      - riga 147 (n. 12, 2026-05-03, stato DA PAGARE)
--      - riga 177 (n. 15, 2026-05-31, stato DA PAGARE)
--      - riga 238 (n. 19, 2026-07-09, stato DA PAGARE)
--
--  Riga 83: MAESTRIPIERI — "NOTA CREDITO 2061" — 20.91 € del 2026-02-26
--    Possibili fatture corrispondenti (stesso fornitore, stesso importo):
--      - nessuna fattura con lo stesso importo trovata nel file
--
--  Riga 104: MAF DI MARIANI ALFREDO — "n.c. 234" — 390.00 € del 2026-04-07
--    Possibili fatture corrispondenti (stesso fornitore, stesso importo):
--      - nessuna fattura con lo stesso importo trovata nel file
--
--  Riga 125: MAESTRIPIERI — "NOTA CREDITO 2464" — 22.30 € del 2026-02-27
--    Possibili fatture corrispondenti (stesso fornitore, stesso importo):
--      - nessuna fattura con lo stesso importo trovata nel file
--
--  Riga 184: MISECOOP COOPERATIVA SOCIALE — "NOTA DI CREDITO N. 3" — 42.70 € del 2026-06-17
--    Possibili fatture corrispondenti (stesso fornitore, stesso importo):
--      - nessuna fattura con lo stesso importo trovata nel file
-- ============================================================
