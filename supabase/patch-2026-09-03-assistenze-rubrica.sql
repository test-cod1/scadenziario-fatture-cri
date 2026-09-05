-- ============================================================
--  PATCH — Rubrica clienti delle assistenze sanitarie
--  Da eseguire nell'SQL Editor di Supabase del portale, dopo
--  patch-2026-09-02-assistenze.sql.
--
--  I clienti si ripetono (lo stesso Comune, la stessa società sportiva, la
--  stessa parrocchia): la rubrica li tiene scritti una volta sola, e da un
--  preventivo si sceglie chi è il destinatario invece di ribattere ogni
--  volta denominazione, codice fiscale e indirizzo.
--
--  I dati del cliente restano COPIATI dentro il preventivo, come già i
--  prezzi delle voci: correggere un indirizzo in rubrica non deve cambiare
--  un preventivo già mandato al cliente.
-- ============================================================

create table if not exists public.clienti_assistenze (
  id uuid primary key default gen_random_uuid(),

  nome text not null,
  cf text,                       -- codice fiscale o partita IVA
  indirizzo text,

  -- Il referente è la persona da chiamare: sta in rubrica perché di solito è
  -- sempre la stessa, ma nel preventivo resta modificabile evento per evento.
  referente text,
  referente_email text,
  referente_telefono text,

  note text,                     -- promemoria interni, non finiscono nel documento

  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Due schede per lo stesso cliente sono il modo tipico in cui una rubrica
-- diventa inutile: il nome è unico, senza distinzione fra maiuscole e
-- minuscole né spazi in più agli estremi.
create unique index if not exists idx_clienti_ass_nome
  on public.clienti_assistenze (lower(btrim(nome)));

-- ---------- ROW LEVEL SECURITY ----------
-- La rubrica è uno strumento di lavoro condiviso: chi accede alla sezione la
-- legge e la aggiorna, come il tariffario. La cancellazione non distrugge
-- nulla di storico (i preventivi hanno la loro copia dei dati), quindi resta
-- a tutti quelli che possono scrivere.
alter table public.clienti_assistenze enable row level security;

drop policy if exists clienti_ass_read on public.clienti_assistenze;
create policy clienti_ass_read on public.clienti_assistenze for select
  using (public.accede_a('assistenze'));

drop policy if exists clienti_ass_write on public.clienti_assistenze;
create policy clienti_ass_write on public.clienti_assistenze for all
  using (public.accede_a('assistenze')) with check (public.accede_a('assistenze'));

comment on table public.clienti_assistenze is
  'Rubrica dei clienti delle assistenze sanitarie: compilata dagli operatori mentre fanno i preventivi';
