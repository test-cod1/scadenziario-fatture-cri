-- ============================================================
--  PATCH — CENTRI DI COSTO (sezione Analisi)
--  Data: 2026-09-15
--
--  Serve a rispondere a una domanda che oggi il portale non sa reggere:
--  «quell'attività, alla fine, quanto è costata e quanto ha reso?».
--  I soldi ci sono già tutti — nelle fatture passive (uscite) e attive
--  (entrate) — ma nessuno dice A QUALE ATTIVITÀ appartengono.
--
--  Due tabelle:
--
--  1. `centri_costo` — l'anagrafica delle attività. La tiene l'admin della
--     sezione Analisi: è un piano dei conti, non un elenco che ognuno
--     allunga mentre registra una fattura. Se bastasse scrivere un nome
--     libero nella scheda della fattura, dopo un anno ci sarebbero
--     «Fiera del Mare», «fiera del mare» e «Fiera Mare 2026», e i totali
--     sarebbero tre invece di uno.
--
--  2. `imputazioni` — quanto di UNA fattura pesa su UN centro. Una riga
--     per abbinamento, con la quota in euro: una bolletta da 1000 € può
--     valere 600 € su un corso e 400 € su un'assistenza, ed è il caso
--     normale, non l'eccezione. Una fattura può anche non essere
--     imputata affatto (le spese generali), o esserlo in parte.
--
--  La quota è in EURO e non in percentuale: quello che si conosce, avendo
--  in mano il documento, è «di questi 1000, 600 sono del corso». La
--  percentuale sarebbe una divisione fatta a mano dall'utente, con il suo
--  arrotondamento, e i totali non tornerebbero più.
--
--  La somma delle quote di una fattura non può superare il suo importo:
--  lo fa rispettare un trigger, non il browser — due persone che
--  imputano la stessa fattura nello stesso momento non si vedono fra
--  loro, e un controllo fatto solo a schermo si aggira ricaricando la
--  pagina.
--
--  ATTENZIONE, i permessi. Analisi legge i dati dello scadenziario: senza
--  questo, chi ha solo 'analisi' vedrebbe i centri di costo e nessun
--  numero dentro. La patch estende `puo_leggere()` — la funzione da cui
--  passano TUTTE le policy di lettura delle fatture — a chi ha la sezione
--  Analisi. `puo_scrivere()` non cambia: da Analisi non si modifica
--  nessuna fattura. Resta il fatto che **dare la sezione Analisi a una
--  persona significa farle leggere tutte le fatture del Comitato**,
--  passive e attive: è una decisione da prendere sapendola.
--
--  È idempotente.
-- ============================================================

-- ---------- 1. Lettura delle fatture anche da Analisi ----------
create or replace function public.puo_leggere()
returns boolean language sql stable security definer set search_path = public as $$
  select public.accede_a('scadenziario') or public.accede_a('analisi');
$$;

-- ---------- 2. Anagrafica dei centri di costo ----------
create table if not exists public.centri_costo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descrizione text,
  -- Il periodo dell'attività, quando ne ha uno: serve a leggere il conto
  -- («è durata da marzo a giugno»), non a filtrare le fatture — una
  -- fattura può arrivare mesi dopo la fine, e resta di quell'attività.
  inizio date,
  fine date,
  -- Un'attività conclusa non si cancella: i suoi conti restano, ma esce
  -- dalle tendine di chi registra una fattura nuova. Senza, dopo due anni
  -- la tendina sarebbe lunga cento voci di cui novanta chiuse.
  chiuso boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Due centri con lo stesso nome sono lo stesso centro scritto due volte, e
-- spezzano in due un conto che dovrebbe essere uno solo. Il confronto
-- ignora maiuscole e spazi ai lati, che sono il modo in cui il doppione
-- nasce davvero.
create unique index if not exists ux_centri_costo_nome
  on public.centri_costo (lower(btrim(nome)));

