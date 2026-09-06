-- ============================================================
--  PATCH — Sezione FORMAZIONE ESTERNA (generatore di preventivi)
--  Da eseguire nell'SQL Editor di Supabase del portale, dopo
--  patch-2026-09-01-portale.sql.
--
--  Tre tabelle, con la stessa forma già usata dalle assistenze sanitarie: i
--  preventivi, la rubrica dei committenti e un'unica riga di impostazioni
--  (catalogo dei corsi e testi fissi del documento).
--
--  La riga della sezione in public.sezioni esiste già dal patch del portale
--  ('formazione', 'Formazione Esterna'): qui non va rifatta.
-- ============================================================

create table if not exists public.preventivi_formazione (
  id uuid primary key default gen_random_uuid(),

  -- Destinatario e referente: finiscono nell'intestazione del documento
  -- ("Spett.le …" e "Alla c.a. …").
  cliente text,
  cliente_indirizzo text,
  cliente_cf text,
  referente text,
  referente_email text,
  referente_telefono text,

  -- Il protocollo lo scrive chi prepara il documento, quando serve: non è
  -- un contatore automatico, perché la numerazione la tiene il registro di
  -- protocollo del Comitato e non questa app.
  protocollo text,
  oggetto text,
  data_documento date,

  stato text not null default 'bozza' check (stato in ('bozza','inviato','confermato','annullato')),

  -- I corsi proposti in QUESTO preventivo, copiati dal catalogo con i valori
  -- del momento:
  --   [{id, nome, durata, attestato, sigla, discenti, listino, prezzo}]
  -- Sono una copia, non un riferimento alle impostazioni: se domani il
  -- prezzo di listino cambia, un preventivo gia' mandato al cliente deve
  -- continuare a mostrare il prezzo con cui e' stato fatto. 'listino' e'
  -- il prezzo pieno, 'prezzo' quello riservato al cliente: nel documento il
  -- listino compare solo dove e' piu' alto.
  righe jsonb not null default '[]'::jsonb,

  -- Dove si tiene il corso. 'cliente' e' l'unico caso in cui la
  -- maggiorazione di trasferta entra nel totale: lasciata scritta e poi
  -- riportata la sede da noi, continuerebbe a sommarsi senza che si veda da
  -- dove arriva (vedi calcola() in js/formazione/calc.js).
  sede_tipo text not null default 'nostra' check (sede_tipo in ('nostra','cliente')),
  sede text,
  trasferta numeric(12,2) check (trasferta >= 0),

  -- Regime IVA scelto per questo preventivo: 'nessuno' non stampa nulla
  -- (come i preventivi scritti a mano finora), 'esente' e 'soggetto'
  -- stampano la frase configurata in Impostazioni. Con 'soggetto' l'IVA si
  -- calcola sul netto, cioe' dopo gli sconti.
  regime_iva text not null default 'nessuno' check (regime_iva in ('nessuno','esente','soggetto')),

  -- Sconti sull'intero pacchetto: due campi indipendenti, utilizzabili anche
  -- insieme. La percentuale si calcola sul totale, l'importo fisso si toglie
  -- da quello che resta. Sono un'altra cosa rispetto al prezzo riservato del
  -- singolo corso, che sta dentro 'righe'.
  sconto_percentuale numeric(5,2) check (sconto_percentuale >= 0 and sconto_percentuale <= 100),
  sconto_valore numeric(12,2) check (sconto_valore >= 0),
  note text,

  -- Sempre il totale finale: quanto il cliente paga davvero, IVA compresa
  -- quando c'e'.
  totale numeric(12,2),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prev_form_created on public.preventivi_formazione(created_at desc);
create index if not exists idx_prev_form_stato on public.preventivi_formazione(stato);

-- ------------------------------------------------------------------
--  RUBRICA DEI COMMITTENTI
--  Le aziende tornano: gli aggiornamenti scadono ogni tre anni e chi ha
--  fatto il corso nel 2023 richiama nel 2026. I dati restano comunque
--  COPIATI dentro ogni preventivo, come i prezzi dei corsi.
-- ------------------------------------------------------------------
create table if not exists public.clienti_formazione (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cf text,                       -- codice fiscale o partita IVA
  indirizzo text,
  referente text,
  referente_email text,
  referente_telefono text,
  note text,                     -- promemoria interni, non finiscono nel documento
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Due schede per la stessa azienda sono il modo tipico in cui una rubrica
-- diventa inutile: il nome e' unico, senza distinzione fra maiuscole e
-- minuscole ne' spazi in piu' agli estremi.
create unique index if not exists idx_clienti_form_nome
  on public.clienti_formazione (lower(btrim(nome)));

-- Catalogo dei corsi e testi fissi del documento: una riga sola, come per le
-- altre sezioni.
create table if not exists public.impostazioni_formazione (
  id text primary key default 'default',
  dati jsonb not null,
  updated_at timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------
-- Leggere, inserire e modificare sono il lavoro di tutti i giorni e li fa
-- chiunque abbia accesso alla sezione; CANCELLARE un preventivo no, resta
-- agli admin: di un preventivo eliminato non resta niente, e un operatore
-- potrebbe buttare via quello preparato da un collega. Il cestino nascosto
-- nell'app e' solo cortesia verso l'utente, la regola che conta e' questa.
alter table public.preventivi_formazione  enable row level security;
alter table public.clienti_formazione     enable row level security;
alter table public.impostazioni_formazione enable row level security;

drop policy if exists prev_form_read on public.preventivi_formazione;
create policy prev_form_read on public.preventivi_formazione for select
  using (public.accede_a('formazione'));

drop policy if exists prev_form_insert on public.preventivi_formazione;
create policy prev_form_insert on public.preventivi_formazione for insert
  with check (public.accede_a('formazione'));

drop policy if exists prev_form_update on public.preventivi_formazione;
create policy prev_form_update on public.preventivi_formazione for update
  using (public.accede_a('formazione')) with check (public.accede_a('formazione'));

drop policy if exists prev_form_delete on public.preventivi_formazione;
create policy prev_form_delete on public.preventivi_formazione for delete
  using (public.e_admin_sezione('formazione'));

-- La rubrica e' uno strumento di lavoro condiviso: chi accede alla sezione la
-- legge e la aggiorna, cancellazione compresa. Togliere una scheda non
-- distrugge nulla di storico, perche' i preventivi hanno la loro copia dei
-- dati.
drop policy if exists clienti_form_read on public.clienti_formazione;
create policy clienti_form_read on public.clienti_formazione for select
  using (public.accede_a('formazione'));
drop policy if exists clienti_form_write on public.clienti_formazione;
create policy clienti_form_write on public.clienti_formazione for all
  using (public.accede_a('formazione')) with check (public.accede_a('formazione'));

-- Il catalogo dei corsi e i testi del documento sono i parametri del lavoro
-- quotidiano e li tocca anche l'operatore, come il tariffario delle
-- assistenze. Per riservarli agli admin basta sostituire accede_a con
-- e_admin_sezione qui sotto e nascondere la voce di menu nell'app.
drop policy if exists imp_form_read on public.impostazioni_formazione;
create policy imp_form_read on public.impostazioni_formazione for select
  using (public.accede_a('formazione'));
drop policy if exists imp_form_write on public.impostazioni_formazione;
create policy imp_form_write on public.impostazioni_formazione for all
  using (public.accede_a('formazione')) with check (public.accede_a('formazione'));

comment on table public.clienti_formazione is
  'Rubrica dei committenti dei corsi: compilata dagli operatori mentre fanno i preventivi';

-- ============================================================
--  DOPO L'ESECUZIONE: dal portale, in "Utenti e autorizzazioni", dai la
--  sezione "Formazione Esterna" a chi deve preparare i preventivi.
--  Il catalogo di partenza (i sei corsi del listino: primo soccorso gruppo A
--  e B/C con i rispettivi aggiornamenti, BLSD e retraining BLSD) lo crea
--  l'app da sola alla prima apertura delle impostazioni, con i prezzi a
--  zero: vanno impostati li' prima di fare il primo preventivo.
-- ============================================================
