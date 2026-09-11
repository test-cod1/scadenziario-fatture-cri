-- ============================================================
--  PATCH — Gli impegni della sezione DIRETTORE
--  Data: 2026-09-11
--  Da eseguire dopo patch-2026-09-11-direttore.sql, che crea la sezione.
--
--  Una tabella sola: le cose da fare della direzione, con le tre
--  informazioni che servono a metterle in ordine — quanto è URGENTE
--  (quanto preme il tempo), quanto è IMPORTANTE (quanto pesa il
--  risultato) e QUANDO scade.
--
--  Urgenza e importanza restano due colonne separate di proposito.
--  Tenerle insieme in un solo campo "priorità" avrebbe fatto sparire la
--  distinzione che è il motivo per cui si compila questo elenco: la
--  riunione di domani preme molto e può contare poco, il bilancio conta
--  molto mesi prima di premere. L'ordine in cui compaiono lo calcola
--  l'app (js/direttore/calc.js), non il database: dipende da quanti
--  giorni mancano alla scadenza, quindi cambia da solo ogni giorno e non
--  si può congelare in una colonna.
-- ============================================================

create table if not exists public.impegni_direttore (
  id uuid primary key default gen_random_uuid(),

  titolo text not null check (btrim(titolo) <> ''),
  dettagli text,

  -- Tre livelli, non un numero libero: un campo aperto avrebbe prodotto
  -- una scala diversa ogni mese, e l'ordinamento avrebbe smesso di voler
  -- dire qualcosa.
  urgenza    text not null default 'media' check (urgenza    in ('alta', 'media', 'bassa')),
  importanza text not null default 'media' check (importanza in ('alta', 'media', 'bassa')),

  -- Può mancare, ed è un'informazione: "va fatto, ma non entro una data".
  -- Un default a oggi avrebbe spinto in cima all'elenco ogni cosa appena
  -- scritta, che è il contrario di quello che serve.
  scadenza date,

  fatto boolean not null default false,
  fatto_il timestamptz,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- L'elenco si apre sempre sulle cose da fare: l'indice segue quella
-- lettura, non l'ordine di inserimento.
create index if not exists idx_impegni_dir_aperti on public.impegni_direttore(fatto, scadenza);

comment on table public.impegni_direttore is
  'Impegni della direzione: cosa fare, quanto urgente, quanto importante, entro quando';

-- ---------- ROW LEVEL SECURITY ----------
-- Gli impegni sono condivisi fra chi ha accesso alla sezione, come i dati
-- di tutte le altre sezioni del portale: Direttore è la scrivania della
-- direzione, non l'agenda privata di una persona. Chi non ha la sezione
-- non vede nulla, e da patch-2026-09-05-sospensione-e-quote.sql questo
-- vale anche per chi è stato sospeso, non solo nel browser.
alter table public.impegni_direttore enable row level security;

drop policy if exists impegni_dir_read on public.impegni_direttore;
create policy impegni_dir_read on public.impegni_direttore for select
  using (public.accede_a('direttore'));
drop policy if exists impegni_dir_write on public.impegni_direttore;
create policy impegni_dir_write on public.impegni_direttore for all
  using (public.accede_a('direttore')) with check (public.accede_a('direttore'));

-- ---------- VERIFICA ----------
-- Deve restituire la tabella con RLS attiva e due policy.
select c.relname as tabella,
       c.relrowsecurity as rls_attiva,
       count(p.polname)::text as policy
  from pg_class c
  left join pg_policy p on p.polrelid = c.oid
 where c.relname = 'impegni_direttore'
 group by c.relname, c.relrowsecurity;
