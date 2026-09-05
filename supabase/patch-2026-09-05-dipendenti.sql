-- ============================================================
--  PATCH — Da "autisti" a "dipendenti" nella sezione Straordinari,
--          più il caricamento dell'elenco del personale
--  Data: 2026-09-05
--
--  Gli straordinari non riguardano solo chi guida: il registro serve per
--  tutti i dipendenti del Comitato, ed è il termine usato anche dal
--  foglio da cui la sezione è nata ("ELENCO DIPENDENTI-ORARI MESE"). Qui
--  si rinominano tabella e colonne di conseguenza, e si carica l'elenco
--  delle 19 persone in servizio.
--
--  Va eseguita INSIEME al deploy del codice che la usa: tra i due
--  passaggi la sezione Straordinari non funziona, perché l'app cerca
--  tabelle e colonne con il nome nuovo. Le altre sezioni non sono
--  toccate.
--
--  È idempotente: su un database creato da schema.sql aggiornato, dove i
--  nomi sono già quelli nuovi, la prima parte non fa nulla e resta solo
--  l'inserimento dell'elenco (che a sua volta salta chi c'è già).
-- ============================================================

-- ---------- 1. RINOMINA ----------
-- Si rinomina solo se c'è ancora il nome vecchio, così rilanciare la
-- patch (o eseguirla su un database nuovo) non produce errori.
do $$
begin
  if to_regclass('public.autisti_straordinari') is not null
     and to_regclass('public.dipendenti_straordinari') is null then
    alter table public.autisti_straordinari rename to dipendenti_straordinari;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'straordinari'
                and column_name = 'autista_id') then
    alter table public.straordinari rename column autista_id to dipendente_id;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'straordinari'
                and column_name = 'autista_nome') then
    alter table public.straordinari rename column autista_nome to dipendente_nome;
  end if;
end $$;

-- Gli indici seguono la tabella ma si portano dietro il vecchio nome:
-- rinominarli evita di ritrovarsi fra un anno un idx_autisti_* su una
-- tabella che non si chiama più così.
alter index if exists idx_autisti_str_nominativo rename to idx_dipendenti_str_nominativo;
alter index if exists idx_autisti_str_attivo     rename to idx_dipendenti_str_attivo;
alter index if exists idx_straord_autista        rename to idx_straord_dipendente;

-- Le policy invece non si rinominano: si ricreano con il nome nuovo e si
-- buttano quelle vecchie, che resterebbero attive sotto il vecchio nome.
drop policy if exists autisti_str_read  on public.dipendenti_straordinari;
drop policy if exists autisti_str_write on public.dipendenti_straordinari;

drop policy if exists dipendenti_str_read on public.dipendenti_straordinari;
create policy dipendenti_str_read on public.dipendenti_straordinari for select
  using (public.accede_a('straordinari'));
drop policy if exists dipendenti_str_write on public.dipendenti_straordinari;
create policy dipendenti_str_write on public.dipendenti_straordinari for all
  using (public.accede_a('straordinari')) with check (public.accede_a('straordinari'));

comment on table public.dipendenti_straordinari is
  'Dipendenti a cui si possono richiedere straordinari, con le ore settimanali di contratto';
comment on table public.straordinari is
  'Registro degli straordinari richiesti ai dipendenti dalla centrale operativa';

-- ---------- 2. ELENCO DEL PERSONALE ----------
-- Dall'elenco dipendenti del 05/09/2026. Le ore settimanali di contratto
-- restano vuote di proposito: il foglio di partenza non le riportava, e
-- attribuire a qualcuno un orario sbagliato è peggio che non averlo. Si
-- compilano dalla scheda di ciascuno, in Straordinari → Dipendenti.
--
-- L'indice unico su cognome+nome fa sì che rilanciare la patch non crei
-- doppioni, e che non si sovrascriva chi fosse già stato inserito a mano.
insert into public.dipendenti_straordinari (cognome, nome) values
  ('Aiello',         'Fabrizio'),
  ('Bassino',        'Maria Rita'),
  ('Bastia',         'Alessandro'),
  ('Bisignani',      'Roberto'),
  ('Canepa',         'Sabrina'),
  ('Cuevas',         'Maria Florencia'),
  ('De Barbieri',    'Tommaso'),
  ('Djeffal',        'Francesca'),
  ('Garibaldi',      'Sergio Giuseppe'),
  ('Grimaldi',       'Francesco'),
  ('Ministeri',      'Francesca'),
  ('Munoz Chicaiza', 'Stalin Milton'),
  ('Nayyab',         'Duray'),
  ('Pascu',          'Alex Gabriel'),
  ('Pazzano',        'Daniele'),
  ('Pellegrini',     'Sara'),
  ('Picollo',        'Matilde'),
  ('Portorico',      'Arturo'),
  ('Sordelli',       'Michele Antonio')
on conflict do nothing;

-- ---------- VERIFICA ----------
-- Devono uscire 19 righe (o più, se ne avevi già inserite altre a mano).
select cognome, nome, ore_contratto, attivo
  from public.dipendenti_straordinari
 order by cognome, nome;
