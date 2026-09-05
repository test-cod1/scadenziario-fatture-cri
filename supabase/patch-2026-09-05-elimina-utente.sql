-- ============================================================
--  PATCH — Eliminazione definitiva di un utente dal portale
--  Data: 2026-09-05
--
--  Serve all'endpoint /api/elimina-utente (Utenti e autorizzazioni →
--  Elimina). Senza questa patch l'eliminazione FALLISCE non appena la
--  persona ha inserito anche una sola riga: quasi tutte le tabelle hanno
--  una colonna `created_by` (e simili: proposta_da, decisa_da,
--  richiesto_da, assegnata_da) che punta ad auth.users senza regola di
--  cancellazione, quindi il database rifiuta di cancellare un utente
--  ancora referenziato.
--
--  Cosa fa: porta tutte quelle chiavi esterne a ON DELETE SET NULL.
--  I dati restano — fatture, assistenze, trasporti, straordinari,
--  proposte: nessuna riga viene cancellata — e perdono soltanto il
--  collegamento all'account eliminato, che diventa vuoto.
--
--  Cosa NON tocca:
--    · profili.id e autorizzazioni.utente_id, già ON DELETE CASCADE:
--      profilo e permessi devono sparire insieme all'account, ed è
--      giusto così.
--    · log_modifiche / log_modifiche_attive: non hanno chiave esterna e
--      conservano email e nome come testo, quindi il registro continua a
--      dire chi ha fatto cosa anche dopo l'eliminazione.
--
--  È idempotente: rilanciarla non fa nulla, perché le chiavi già
--  sistemate non rientrano più nella selezione.
-- ============================================================

do $$
declare
  r record;
  quante int := 0;
begin
  for r in
    select c.conname,
           c.conrelid::regclass::text as tabella,
           a.attname                  as colonna
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum   = c.conkey[1]
     where c.contype     = 'f'
       and c.confrelid   = 'auth.users'::regclass
       and c.connamespace = 'public'::regnamespace
       and array_length(c.conkey, 1) = 1   -- solo chiavi su una colonna
       and c.confdeltype in ('a', 'r')     -- oggi NO ACTION o RESTRICT
       and not a.attnotnull                -- la colonna deve poter diventare NULL
  loop
    execute format('alter table %s drop constraint %I', r.tabella, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
      r.tabella, r.conname, r.colonna);
    raise notice 'Aggiornata %.% → on delete set null', r.tabella, r.colonna;
    quante := quante + 1;
  end loop;

  raise notice 'Chiavi esterne sistemate: %', quante;
end $$;

-- ------------------------------------------------------------
--  Verifica: dopo la patch questa query non deve restituire righe
--  con azione 'a' o 'r' su colonne nullable. Le uniche 'c' (cascade)
--  attese sono profili.id e autorizzazioni.utente_id.
-- ------------------------------------------------------------
select c.conrelid::regclass as tabella,
       a.attname            as colonna,
       case c.confdeltype
         when 'a' then 'no action'
         when 'r' then 'restrict'
         when 'c' then 'cascade'
         when 'n' then 'set null'
         when 'd' then 'set default'
       end                  as alla_cancellazione
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
   and a.attnum   = c.conkey[1]
 where c.contype      = 'f'
   and c.confrelid    = 'auth.users'::regclass
   and c.connamespace = 'public'::regnamespace
 order by 1, 2;
