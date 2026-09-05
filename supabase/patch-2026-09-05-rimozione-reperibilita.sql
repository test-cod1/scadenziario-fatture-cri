-- ============================================================
--  PATCH — Via il tipo "reperibilità" dagli straordinari
--  Data: 2026-09-05
--
--  I tipi di riga restano tre: straordinario, cambio turno (entrambi ore
--  in più, segno +) e recupero (ore restituite, segno −). La reperibilità
--  non era una quarta cosa: le ore effettivamente prestate su chiamata
--  sono straordinario a tutti gli effetti, e contavano già con lo stesso
--  segno.
--
--  Da eseguire insieme al deploy del codice che toglie la voce dal menu a
--  tendina. Se restasse solo il vincolo vecchio non si romperebbe nulla
--  (accetterebbe un valore che l'app non propone più), ma il registro
--  potrebbe conservare righe di un tipo che l'interfaccia non sa più
--  mostrare.
--
--  È idempotente.
-- ============================================================

-- Le righe già registrate come reperibilità diventano straordinari. Il
-- segno è lo stesso (+1), quindi nessun totale mensile cambia: cambia
-- l'etichetta con cui la riga compare nel registro. La causale, se c'era,
-- resta e continua a raccontare di che chiamata si trattava.
do $$
declare quante int;
begin
  update public.straordinari
     set tipo = 'straordinario',
         causale = coalesce(nullif(btrim(causale), ''), 'Chiamata in reperibilità')
   where tipo = 'reperibilita';

  get diagnostics quante = row_count;
  if quante > 0 then
    raise notice 'Righe convertite da reperibilità a straordinario: %', quante;
  end if;
end $$;

-- Rifatto il vincolo con i soli tre tipi rimasti.
alter table public.straordinari drop constraint if exists straordinari_tipo_check;
alter table public.straordinari add constraint straordinari_tipo_check
  check (tipo in ('straordinario', 'recupero', 'cambio_turno'));

-- ---------- VERIFICA ----------
-- Non deve comparire nessuna riga di tipo 'reperibilita'.
select tipo, count(*) as righe
  from public.straordinari
 group by tipo
 order by tipo;
