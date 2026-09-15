-- ============================================================
--  PATCH — La sezione ANALISI nel portale
--  Data: 2026-09-15
--
--  Aggiunge la sezione all'elenco di public.sezioni. Serve perché quella
--  tabella è la chiave esterna di public.autorizzazioni: senza questa
--  riga la card comparirebbe nella home, ma assegnare il permesso dalla
--  pagina "Utenti e autorizzazioni" fallirebbe con un errore di chiave
--  esterna. (Quella pagina avvisa da sé quando una sezione del menu non
--  esiste nel database: se vedi quell'avviso, è questa patch che manca.)
--
--  Nessuna tabella di dati, e con ogni probabilità non ne servirà: Analisi
--  è nata per LEGGERE quello che le altre sezioni scrivono — fatture,
--  trasporti, assistenze, corsi, ore — non per tenere dati propri. Se un
--  domani le servirà qualcosa di suo (una soglia, un obiettivo annuale),
--  arriverà con la patch che lo introduce, con le proprie policy RLS
--  basate su accede_a('analisi') come le altre.
--
--  ATTENZIONE, quando il contenuto arriverà: le policy delle altre sezioni
--  riservano i loro dati a chi ha QUELLA sezione. Il permesso 'analisi',
--  da solo, non apre nulla: chi deve vedere i numeri delle fatture dovrà
--  avere anche lo scadenziario, oppure quei numeri dovranno passare da
--  viste o funzioni `security definer` scritte apposta. È una decisione da
--  prendere allora, con il contenuto sotto gli occhi, non adesso.
--
--  È idempotente.
-- ============================================================

insert into public.sezioni (id, etichetta, ordine) values
  ('analisi', 'Analisi', 7)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;

-- ---------- DOPO L'ESECUZIONE ----------
-- Dal portale, "Utenti e autorizzazioni": assegna la sezione a chi deve
-- vederla. Finché non la assegni a nessuno la card resta bloccata per
-- tutti tranne che al super admin, che entra ovunque.

-- ---------- VERIFICA ----------
-- Devono comparire sette sezioni, con "analisi" in fondo.
select id, etichetta, ordine
  from public.sezioni
 order by ordine;
