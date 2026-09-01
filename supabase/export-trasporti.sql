-- ============================================================
--  TRAVASO DEI DATI dal vecchio gestionale preventivo-trasporti
--
--  ⚠️ Questo file NON va eseguito sul database del portale: si lancia
--  sull'SQL Editor del VECCHIO progetto Supabase (qgqjczswthmfxltztmgi),
--  quello del sito preventivo-trasporti.pages.dev.
--
--  Non sposta niente da solo: STAMPA il testo di tutti gli insert già
--  pronti. Il risultato è una sola cella di testo, da copiare e incollare
--  nell'SQL Editor del portale (dopo aver eseguito lì
--  patch-2026-09-01-trasporti.sql, che crea le tabelle di destinazione).
--
--  Perché in questo modo e non con un dump: i due progetti Supabase sono
--  separati e non si parlano, e gli id degli utenti del vecchio progetto non
--  esistono in quello nuovo — quindi "chi ha creato il preventivo" viene
--  travasato come email (colonna created_by_email) invece che come
--  riferimento a un utente che di là non c'è.
-- ============================================================

-- ---------- 1. IMPOSTAZIONI (parametri di calcolo, mezzi, carburanti) ----------
select coalesce(string_agg(riga, E'\n'), '-- nessuna impostazione salvata') as da_incollare
from (
  select format(
    'insert into public.impostazioni_trasferte (id, dati, updated_at) values (%L, %L::jsonb, %L) on conflict (id) do update set dati = excluded.dati, updated_at = excluded.updated_at;',
    i.id, i.dati, i.updated_at) as riga
  from public.impostazioni_trasferte i
) t;

-- ---------- 2. PREVENTIVI ----------
-- Gli id restano gli stessi del vecchio database: se per qualunque motivo
-- l'importazione va rifatta, "on conflict do nothing" evita di creare doppioni.
select coalesce(string_agg(riga, E'\n'), '-- nessun preventivo da migrare') as da_incollare
from (
  select format(
    'insert into public.preventivi (id, titolo, cliente, data_servizio, stato, note, tappe, andata_ritorno, km_auto, km_totali, paese_dest, paese_dest_nome, input, risultato, created_by_email, created_at, updated_at) values (%L, %L, %L, %L, %L, %L, %L::jsonb, %L, %L, %L, %L, %L, %L::jsonb, %L::jsonb, %L, %L, %L) on conflict (id) do nothing;',
    p.id, p.titolo, p.cliente, p.data_servizio, p.stato, p.note, p.tappe,
    p.andata_ritorno, p.km_auto, p.km_totali, p.paese_dest, p.paese_dest_nome,
    p.input, p.risultato, pr.email, p.created_at, p.updated_at) as riga
  from public.preventivi p
  left join public.profili pr on pr.id = p.created_by
  order by p.created_at
) t;

-- ---------- 3. CONTROLLO ----------
-- Da rilanciare sul portale dopo l'importazione: i due numeri devono
-- coincidere con quelli che questa query dà qui.
--   select count(*) as preventivi from public.preventivi;
--   select count(*) as impostazioni from public.impostazioni_trasferte;
