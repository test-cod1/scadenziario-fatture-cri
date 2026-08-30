-- ============================================================
--  IMPORT FATTURE ATTIVE 2026 (da Excel 'Fatture_attive.xlsx')
-- ------------------------------------------------------------
--  Generato automaticamente da xlsx fornito dall'utente. Rivedi le note
--  '[Import fatture attive]' sulle singole fatture: segnalano i punti dove
--  il file originale era ambiguo o incompleto e si è dovuta fare un'assunzione.
--  Esegui DOPO patch-2026-08-30-fatture-attive.sql (richiede le tabelle
--  fatture_attive / incassi già presenti).
--  Fatture importate: 208. Escluse (vedi blocco commenti in fondo):
--  3 senza importo leggibile, 13 note di credito
--  (da collegare a mano dall'app). Consigliato un controllo a campione dopo l'import.
-- ============================================================

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 41', '276', '2026-01-02', 7812.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 276 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7812.00::numeric, '2026-01-28'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ASSOCIAZIONE CROCE ROSSA', '278', '2026-01-15', 1510.00, 'incassata', NULL, 'Centro di costo: AMBULATORIO · [Import fatture attive] rif. riga 278 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1510.00::numeric, '2026-01-20'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA  ATS35 CENTRO OVEST', '1', '2026-01-28', 7436.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 1 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7436.00::numeric, '2026-02-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 34 PRA''', '2', '2026-01-15', 279.27, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 2 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 279.27::numeric, '2026-02-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 34 PRA''', '3', '2026-01-15', 298.56, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 3 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 298.56::numeric, '2026-02-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 34 PRA''', '4', '2026-01-15', 298.56, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 4 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 298.56::numeric, '2026-02-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA DIREZIONE D''AREA ORGANI...', '5', '2026-01-16', 22600.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 5 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 22600.00::numeric, '2026-01-26'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('PORTO ANTICO', '6', '2026-01-19', 450.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SANITARIA/AUTOPARCO · [Import fatture attive] rif. riga 6 del file originale', '2026-06-17')
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 450.00::numeric, '2026-06-19'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ASSOCIAZIONE CROCE ROSSA', '7', '2026-01-20', 125.00, 'incassata', NULL, 'Centro di costo: AMBULATORIO · [Import fatture attive] rif. riga 7 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 125.00::numeric, '2026-01-28'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('INAIL DIREZIONE REGIONALE LIGURIA', '8', '2026-01-23', 2800.00, 'incassata', NULL, 'Centro di costo: GESTIONE GENERALE DELL''ENTE · [Import fatture attive] rif. riga 8 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2800.00::numeric, '2026-02-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE TEATRO CARLO FELICE', '9', '2026-01-28', 630.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 9 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 630.00::numeric, '2026-03-30'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '10', '2026-01-28', 80.00, 'incassata', NULL, 'Centro di costo: SBARCO MIGRANTI 118 · [Import fatture attive] rif. riga 10 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 80.00::numeric, '2026-02-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '12', '2026-01-29', 386.90, 'incassata', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 12 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 386.90::numeric, '2026-03-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '13', '2026-01-29', 2685.14, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 13 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2685.14::numeric, '2026-03-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '14', '2026-01-29', 3545.60, 'stornata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 14 del file originale · [Import fatture attive] fattura segnata stornata ma il file riporta anche un valore in PAGATA (datetime.datetime(2026, 3, 13, 0, 0)): non collegato, verificare a mano.', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '15', '2026-01-29', 183.90, 'stornata', NULL, 'Centro di costo: APPARIZIONE · [Import fatture attive] rif. riga 15 del file originale · [Import fatture attive] fattura segnata stornata ma il file riporta anche un valore in PAGATA (datetime.datetime(2026, 3, 13, 0, 0)): non collegato, verificare a mano.', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '16', '2026-01-29', 499.20, 'stornata', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 16 del file originale · [Import fatture attive] fattura segnata stornata ma il file riporta anche un valore in PAGATA (datetime.datetime(2026, 3, 13, 0, 0)): non collegato, verificare a mano.', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '17', '2026-01-29', 2632.58, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 17 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2632.58::numeric, '2026-03-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '18', '2026-01-29', 175.10, 'incassata', NULL, 'Centro di costo: APPARIZIONE · [Import fatture attive] rif. riga 18 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 175.10::numeric, '2026-03-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '19', '2026-01-29', 2650.60, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 19 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2650.60::numeric, '2026-03-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '20', '2026-01-29', 1918.30, 'incassata', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 20 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1918.30::numeric, '2026-03-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '21', '2026-01-30', 16466.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 21 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 16466.00::numeric, '2026-03-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '22', '2026-02-02', 14288.50, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 22 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 14288.50::numeric, '2026-03-06'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '23', '2026-02-02', 15828.90, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 23 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 15828.90::numeric, '2026-03-06'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '24', '2026-02-02', 12636.15, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 24 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 12636.15::numeric, '2026-03-06'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('YACHT CLUB ITALIANO', '25', '2026-02-02', 1100.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SANITARIA/AUTOPARCO · [Import fatture attive] rif. riga 25 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1100.00::numeric, '2026-03-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO GIANNINA GASLINI', '27', '2026-02-06', 1135.75, 'incassata', NULL, 'Centro di costo: FORNITURA SANGUE · [Import fatture attive] rif. riga 27 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1135.75::numeric, '2026-03-09'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO GIANNINA GASLINI', '28', '2026-02-06', 264.00, 'incassata', NULL, 'Centro di costo: FORNITURA SANGUE · [Import fatture attive] rif. riga 28 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 264.00::numeric, '2026-03-09'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '29', '2026-02-19', 110.00, 'incassata', NULL, 'Centro di costo: SBARCO MIGRANTI 118 · [Import fatture attive] rif. riga 29 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 110.00::numeric, '2026-02-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '30', '2026-02-20', 110.00, 'incassata', NULL, 'Centro di costo: SBARCO MIGRANTI 118 · [Import fatture attive] rif. riga 30 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 110.00::numeric, '2026-02-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AD INTERNATIONAL ASSISTANCE SRL', '34', '2026-02-20', 60.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 34 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 60.00::numeric, '2026-05-29'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '35', '2026-02-23', 17119.05, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 35 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 17119.05::numeric, '2026-04-21'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO GIANNINA GASLINI', '36', '2026-02-23', 118.25, 'incassata', NULL, 'Centro di costo: GENERALE/FORNITURA SANGUE · [Import fatture attive] rif. riga 36 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 118.25::numeric, '2026-03-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('DON GIUSEPPE MONTICELLI SOCIETA'' COOPERATIVA SOCIALE', '37', '2026-02-24', 347.50, 'incassata', NULL, 'Centro di costo: AMBULATORIO · [Import fatture attive] rif. riga 37 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 347.50::numeric, '2026-03-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '38', '2026-02-26', 197.20, 'incassata', NULL, 'Centro di costo: APPARIZIONE · [Import fatture attive] rif. riga 38 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 197.20::numeric, '2026-04-21'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '39', '2026-03-03', 4078.60, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 39 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 4078.60::numeric, '2026-04-21'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '40', '2026-03-03', 124.95, 'incassata', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 40 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 124.95::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '41', '2026-03-04', 30.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 41 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 30.00::numeric, '2026-03-20'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '42', '2026-03-05', 140.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 42 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 140.00::numeric, '2026-03-20'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 41', '43', '2026-03-05', 7696.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 43 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7696.00::numeric, '2026-03-24'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 35 CENTRO OVEST', '44', '2026-03-05', 7592.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 44 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7592.00::numeric, '2026-04-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 41', '45', '2026-03-05', 7852.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 45 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7852.00::numeric, '2026-04-08'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '46', '2026-03-06', 40.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 46 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 40.00::numeric, '2026-03-20'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ISTITUTO COMPRENSIVO DI BORZOLI', '47', '2026-03-10', 829.60, 'stornata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 47 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO COMPRENSIVO DI BORZOLI', '49', '2026-03-12', 829.60, 'incassata_parziale', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] importo riportato nel file come ''splitpay 680€  (829,6€)'': totale 829.60€, di cui 680.00€ già incassati a parte. · [Import fatture attive] rif. riga 49 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 680.00::numeric, '2026-03-17'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('MONT-ELE SRL', '50', '2026-03-12', 120.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 50 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 120.00::numeric, '2026-02-24'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('YACHT CLUB ITALIANO', '52', '2026-03-13', 730.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SANITARIA/AUTOPARCO · [Import fatture attive] rif. riga 52 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 730.00::numeric, '2026-06-05'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 47', '53', '2026-03-13', 12090.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 53 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 12090.00::numeric, '2026-04-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COMUNE DI GENOVA ATS 41', '54', '2026-03-13', 7852.00, 'stornata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 54 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ANPAS COMITATO REGIONALE LIGURIA', '55', '2026-03-19', 2156.20, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 55 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2156.20::numeric, '2026-03-31'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO FIGLIE DEL DIVINO ZELO', '56', '2026-03-19', 244.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 56 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 244.00::numeric, '2026-03-31'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO GIANNINA GASLINI', '57', '2026-03-19', 244.75, 'incassata', NULL, 'Centro di costo: GENERALE/FORNITURA SANGUE · [Import fatture attive] rif. riga 57 del file originale', '2026-06-22')
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 244.75::numeric, '2026-06-24'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '58', '2026-03-20', 2671.65, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 58 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2671.65::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '59', '2026-03-20', 16435.40, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 59 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 16435.40::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('GAVA I.F.C. SPA', '60', '2026-03-23', 260.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 60 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 260.00::numeric, '2026-04-22'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ERREBI SPA', '61', '2026-03-23', 219.60, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 61 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 219.60::numeric, '2026-05-21'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FULGENS ITALIA SRL', '62', '2026-03-23', 158.60, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 62 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 158.60::numeric, '2026-04-02'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AXIA FORMAZIONE CONSULENZA', '63', '2026-03-23', 180.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 63 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 180.00::numeric, '2026-04-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE TEATRO CARLO FELICE', '64', '2026-03-24', 270.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 64 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 270.00::numeric, '2026-04-14'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE TEATRO CARLO FELICE', '65', '2026-03-24', 450.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 65 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 450.00::numeric, '2026-04-14'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('GENOA BIKE ASD', '66', '2026-03-24', 280.00, 'da_incassare', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 66 del file originale', '2026-06-26');

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FEDERAZIONE CICLISTICA ITALIANA', '67', '2026-03-24', 230.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 67 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 230.00::numeric, '2026-04-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('YACHT CLUB ITALIANO', '68', '2026-03-24', 1100.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 68 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1100.00::numeric, '2026-06-05'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FEDERAZIONE COLDIRETTI LIGURIA', '69', '2026-03-24', 300.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 69 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 300.00::numeric, '2026-08-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '70', '2026-03-26', 467.80, 'incassata', NULL, 'Centro di costo: APPARIZIONE · [Import fatture attive] rif. riga 70 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 467.80::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '71', '2026-03-26', 1254.00, 'incassata', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 71 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1254.00::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '72', '2026-03-27', 5404.85, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 72 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 5404.85::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '73', '2026-03-30', 15765.55, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 73 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 15765.55::numeric, '2026-04-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('PAOLA DILEO', '74', '2026-03-30', 50.00, 'incassata', 'contanti', 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 74 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 50.00::numeric, '2026-03-24'::date, 'contanti'::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('MUGNANI SIMONE', '75', '2026-03-30', 50.00, 'incassata', 'bonifico', 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 75 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 50.00::numeric, '2026-03-24'::date, 'bonifico'::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('CAMERA RICCARDO', '76', '2026-03-30', 50.00, 'incassata', 'contanti', 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 76 del file originale · [Import fatture attive] anno 2027 nel file (probabile refuso per 2026): ''PAG.CONTANTI 24/03/2027''', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 50.00::numeric, '2027-03-24'::date, 'contanti'::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AMATO FABRIZIO', '77', '2026-03-31', 268.40, 'incassata', 'bonifico', 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 77 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 268.40::numeric, '2026-03-30'::date, 'bonifico'::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AD INTERNATIONAL ASSISTANCE SRL', '78', '2026-04-01', 700.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 78 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 700.00::numeric, '2026-05-29'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCERA', '79', '2026-04-02', 7176.00, 'stornata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 79 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 47 IV MEDIA VALBISAGNO', '80', '2026-04-02', 10894.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 80 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 10894.00::numeric, '2026-04-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ASD FREERIDETIGULLIO', '81', '2026-04-07', 1550.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 81 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1550.00::numeric, '2026-04-10'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('RONDASERVICE SRL', '82', '2026-04-07', 85.40, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 82 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 85.40::numeric, '2026-04-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('SEDAPTA SRL', '83', '2026-04-07', 195.20, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 83 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 195.20::numeric, '2026-05-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '84', '2026-04-07', 80.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 84 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 80.00::numeric, '2026-04-22'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '85', '2026-04-07', 30.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 85 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 30.00::numeric, '2026-04-22'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ONLUS', '86', '2026-04-07', 60.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 86 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 60.00::numeric, '2026-04-22'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COLLEGIO PROVINCIALE DEI GEOMETRI', '87', '2026-04-10', 50.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 87 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 50.00::numeric, '2026-04-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 35 CENTRO OVEST', '88', '2026-04-10', 3770.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 88 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3770.00::numeric, '2026-05-12'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '89', '2026-04-13', 2731.65, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 89 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2731.65::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA UCST', '90', '2026-04-13', 1287.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 90 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1287.00::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 41', '92', '2026-04-13', 7176.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 92 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7176.00::numeric, '2026-04-23'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 41', '94', '2026-04-14', 7852.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 94 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7852.00::numeric, '2026-04-23'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('RECRYTERA SRL', '95', '2026-04-16', 400.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SANITARIA/AUTOPARCO · [Import fatture attive] rif. riga 95 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 400.00::numeric, '2026-06-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ASD FREERIDETIGULLIO', '96', '2026-04-17', 210.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 96 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 210.00::numeric, '2026-04-22'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO GIANNINA GASLINI', '98', NULL, 228.25, 'incassata', NULL, 'Centro di costo: GENERALE/FORNITURA SANGUE · [Import fatture attive] rif. riga 98 del file originale', '2026-06-22')
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 228.25::numeric, '2026-06-24'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 47', '99', '2026-04-17', 12038.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 99 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 12038.00::numeric, '2026-05-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA UCST', '100', '2026-04-20', 3991.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 100 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3991.00::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '102', '2026-04-23', 3443.30, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 102 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3443.30::numeric, '2026-05-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('IDEALSERVICE SOC COOP', '103', '2026-04-27', 360.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 103 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 360.00::numeric, '2026-05-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '104', '2026-04-27', 646.80, 'incassata', NULL, 'Centro di costo: APPARIZIONE · [Import fatture attive] rif. riga 104 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 646.80::numeric, '2026-06-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '105', '2026-04-27', 5431.95, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 105 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 5431.95::numeric, '2026-06-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '106', '2026-04-27', 800.20, 'incassata', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 106 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 800.20::numeric, '2026-06-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AD INTERNATIONAL ASSISTANCE SRL', '107', '2026-04-29', 600.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 107 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 600.00::numeric, '2026-05-29'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA', '108', '2026-04-29', 7956.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 108 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 7956.00::numeric, '2026-05-20'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '109', '2026-04-30', 16341.00, 'stornata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 109 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ETS', '110', '2026-05-05', 55.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 110 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 55.00::numeric, '2026-06-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ETS', '111', '2026-05-05', 30.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 111 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 30.00::numeric, '2026-06-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ETS', '112', '2026-05-05', 30.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 112 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 30.00::numeric, '2026-06-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ETS', '113', '2026-05-05', 30.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 113 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 30.00::numeric, '2026-06-11'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA UCST', '115', '2026-05-07', 3822.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 115 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3822.00::numeric, '2026-05-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('DUETORRIHOTELS SPA', '116', '2026-05-08', 1171.20, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 116 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1171.20::numeric, '2026-06-22'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('MATTEO MARZI', '117', '2026-05-08', 35.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 117 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 35.00::numeric, '2026-05-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('POWER TRUCK SRL', '118', '2026-05-08', 270.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SANITARIA · [Import fatture attive] rif. riga 118 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 270.00::numeric, '2026-05-13'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COOPERATIVA SAN CARLO ONLUS SCS', '119', '2026-05-12', 45.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 119 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE TEATRO CARLO FELICE', '120', '2026-05-08', 540.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 120 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 540.00::numeric, '2026-06-03'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ALLIANCE MEDICAL DIAGNOSTIC SRL', '121', '2026-05-08', 540.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 121 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 540.00::numeric, '2026-06-08'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('LICEO ARTISTICO STATALE P. KLEE', '122', '2026-05-12', 1110.20, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 122 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1110.20::numeric, '2026-05-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('LICEO ARTISTICO STATALE P. KLEE', '123', '2026-05-12', 134.20, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 123 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 134.20::numeric, '2026-05-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ASD PODISTICA PERALTO GENOVA', '124', '2026-05-13', 2000.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 124 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 2000.00::numeric, '2026-05-28'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '125', '2026-05-15', 14501.30, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 125 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 14501.30::numeric, '2026-06-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COOPERATIVA SAN CARLO ONLUS SCS', '126', '2026-05-15', 50.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 126 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 47 IV MEDIA VALBISAGNO', '127', '2026-05-18', 11440.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 127 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 11440.00::numeric, '2026-06-03'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('LIGURIA PRIDE ODV', '128', '2026-05-18', 230.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 128 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 230.00::numeric, '2026-05-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('SECURITYPROJECT S.R.L', '130', '2026-05-20', 402.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 130 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 402.00::numeric, '2026-05-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('T.MARIOTTI SPA', '131', '2026-05-21', 30.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 131 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 30.00::numeric, '2026-03-26'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '133', '2026-05-26', 16341.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 133 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 16341.00::numeric, '2026-07-17'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('IL LABORATORIO SOCIETA'' COOPERATIVA SOCIALE', '134', '2026-05-26', 750.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SANITARIA · [Import fatture attive] rif. riga 134 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 750.00::numeric, '2026-07-01'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE TEATRO CARLO FELICE', '135', '2026-05-26', 90.00, 'incassata', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 135 del file originale · [Import fatture attive] valore PAGATA illeggibile nel file: ''23/0&/2026'' · [Import fatture attive] data di incasso non specificata nel file — approssimata alla scadenza/data fattura.', '2026-06-18')
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 90.00::numeric, '2026-05-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COOPERATIVA SAN CARLO ONLUS SCS', '136', '2026-05-26', 40.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 136 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COOPERATIVA SAN CARLO ONLUS SCS', '137', '2026-05-26', 45.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 137 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '138', '2026-05-26', 3360.30, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 138 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3360.30::numeric, '2026-06-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '139', '2026-05-26', 443.65, 'incassata', NULL, 'Centro di costo: APPARIZIONE · [Import fatture attive] rif. riga 139 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 443.65::numeric, '2026-07-17'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '140', '2026-05-26', 4632.30, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 140 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 4632.30::numeric, '2026-07-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '141', '2026-05-26', 1407.80, 'incassata', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 141 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 1407.80::numeric, '2026-07-19'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '142', '2026-05-28', 15245.35, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 142 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 15245.35::numeric, '2026-07-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('HR TRAINING SRL', '145', '2026-06-04', 244.00, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] valore SOLLECITO PAG illeggibile nel file: ''?'' — non importato. · [Import fatture attive] rif. riga 145 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 35 CENTRO OVEST', '147', '2026-06-09', 3900.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 147 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3900.00::numeric, '2026-07-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ETS', '148', '2026-06-09', 30.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 148 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 30.00::numeric, '2026-07-08'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FONDAZIONE L''ANCORA ETS', '149', '2026-06-09', 40.00, 'incassata', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 149 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 40.00::numeric, '2026-07-08'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ISTITUTO GIANNINA GASLINI', '150', '2026-06-15', 140.25, 'da_incassare', NULL, 'Centro di costo: GENERALE/FORNITURA SANGUE · [Import fatture attive] rif. riga 150 del file originale', '2026-06-22');

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('MEDLOG HOLDING ITALIA SRL', '151', '2026-06-15', 268.40, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 151 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('TREKKING ITALIA APS', '152', '2026-06-15', 134.20, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 152 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 134.20::numeric, '2026-06-18'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('THE SWATCH GROUP ITALIA SPA', '153', '2026-06-15', 91.50, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 153 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 91.50::numeric, '2026-06-15'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA UCST', '154', '2026-06-17', 39.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 154 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 39.00::numeric, '2026-07-14'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA UCST', '155', '2026-06-17', 4017.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 155 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 4017.00::numeric, '2026-07-14'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('PETERCOM S.R.L.', '156', '2026-06-18', 240.00, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 156 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ISTITUTO GIANNINA GASLINI', '157', '2026-06-22', 275.00, 'da_incassare', NULL, 'Centro di costo: GENERALE/FORNITURA SANGUE · [Import fatture attive] rif. riga 157 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('CAORSI ALLESANDRO', '158', '2026-06-22', 60.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 158 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 60.00::numeric, '2026-05-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('THE GREEN SCHOOL', '159', '2026-06-23', 109.80, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 159 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('BRICOMAN ITALIA SRL', '160', '2026-06-23', 1189.50, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] valore SOLLECITO PAG illeggibile nel file: ''?'' — non importato. · [Import fatture attive] rif. riga 160 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('BIOMEDICAL SPA', '161', '2026-06-23', 300.00, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 161 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('SEDAPTA SRL', '162', '2026-06-23', 158.60, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 162 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 158.60::numeric, '2026-08-06'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ISTITUTO COMPRENSIVO RIVAROLO', '163', '2026-06-23', 768.60, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 163 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 768.60::numeric, '2026-07-03'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('SPORTEVENTI SSDRL', '164', '2026-06-23', 900.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 164 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 900.00::numeric, '2026-06-25'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('MICHAEL REPETTO', '165', '2026-06-23', 134.20, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 165 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 134.20::numeric, '2026-07-14'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '166', '2026-06-25', 3438.25, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 166 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3438.25::numeric, '2026-07-20'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '167', '2026-06-25', 14308.30, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 167 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('THE GREEN SCHOOL', '168', '2026-06-25', 110.00, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 168 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '169', '2026-06-25', 6718.45, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 169 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '170', '2026-06-25', 2254.45, 'da_incassare', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 170 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('LIGURIA PRIDE ODV', '171', '2026-06-29', 750.00, 'da_incassare', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 171 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '172', '2026-06-30', 40.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 172 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '173', '2026-06-30', 40.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 173 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '174', '2026-06-30', 40.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 174 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '175', '2026-06-30', 70.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 175 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '176', '2026-06-30', 45.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 176 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '177', '2026-06-30', 45.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 177 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '178', '2026-06-30', 45.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 178 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '179', '2026-06-30', 45.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 179 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('cooperativa SAN CARLO ONLUS SCS', '180', '2026-06-30', 35.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 180 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '181', '2026-07-01', 451.70, 'da_incassare', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 181 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('PORTO ANTICO DI GENOVA', '182', '2026-07-06', 14190.00, 'da_incassare', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 182 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('F.M.A ROMA SRL (REDBULL SERRO ABAJO)', '183', '2026-07-06', 12930.00, 'da_incassare', NULL, 'Centro di costo: ASSISTENZA SPETTACOLI · [Import fatture attive] rif. riga 183 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('ARPAL', '184', '2026-07-06', 800.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 184 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 800.00::numeric, '2026-07-20'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('FONDAZIONE L''ANCORA', '185', '2026-07-07', 70.00, 'da_incassare', NULL, 'Centro di costo: CRI SOL/ASSISTENZA SANITARIA MIGRANTI · [Import fatture attive] rif. riga 185 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('STORAGE WORLD ITALIA S.R.L', '186', '2026-07-07', 225.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 186 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 225.00::numeric, '2026-07-30'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('SKILLSUP S.R.L', '187', '2026-07-08', 900.00, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 187 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('UNIVERSITA'' DI GENOVA FARMACIA', '188', '2026-07-08', 3300.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 188 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3300.00::numeric, '2026-08-04'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COOPSSE SOC. COOP. SOCIALE ONLUS', '189', '2026-07-08', 244.00, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 189 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('LA COMUNITA''-SOCIETA'' COOPERATIVA SOCIALE', '190', '2026-07-08', 1006.50, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 190 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AD INTERNATIONAL ASSISTANCE SRL', '191', '2026-07-09', 630.00, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 191 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA UCST', '192', '2026-07-09', 3874.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 192 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3874.00::numeric, '2026-07-31'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('FRANCISCO JOSE'' MARTINEZ CIVICO', '193', '2026-07-07', 5500.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 193 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 5500.00::numeric, '2026-07-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 47 IV MEDIA VALBISAGNO', '194', '2026-07-10', 11596.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 194 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 11596.00::numeric, '2026-07-31'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 47 IV MEDIA VALBISAGNO', '195', '2026-07-20', 12090.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 195 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 12090.00::numeric, '2026-08-05'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 35 CENTRO OVEST', '196', '2026-07-20', 4004.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 196 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 4004.00::numeric, '2026-08-05'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('COMUNE DI GENOVA ATS 35 CENTRO OVEST', '197', '2026-07-20', 3900.00, 'incassata', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 197 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 3900.00::numeric, '2026-08-05'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA', '198', '2026-07-20', 7852.00, 'da_incassare', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 198 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '199', '2026-07-20', 15068.90, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 199 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AXIA FORMAZIONE CONSULENZA', '200', '2026-07-20', 270.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 200 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 270.00::numeric, '2026-08-04'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AXIA FORMAZIONE CONSULENZA', '201', '2026-07-21', 540.00, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 201 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 540.00::numeric, '2026-08-04'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '202', '2026-07-21', 2679.90, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 202 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA', '203', '2026-07-22', 7696.00, 'da_incassare', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 203 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('E.D.T. SRL', '204', '2026-07-22', 770.00, 'incassata', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 204 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 770.00::numeric, '2026-07-27'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COMITATO GENOVA 2026 A.S.D.', '205', '2026-07-22', 770.00, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 205 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ANPAS COMITATO REGIONALE LIGURIA', '206', '2026-07-22', 950.00, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 206 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ANPAS COMITATO REGIONALE LIGURIA', '207', '2026-07-22', 105.00, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 207 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ISTITUTO GIANNINA GASLINI', '208', '2026-07-23', 225.00, 'da_incassare', NULL, 'Centro di costo: GENERALE/FORNITURA SANGUE · [Import fatture attive] rif. riga 208 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '209', '2026-07-24', 5975.95, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 209 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '210', '2026-07-24', 2196.30, 'da_incassare', NULL, 'Centro di costo: STURLA · [Import fatture attive] rif. riga 210 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '211', '2026-07-24', 211.00, 'da_incassare', NULL, 'Centro di costo: APPARIZIONE · [Import fatture attive] rif. riga 211 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '212', '2026-07-28', 15871.70, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 212 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '213', '2026-07-28', 16657.55, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 213 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '214', '2026-07-28', 14912.70, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 214 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03)', '215', '2026-07-28', 14767.75, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 215 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AD INTERNATIONAL ASSISTANCE SRL', '216', '2026-07-31', 550.00, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 216 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA', '218', '2026-08-04', 7488.00, 'da_incassare', NULL, 'Centro di costo: SOS BAMBINO · [Import fatture attive] rif. riga 218 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('ERGO-FORM SRL', '219', '2026-08-05', 250.00, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 219 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('AZIENDA OSPEDALIERA SAN MARTINO', '220', '2026-08-07', 2608.65, 'da_incassare', NULL, 'Centro di costo: AUTOPARCO · [Import fatture attive] rif. riga 220 del file originale', NULL);

INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
VALUES ('PSA GENOVA PRA'' S.P.A.', '221', '2026-08-10', 158.60, 'da_incassare', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 221 del file originale', NULL);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AGRITURISMO PRIANO', '222', '2026-08-10', 634.40, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 222 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 634.40::numeric, '2026-08-10'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('AXL SPA-AGENZIA PER IL LAVORO', '223', '2026-08-10', 134.20, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 223 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 134.20::numeric, '2026-08-07'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

WITH f AS (
  INSERT INTO public.fatture_attive (cliente, numero_fattura, data_fattura, importo, stato, metodo_incasso, note, data_sollecito)
  VALUES ('PERRIS STORE S.R.L.', '224', '2026-08-10', 91.50, 'incassata', NULL, 'Centro di costo: FORMAZIONE · [Import fatture attive] rif. riga 224 del file originale', NULL)
  RETURNING id
)
INSERT INTO public.incassi (fattura_attiva_id, importo, data_incasso, metodo, note)
SELECT id, v.* FROM f, (SELECT 91.50::numeric, '2026-08-05'::date, NULL::text, NULL::text) AS v(importo, data_incasso, metodo, note);

-- ============================================================
--  NON IMPORTATE — da inserire/collegare A MANO dall'app:
-- ============================================================
--
--  3 righe senza importo leggibile nel file:
--   riga 93 · COMUNE DI GENOVA ATS 41 · centro di costo: SOS BAMBINO · data emissione: 2026-04-14
--   riga 143 · ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03) · centro di costo: AUTOPARCO · data emissione: 2026-05-28
--   riga 144 · COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA · centro di costo: SOS BAMBINO · data emissione: 2026-06-03
--
--  13 note di credito emesse (nessun numero fattura nel file per collegarle in automatico):
--   riga 11 · FULLY S.R.L · 2026-01-29 · STORNO TOTALE FATT. N. 186 DEL 25/07/25
--   riga 26 · LA COMUNITA'-SOCIETA' COOPERATIVA SOCIALE · 2026-02-03 · STORNO TOTALE Fatt.n.189 DEL 25/07/2025
--   riga 31 · AZIENDA OSPEDALIERA SAN MARTINO · 2026-02-20 · STORNO TOT FATT n 14.
--   riga 32 · AZIENDA OSPEDALIERA SAN MARTINO · 2026-02-20 · STORNO TOT FATT n.16
--   riga 33 · AZIENDA OSPEDALIERA SAN MARTINO · 2026-02-20 · STORNO TOT FATT n.15
--   riga 48 · ISTITUTO COMPRENSIVO DI BORZOLI · 2026-03-12 · STORNO TOT. Fatt. 47
--   riga 91 · COMUNE DI GENOVA ATS 41 · 2026-04-13 · SOS BAMBINO
--   riga 101 · COMUNE DI GENOVA ATS 41 · ? · 
--   riga 114 · COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA · ? · 
--   riga 129 · S.T.S. SRLS · 2026-05-20 · FORMAZIONE
--   riga 132 · AZIENDA OSPEDALIERA SAN MARTINO · 2026-05-25 · AUTOPARCO
--   riga 146 · ATSL AZIENDA TUTELA SALUTE LIGURIA (ASL 03) · 2026-06-08 · AUTOPARCO
--   riga 217 · COMUNE DI GENOVA ATS 41 V MUNICIPIO VALPOLCEVERA · 2026-08-04 · SOS BAMBINO
