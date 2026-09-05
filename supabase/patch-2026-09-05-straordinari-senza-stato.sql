-- ============================================================
--  PATCH — Via lo stato e il "richiesto da" dagli straordinari
--  Data: 2026-09-05
--
--  Il registro non segue una pratica dalla richiesta alla liquidazione:
--  le righe si scrivono a cose fatte, a fine turno. Lo stato
--  (richiesto → confermato → liquidato, più annullato) descriveva un
--  percorso che qui non esiste, e "richiesto da" era il nome di chi
--  stava scrivendo, ricopiato su ogni riga senza che nessuno lo
--  rileggesse. Restano i fatti: chi, quando, quante ore, di che tipo e
--  per quale motivo.
--
--  Sparisce con loro la chiusura del mese, che serviva solo a portare le
--  righe confermate a "liquidato".
--
--  Da eseguire insieme al deploy: l'app non scrive più queste colonne, e
--  `stato` era NOT NULL con un default, quindi finché la patch non gira
--  gli inserimenti continuano a funzionare (le righe nascono
--  "richiesto") ma il registro non mostra più quell'informazione.
--
--  ATTENZIONE: elimina definitivamente due colonne e i dati che
--  contengono. Se ti serve conservare chi aveva chiesto cosa, copia la
--  tabella prima di eseguire:
--    create table straordinari_backup_20260905 as select * from public.straordinari;
--
--  È idempotente.
-- ============================================================

-- Le righe annullate erano l'unico caso in cui lo stato cambiava il
-- risultato: restavano scritte ma fuori da ogni totale. Senza lo stato
-- non c'è più modo di distinguerle, e lasciarle dentro gonfierebbe i
-- conteggi dei mesi già chiusi con ore che nessuno ha fatto. Si
-- eliminano, che è quello che oggi si fa a una riga sbagliata.
do $$
declare quante int;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'straordinari'
                and column_name = 'stato') then
    delete from public.straordinari where stato = 'annullato';
    get diagnostics quante = row_count;
    if quante > 0 then
      raise notice 'Righe annullate eliminate: %', quante;
    end if;
  end if;
end $$;

alter table public.straordinari drop constraint if exists straordinari_stato_check;
alter table public.straordinari drop column if exists stato;
alter table public.straordinari drop column if exists richiesto_da;
alter table public.straordinari drop column if exists richiesto_da_nome;

drop index if exists public.idx_straord_stato;

-- ---------- VERIFICA ----------
-- Fra le colonne non devono più comparire stato, richiesto_da,
-- richiesto_da_nome.
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'straordinari'
 order by ordinal_position;