-- ---------- 3. Imputazioni: quanto di una fattura pesa su un centro ----------
create table if not exists public.imputazioni (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centri_costo(id) on delete cascade,
  -- Esattamente una delle due: una riga parla o di una fattura passiva
  -- (un'uscita) o di una attiva (un'entrata). Due colonne invece di una
  -- sola più un campo "tipo" perché così è il database a garantire che la
  -- fattura esista davvero, con la sua chiave esterna.
  fattura_id uuid references public.fatture(id) on delete cascade,
  fattura_attiva_id uuid references public.fatture_attive(id) on delete cascade,
  importo numeric(12,2) not null check (importo > 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint imputazioni_una_sola_fattura check (
    (fattura_id is not null and fattura_attiva_id is null) or
    (fattura_id is null and fattura_attiva_id is not null)
  )
);

create index if not exists idx_imputazioni_centro on public.imputazioni(centro_id);
create index if not exists idx_imputazioni_fattura on public.imputazioni(fattura_id);
create index if not exists idx_imputazioni_fattura_attiva on public.imputazioni(fattura_attiva_id);

-- Una fattura pesa su un centro per una quota sola: due righe per la stessa
-- coppia sarebbero due modi di dire la stessa cosa, e chi corregge la prima
-- lascerebbe in piedi la seconda.
create unique index if not exists ux_imputazioni_passiva
  on public.imputazioni(centro_id, fattura_id) where fattura_id is not null;
create unique index if not exists ux_imputazioni_attiva
  on public.imputazioni(centro_id, fattura_attiva_id) where fattura_attiva_id is not null;

-- ---------- 4. Le quote non possono superare la fattura ----------
-- `security definer` perché il controllo deve valere anche per chi non
-- vede quella fattura: la regola non può dipendere dai permessi di chi
-- scrive. Il mezzo centesimo di tolleranza assorbe l'arrotondamento di una
-- ripartizione in terzi, che altrimenti fallirebbe sull'ultima quota.
create or replace function public.trg_imputazioni_controlla()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lordo numeric(12,2);
  gia_imputato numeric(12,2);
begin
  if new.fattura_id is not null then
    select importo into lordo from public.fatture where id = new.fattura_id;
    select coalesce(sum(importo), 0) into gia_imputato from public.imputazioni
     where fattura_id = new.fattura_id and id is distinct from new.id;
  else
    select importo into lordo from public.fatture_attive where id = new.fattura_attiva_id;
    select coalesce(sum(importo), 0) into gia_imputato from public.imputazioni
     where fattura_attiva_id = new.fattura_attiva_id and id is distinct from new.id;
  end if;

  if lordo is null then
    raise exception 'La fattura a cui stai attribuendo questa quota non esiste.';
  end if;
  if gia_imputato + new.importo > lordo + 0.005 then
    raise exception 'Le quote attribuite arrivano a % € e la fattura è di % €: ne restano % € da attribuire.',
      to_char(gia_imputato + new.importo, 'FM999999990.00'),
      to_char(lordo, 'FM999999990.00'),
      to_char(lordo - gia_imputato, 'FM999999990.00');
  end if;
  return new;
end;
$$;

drop trigger if exists imputazioni_controlla on public.imputazioni;
create trigger imputazioni_controlla
  before insert or update on public.imputazioni
  for each row execute function public.trg_imputazioni_controlla();

-- ---------- 5. Permessi ----------
alter table public.centri_costo enable row level security;
alter table public.imputazioni  enable row level security;

-- I centri si leggono anche dallo scadenziario: è lì che si attribuisce una
-- fattura mentre la si registra, e senza l'elenco la tendina sarebbe vuota.
drop policy if exists centri_costo_read on public.centri_costo;
create policy centri_costo_read on public.centri_costo for select to authenticated
  using (public.accede_a('analisi') or public.accede_a('scadenziario'));

-- Crearli, rinominarli e chiuderli è invece riservato all'admin di Analisi:
-- è il piano dei conti del Comitato, e un elenco che si allunga da solo
-- smette di far tornare i totali (vedi il commento in testa).
drop policy if exists centri_costo_write on public.centri_costo;
create policy centri_costo_write on public.centri_costo for all to authenticated
  using (public.e_admin_sezione('analisi')) with check (public.e_admin_sezione('analisi'));

-- Attribuire una fattura a un centro lo fa sia chi registra (dalla scheda
-- della fattura) sia chi analizza (dalla pagina delle non attribuite):
-- sono lo stesso gesto fatto in due momenti diversi del lavoro.
drop policy if exists imputazioni_read on public.imputazioni;
create policy imputazioni_read on public.imputazioni for select to authenticated
  using (public.accede_a('analisi') or public.accede_a('scadenziario'));

drop policy if exists imputazioni_write on public.imputazioni;
create policy imputazioni_write on public.imputazioni for all to authenticated
  using (public.accede_a('analisi') or public.accede_a('scadenziario'))
  with check (public.accede_a('analisi') or public.accede_a('scadenziario'));

-- ---------- DOPO L'ESECUZIONE ----------
-- 1. Esegui prima `patch-2026-09-15-analisi.sql`, se non l'hai già fatto:
--    crea la sezione, e senza quella il permesso 'analisi' non esiste.
-- 2. Dal portale, Analisi → Centri di costo → "Nuovo centro": crea le
--    attività che vuoi seguire.
-- 3. "Da attribuire" elenca le fatture ancora senza centro: è da lì che si
--    recupera l'arretrato.

-- ---------- VERIFICA ----------
-- Le due tabelle nuove, vuote, e la funzione di lettura aggiornata.
select (select count(*) from public.centri_costo) as centri,
       (select count(*) from public.imputazioni)  as imputazioni,
       public.puo_leggere()                        as posso_leggere_le_fatture;
