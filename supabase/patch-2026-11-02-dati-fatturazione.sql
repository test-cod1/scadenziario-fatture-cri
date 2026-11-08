-- ============================================================
--  PATCH — DATI DI FATTURAZIONE CHIESTI AL CLIENTE
--  Da eseguire nell'SQL Editor di Supabase del portale, dopo
--  patch-2026-09-06-formazione.sql e patch-2026-10-18-registro.sql.
--
--  Dal preventivo si genera un link da mandare al cliente: apre un modulo
--  pubblico (dati-fatturazione.html) dove il cliente scrive i suoi dati di
--  fatturazione — ragione sociale, P.IVA, codice destinatario SDI o PEC,
--  per la PA codice ufficio, CIG, CUP. Una riga di questa tabella è quel
--  link: il codice segreto, il preventivo a cui si riferisce, e quello che
--  il cliente ha mandato.
--
--  Una tabella a sé e non colonne del preventivo: il preventivo si salva
--  intero dall'elenco (cambio di stato) e dall'editor, e un invio del
--  cliente arrivato nel frattempo verrebbe cancellato dal salvataggio di
--  una copia vecchia.
--
--  Chi scrive qui dal modulo pubblico non è un utente del portale: passa da
--  /api/dati-fatturazione, che controlla il codice e i dati e scrive con la
--  service role key. Nessuna policy apre la tabella agli anonimi.
-- ============================================================

create table if not exists public.dati_fatturazione (
  id uuid primary key default gen_random_uuid(),

  -- Di quale sezione e di quale preventivo. Niente chiave esterna: il
  -- preventivo sta in una tabella diversa per ogni sezione.
  sezione text not null check (sezione in ('formazione','assistenze','trasporti')),
  preventivo_id uuid not null,

  -- Il codice nel link: 32 byte casuali (43 caratteri base64url). Chi lo ha
  -- può solo leggere l'intestazione del preventivo e mandare i dati di
  -- fatturazione, nient'altro. Rigenerarlo invalida il link vecchio.
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),
  scade_il timestamptz not null default (now() + interval '120 days'),
  revocato boolean not null default false,

  -- Quello che il cliente ha mandato, già controllato dal server (vedi
  -- js/lib/datiFatturazione.mjs). Ogni nuovo invio sostituisce il
  -- precedente: il cliente può correggersi finché il link vale.
  dati jsonb,
  inviato_il timestamptz,
  invii integer not null default 0,

  -- Quando un operatore ha riportato i dati nel preventivo o in rubrica:
  -- un invio successivo a questa data è una correzione da guardare.
  acquisiti_il timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Un link per preventivo.
  unique (sezione, preventivo_id)
);

alter table public.dati_fatturazione enable row level security;

-- Ognuno vede e gestisce i link della propria sezione; eliminarli resta
-- all'admin della sezione.
drop policy if exists dati_fatt_read on public.dati_fatturazione;
create policy dati_fatt_read on public.dati_fatturazione for select
  using (public.accede_a(sezione));
drop policy if exists dati_fatt_insert on public.dati_fatturazione;
create policy dati_fatt_insert on public.dati_fatturazione for insert
  with check (public.accede_a(sezione));
drop policy if exists dati_fatt_update on public.dati_fatturazione;
create policy dati_fatt_update on public.dati_fatturazione for update
  using (public.accede_a(sezione)) with check (public.accede_a(sezione));
drop policy if exists dati_fatt_delete on public.dati_fatturazione;
create policy dati_fatt_delete on public.dati_fatturazione for delete
  using (public.e_admin_sezione(sezione));

-- Nel registro modifiche, come le altre tabelle di lavoro: anche gli invii
-- del cliente (che risultano senza utente, perché arrivano dal modulo).
do $$
begin
  if to_regprocedure('public.trg_registro()') is not null then
    drop trigger if exists on_dati_fatturazione_registro on public.dati_fatturazione;
    create trigger on_dati_fatturazione_registro after insert or update or delete on public.dati_fatturazione
      for each row execute procedure public.trg_registro();
  end if;
end $$;

comment on table public.dati_fatturazione is
  'Link mandati ai clienti con i preventivi, e i dati di fatturazione che i clienti vi hanno inserito';
