-- ============================================================
--  PATCH — Patenti: chi ha modificato una richiesta lo scrive il database
--  Data: 2026-11-07
--
--  `updated_by` lo mandava il browser, e il permesso di colonna
--  (grant update ... updated_by) gli lasciava scrivere qualunque utente.
--  Adesso un trigger lo sovrascrive con chi ha davvero fatto la modifica
--  (auth.uid()), come per le proposte di pagamento
--  (patch-2026-10-18-stato-e-autori.sql). Il service role (auth.uid()
--  nullo: script, ripristini) resta libero.
--
--  Il codice del portale continua a mandarlo: senza questa patch tutto
--  funziona come prima, con questa il valore del browser non conta più.
--
--  È idempotente.
-- ============================================================

create or replace function public.trg_richieste_patenti_autore()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end; $$;

drop trigger if exists on_richieste_patenti_autore on public.richieste_patenti;
create trigger on_richieste_patenti_autore
  before update on public.richieste_patenti
  for each row execute procedure public.trg_richieste_patenti_autore();
