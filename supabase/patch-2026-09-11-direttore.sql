-- ============================================================
--  PATCH — La sezione DIRETTORE nel portale
--  Data: 2026-09-11
--
--  Aggiunge la sezione all'elenco di public.sezioni. Serve perché quella
--  tabella è la chiave esterna di public.autorizzazioni: senza questa
--  riga la card comparirebbe nella home, ma assegnare il permesso dalla
--  pagina "Utenti e autorizzazioni" fallirebbe con un errore di chiave
--  esterna. (Da oggi quella pagina avvisa da sé quando una sezione del
--  menu non esiste nel database: se vedi quell'avviso, è questa patch che
--  manca.)
--
--  Nessuna tabella di dati: la sezione è ancora un segnaposto e il
--  portale le serve la pagina "in costruzione". Quando avrà un contenuto,
--  le sue tabelle arriveranno con la patch che lo introduce, con le
--  proprie policy RLS basate su accede_a('direttore') — come le altre.
--
--  È idempotente.
-- ============================================================

insert into public.sezioni (id, etichetta, ordine) values
  ('direttore', 'Direttore', 6)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;

-- ---------- DOPO L'ESECUZIONE ----------
-- Dal portale, "Utenti e autorizzazioni": assegna la sezione a chi deve
-- vederla. Finché non la assegni a nessuno la card resta invisibile a
-- tutti tranne che al super admin, che entra ovunque.

-- ---------- VERIFICA ----------
-- Devono comparire sei sezioni, con "direttore" in fondo.
select id, etichetta, ordine
  from public.sezioni
 order by ordine;
