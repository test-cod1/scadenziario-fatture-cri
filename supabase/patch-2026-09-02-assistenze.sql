-- ============================================================
--  PATCH — Sezione ASSISTENZE SANITARIE (generatore di preventivi)
--  Da eseguire nell'SQL Editor di Supabase del portale, dopo
--  patch-2026-09-01-portale.sql.
--
--  Due tabelle, con la stessa forma già usata dai trasporti: i preventivi e
--  un'unica riga di impostazioni (tariffario e testi fissi del documento).
-- ============================================================

create table if not exists public.preventivi_assistenze (
  id uuid primary key default gen_random_uuid(),

  -- Destinatario e referente: finiscono nell'intestazione del documento.
  cliente text,
  cliente_indirizzo text,
  cliente_cf text,
  referente text,
  referente_email text,
  referente_telefono text,

  -- Di cosa si tratta: oggetto (l'evento) e dove si svolge.
  oggetto text,
  luogo text,
  data_documento date,

  stato text not null default 'bozza' check (stato in ('bozza','inviato','confermato','annullato')),

  -- Voci del tariffario usate in QUESTO preventivo, con il prezzo al momento
  -- della stesura: [{id, nome, tipo: 'oraria'|'fissa', prezzo}]. Sono una
  -- copia, non un riferimento alle impostazioni: se domani la tariffa oraria
  -- cambia, un preventivo già mandato al cliente deve continuare a mostrare
  -- il prezzo con cui è stato fatto.
  voci jsonb not null default '[]'::jsonb,

  -- Calendario dell'assistenza: una riga per turno, con le quantità di
  -- ciascuna voce. [{data, dalle, alle, qta: {voceId: n}, note}]
  calendario jsonb not null default '[]'::jsonb,

  -- Sconti: due campi indipendenti, utilizzabili anche insieme. La
  -- percentuale si calcola sul totale, l'importo fisso si toglie da quello
  -- che resta. La colonna 'totale' e' sempre il netto, cioe' quanto il
  -- cliente paga davvero.
  sconto_percentuale numeric(5,2) check (sconto_percentuale >= 0 and sconto_percentuale <= 100),
  sconto_valore numeric(12,2) check (sconto_valore >= 0),
  note text,
  totale numeric(12,2),

  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prev_ass_created on public.preventivi_assistenze(created_at desc);
create index if not exists idx_prev_ass_stato on public.preventivi_assistenze(stato);

-- Tariffario e testi fissi del documento (premessa, dati bancari, clausole,
-- firma): una riga sola, come per le altre sezioni.
create table if not exists public.impostazioni_assistenze (
  id text primary key default 'default',
  dati jsonb not null,
  updated_at timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------
-- Chi ha accesso alla sezione assistenze legge e scrive. Le impostazioni
-- (tariffario e testi) restano modificabili anche dall'operatore, come nei
-- trasporti: sono i parametri del preventivo di tutti i giorni.
alter table public.preventivi_assistenze  enable row level security;
alter table public.impostazioni_assistenze enable row level security;

drop policy if exists prev_ass_read on public.preventivi_assistenze;
create policy prev_ass_read on public.preventivi_assistenze for select using (public.accede_a('assistenze'));
drop policy if exists prev_ass_write on public.preventivi_assistenze;
create policy prev_ass_write on public.preventivi_assistenze for all
  using (public.accede_a('assistenze')) with check (public.accede_a('assistenze'));

drop policy if exists imp_ass_read on public.impostazioni_assistenze;
create policy imp_ass_read on public.impostazioni_assistenze for select using (public.accede_a('assistenze'));
drop policy if exists imp_ass_write on public.impostazioni_assistenze;
create policy imp_ass_write on public.impostazioni_assistenze for all
  using (public.accede_a('assistenze')) with check (public.accede_a('assistenze'));

-- ============================================================
--  DOPO L'ESECUZIONE: dal portale, in "Utenti e autorizzazioni", dai la
--  sezione "Assistenze sanitarie" a chi deve preparare i preventivi.
--  Il tariffario di partenza (ambulanza con equipaggio, medico, squadra a
--  piedi, gazebo) lo crea l'app da sola alla prima apertura delle
--  impostazioni: va poi rivisto con i prezzi veri.
-- ============================================================
