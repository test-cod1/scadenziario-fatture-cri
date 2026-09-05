-- ============================================================
--  PATCH — Sezione STRAORDINARI (registro degli straordinari dei dipendenti)
--  Da eseguire nell'SQL Editor di Supabase del portale, dopo
--  patch-2026-09-01-portale.sql.
--
--  Sostituisce il foglio mensile "ELENCO DIPENDENTI-ORARI MESE": lì lo
--  straordinario era una riga "EXTRA" dentro il tabellone dei turni, scritta
--  a mano, senza chi l'aveva chiesto né perché, e con i recuperi segnati come
--  numeri negativi in mezzo agli altri. Qui ogni straordinario è un record:
--  chi, quando, quante ore, per quale motivo, chiesto da chi e a che punto è
--  (richiesto → confermato → liquidato/recuperato).
--
--  Tre tabelle: i dipendenti, le righe di straordinario, e la solita riga
--  unica di impostazioni (causali e soglie di avviso).
-- ============================================================

-- ---------- ANAGRAFICA DEI DIPENDENTI ----------
-- Sono i dipendenti del foglio mensile, con le ore settimanali di contratto
-- (38 / 35 / 30 / 24) che lì comparivano accanto al cognome. Non è una copia
-- del personale dell'ente: serve a scegliere un nome da un elenco invece di
-- riscriverlo, e a sapere quante ore ordinarie fa chi si sta caricando di
-- straordinari.
create table if not exists public.dipendenti_straordinari (
  id uuid primary key default gen_random_uuid(),

  cognome text not null,
  nome text,
  matricola text,
  telefono text,
  ore_contratto numeric(4,1) check (ore_contratto > 0 and ore_contratto <= 60),

  -- Chi va via non si cancella (i suoi straordinari restano nello storico):
  -- si disattiva, e sparisce dagli elenchi di scelta.
  attivo boolean not null default true,
  note text,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Due schede per la stessa persona renderebbero i totali mensili sbagliati
-- senza che nulla lo segnali: cognome+nome è unico, senza distinzione fra
-- maiuscole e minuscole né spazi in più agli estremi.
create unique index if not exists idx_dipendenti_str_nominativo
  on public.dipendenti_straordinari (lower(btrim(cognome)), lower(btrim(coalesce(nome, ''))));
create index if not exists idx_dipendenti_str_attivo on public.dipendenti_straordinari(attivo);

-- ---------- RIGHE DI STRAORDINARIO ----------
create table if not exists public.straordinari (
  id uuid primary key default gen_random_uuid(),

  dipendente_id uuid not null references public.dipendenti_straordinari(id) on delete restrict,
  -- Il nominativo è COPIATO qui, come i dati del cliente nei preventivi delle
  -- assistenze: correggere un cognome in anagrafica non deve riscrivere i
  -- registri dei mesi già chiusi e già mandati all'ufficio personale.
  dipendente_nome text not null,

  data date not null,
  -- Orari indicativi dello straordinario: servono a ricostruire cos'è
  -- successo, ma NON sono il calcolo — le ore valide sono quelle in `ore`,
  -- che l'app propone dagli orari e chi registra può correggere (un rientro
  -- arrotondato, una frazione concordata a voce).
  dalle time,
  alle time,
  ore numeric(5,2) not null check (ore > 0 and ore <= 24),

  -- Il segno lo dà il tipo, non il numero: nel foglio di carta i recuperi
  -- erano ore negative in mezzo alle altre, e bastava un meno dimenticato per
  -- falsare il totale del mese. Qui le ore sono sempre positive e il saldo lo
  -- calcola l'app (straordinari − recuperi).
  tipo text not null default 'straordinario'
    check (tipo in ('straordinario','recupero','cambio_turno')),

  causale text,          -- perché: emergenza, copertura turno, servizio programmato…
  servizio text,         -- riferimento operativo: mezzo, convenzione, evento

  note text,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_straord_data on public.straordinari(data desc);
create index if not exists idx_straord_dipendente on public.straordinari(dipendente_id, data desc);

-- ---------- IMPOSTAZIONI (causali e soglie) ----------
create table if not exists public.impostazioni_straordinari (
  id text primary key default 'default',
  dati jsonb not null,
  updated_at timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------
-- Chi ha accesso alla sezione legge e scrive: è il responsabile della
-- centrale operativa che registra, e distinguere fra lettura e scrittura per
-- chi è già stato abilitato non proteggerebbe nulla. Le impostazioni
-- (causali e soglie) restano invece al solo admin di sezione: sono le regole
-- con cui si legge tutto il registro, non un dato di giornata.
-- L'eliminazione di un dipendente con straordinari a suo carico la impedisce la
-- chiave esterna (on delete restrict), non un permesso.
alter table public.dipendenti_straordinari      enable row level security;
alter table public.straordinari              enable row level security;
alter table public.impostazioni_straordinari enable row level security;

drop policy if exists dipendenti_str_read on public.dipendenti_straordinari;
create policy dipendenti_str_read on public.dipendenti_straordinari for select
  using (public.accede_a('straordinari'));
drop policy if exists dipendenti_str_write on public.dipendenti_straordinari;
create policy dipendenti_str_write on public.dipendenti_straordinari for all
  using (public.accede_a('straordinari')) with check (public.accede_a('straordinari'));

drop policy if exists straord_read on public.straordinari;
create policy straord_read on public.straordinari for select
  using (public.accede_a('straordinari'));
drop policy if exists straord_write on public.straordinari;
create policy straord_write on public.straordinari for all
  using (public.accede_a('straordinari')) with check (public.accede_a('straordinari'));

drop policy if exists imp_straord_read on public.impostazioni_straordinari;
create policy imp_straord_read on public.impostazioni_straordinari for select
  using (public.accede_a('straordinari'));
drop policy if exists imp_straord_write on public.impostazioni_straordinari;
create policy imp_straord_write on public.impostazioni_straordinari for all
  using (public.e_admin_sezione('straordinari')) with check (public.e_admin_sezione('straordinari'));

-- ---------- LA SEZIONE NEL PORTALE ----------
insert into public.sezioni (id, etichetta, ordine) values
  ('straordinari', 'Straordinari', 5)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;

comment on table public.straordinari is
  'Registro degli straordinari richiesti ai dipendenti dalla centrale operativa';
comment on table public.dipendenti_straordinari is
  'Dipendenti a cui si possono richiedere straordinari, con le ore settimanali di contratto';

-- ============================================================
--  DOPO L'ESECUZIONE
--   1. Dal portale, "Utenti e autorizzazioni": dai la sezione "Straordinari"
--      al responsabile della centrale operativa (ruolo admin se deve anche
--      modificare causali e soglie, operatore se solo registrare).
--   2. Esegui subito dopo patch-2026-09-05-dipendenti.sql: rinomina questa
--      anagrafica da "autisti" a "dipendenti" (il registro serve per tutto
--      il personale, non solo per chi guida) e carica l'elenco delle 19
--      persone in servizio. Le ore settimanali di contratto restano da
--      compilare a mano nella scheda di ciascuno: quelle del foglio di
--      agosto 2026 erano
--        DE BARBIERI 38, DJEFFAL 38, MUÑOZ 38, PAZZANO 38, PELLEGRINI 38,
--        SORDELLI 38, BASTIA 35, CANEPA 35, GARIBALDI 35, PORTORICO 35,
--        GRIMALDI 30, AIELLO 30, BISIGNANI 30, PASCU 24, PICOLLO.
--   3. Le causali di partenza le crea l'app alla prima apertura delle
--      impostazioni: vanno riviste con quelle davvero usate in centrale.
-- ============================================================
