-- ============================================================
--  PATCH — FORMAZIONE ESTERNA: il registro dei corsi effettuati
--  Da eseguire nell'SQL Editor di Supabase del portale, dopo
--  patch-2026-09-06-formazione.sql e patch-2026-10-18-registro.sql.
--
--  Fin qui la sezione conosceva solo i preventivi: sapeva che cosa si era
--  proposto, non che cosa si era fatto. Un preventivo confermato per
--  quindici persone può diventare due edizioni in date diverse, con dodici
--  presenti di cui uno non idoneo — ed è quel numero, non quello del
--  preventivo, che serve per le statistiche, per sapere quando scade
--  l'attestato e per rispondere a «quante persone abbiamo formato
--  quest'anno?».
--
--  Una riga = una edizione di un corso: un corso, delle date, una sede, i
--  docenti, i partecipanti. Nasce di solito da una riga di un preventivo
--  confermato (preventivo_id), ma si può creare anche da sola: il corso
--  organizzato senza preventivo, o quello registrato a posteriori.
-- ============================================================

create table if not exists public.corsi_formazione (
  id uuid primary key default gen_random_uuid(),

  -- Il preventivo da cui nasce, se c'è. Eliminato il preventivo il corso
  -- resta: è successo davvero, e le statistiche non devono perderlo.
  preventivo_id uuid references public.preventivi_formazione(id) on delete set null,

  -- Il corso, COPIATO dal catalogo (o dalla riga del preventivo) come nei
  -- preventivi: rinominare un corso in Impostazioni non deve riscrivere il
  -- registro di quelli già tenuti. 'ore' è un numero, a differenza di
  -- 'durata' che è testo da documento ("16 ore"): serve a sommare le ore
  -- di formazione erogate.
  corso_id text,
  corso_nome text not null,
  sigla text,
  durata text,
  ore numeric(6,2) check (ore >= 0),
  rinnovo_anni integer check (rinnovo_anni > 0),

  cliente text,

  -- Un corso da 16 ore si tiene in più giornate: inizio e fine. La fine
  -- vuota vuol dire giornata unica.
  data_inizio date,
  data_fine date,
  constraint corsi_form_date check (data_fine is null or data_inizio is null or data_fine >= data_inizio),

  sede_tipo text not null default 'nostra' check (sede_tipo in ('nostra','cliente')),
  sede text,
  docenti text,

  -- 'programmato' finché non si è tenuto, poi 'svolto'. Solo gli svolti
  -- entrano nelle statistiche.
  stato text not null default 'programmato' check (stato in ('programmato','svolto','annullato')),

  -- Quante persone: 'discenti' è il numero che conta (i presenti, a corso
  -- svolto). Con l'elenco nominativo compilato l'app lo ricava da lì; senza,
  -- si scrive a mano — non sempre l'azienda manda i nomi.
  --   partecipanti: [{cognome, nome, cf, esito}]   esito: idoneo | non_idoneo | assente
  discenti integer check (discenti >= 0),
  partecipanti jsonb not null default '[]'::jsonb,

  -- Quanto vale questa edizione, IVA esclusa: la sua parte del preventivo
  -- (vedi corsiDaPreventivo in js/formazione/corsi.js). Serve a dire quanto
  -- rende ogni tipo di corso.
  importo numeric(12,2) check (importo >= 0),

  note text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_corsi_form_data on public.corsi_formazione(data_inizio desc);
create index if not exists idx_corsi_form_prev on public.corsi_formazione(preventivo_id);

-- ---------- ROW LEVEL SECURITY ----------
-- Come per i preventivi: il lavoro quotidiano lo fa chiunque abbia accesso
-- alla sezione, cancellare resta agli admin. Dentro ci sono nomi e codici
-- fiscali dei partecipanti: chi non ha la sezione non li vede.
alter table public.corsi_formazione enable row level security;

drop policy if exists corsi_form_read on public.corsi_formazione;
create policy corsi_form_read on public.corsi_formazione for select
  using (public.accede_a('formazione'));
drop policy if exists corsi_form_insert on public.corsi_formazione;
create policy corsi_form_insert on public.corsi_formazione for insert
  with check (public.accede_a('formazione'));
drop policy if exists corsi_form_update on public.corsi_formazione;
create policy corsi_form_update on public.corsi_formazione for update
  using (public.accede_a('formazione')) with check (public.accede_a('formazione'));
drop policy if exists corsi_form_delete on public.corsi_formazione;
create policy corsi_form_delete on public.corsi_formazione for delete
  using (public.e_admin_sezione('formazione'));

-- Nel registro modifiche, come tutte le altre tabelle di lavoro.
do $$
begin
  if to_regprocedure('public.trg_registro()') is not null then
    drop trigger if exists on_corsi_formazione_registro on public.corsi_formazione;
    create trigger on_corsi_formazione_registro after insert or update or delete on public.corsi_formazione
      for each row execute procedure public.trg_registro();
  end if;
end $$;

comment on table public.corsi_formazione is
  'Registro dei corsi di formazione esterna effettivamente programmati e svolti, con i partecipanti';
