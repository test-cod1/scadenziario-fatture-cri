-- ============================================================
--  PATCH — Da "Scadenziario" a "Amministrazione CRI" (portale multi-sezione)
--  Eseguire per intero nell'SQL Editor di Supabase, una sola volta.
--
--  Cosa cambia:
--   * public.profili.ruolo cambia significato: da ruolo DENTRO lo
--     scadenziario a ruolo DI PORTALE ('super_admin' | 'utente' | 'in_attesa').
--   * i ruoli di sezione (operatore/admin) si spostano nella nuova tabella
--     public.autorizzazioni, una riga per ogni coppia utente+sezione.
--   * le funzioni storiche puo_leggere()/puo_scrivere()/e_admin() restano,
--     ma diventano scorciatoie per "…nella sezione scadenziario": così tutte
--     le policy già scritte sulle tabelle delle fatture continuano a valere
--     senza essere riscritte una per una.
--
--  La migrazione conserva i permessi attuali: chi oggi è admin o operatore
--  diventa admin/operatore DELLO SCADENZIARIO e di nessun'altra sezione.
-- ============================================================

-- ---------- ELENCO DELLE SEZIONI ----------
-- Sta a database (e non solo nel codice) perché le autorizzazioni vi fanno
-- riferimento con una chiave esterna: una sezione scritta male in un insert
-- viene rifiutata, invece di creare un permesso che non porta da nessuna parte.
create table if not exists public.sezioni (
  id text primary key,
  etichetta text not null,
  ordine int not null default 0
);

insert into public.sezioni (id, etichetta, ordine) values
  ('scadenziario', 'Scadenziario',          1),
  ('formazione',   'Formazione Esterna',    2),
  ('trasporti',    'Trasporti lunghi',      3),
  ('assistenze',   'Assistenze sanitarie',  4)
on conflict (id) do update set etichetta = excluded.etichetta, ordine = excluded.ordine;

-- ---------- AUTORIZZAZIONI (utente × sezione × ruolo) ----------
-- L'assenza di riga significa "nessun accesso": non serve un ruolo "nessuno",
-- e revocare un permesso è una delete, non un valore speciale da gestire
-- ovunque.
create table if not exists public.autorizzazioni (
  utente_id uuid not null references auth.users(id) on delete cascade,
  sezione   text not null references public.sezioni(id) on delete cascade,
  ruolo     text not null default 'operatore' check (ruolo in ('operatore','admin')),
  assegnata_da uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  primary key (utente_id, sezione)
);
create index if not exists idx_autorizzazioni_utente on public.autorizzazioni(utente_id);

-- ---------- MIGRAZIONE DEI RUOLI ESISTENTI ----------
-- Prima si copiano i ruoli attuali nelle autorizzazioni, poi si cambia il
-- dominio di profili.ruolo: invertendo l'ordine il dato andrebbe perso.
insert into public.autorizzazioni (utente_id, sezione, ruolo)
  select id, 'scadenziario', ruolo from public.profili where ruolo in ('admin','operatore')
on conflict (utente_id, sezione) do nothing;

alter table public.profili drop constraint if exists profili_ruolo_check;
update public.profili set ruolo = 'utente' where ruolo in ('admin','operatore');
alter table public.profili
  add constraint profili_ruolo_check check (ruolo in ('super_admin','utente','in_attesa'));

-- ⚠️ IL SUPER ADMIN VA NOMINATO A MANO: è l'unico ruolo che non si può
-- assegnare dall'app (chi può creare super admin potrebbe altrimenti
-- auto-promuoversi). Cambia l'email se l'account principale è un altro.
update public.profili set ruolo = 'super_admin'
  where lower(email) = 'jacopo.ravaioli@liguria.cri.it';

-- ---------- FUNZIONI DI CONTROLLO ACCESSI ----------
-- Tutte security definer: leggono profili/autorizzazioni scavalcando le RLS,
-- altrimenti una policy che chiama la funzione che rilegge la stessa tabella
-- girerebbe su se stessa.
create or replace function public.e_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profili where id = auth.uid() and ruolo = 'super_admin');
$$;

-- Ruolo dell'utente corrente nella sezione indicata: 'admin', 'operatore'
-- oppure NULL se non vi ha accesso. Il super admin è admin ovunque.
create or replace function public.ruolo_sezione(p_sezione text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.profili where id = auth.uid() and ruolo = 'super_admin') then 'admin'
    else (select a.ruolo from public.autorizzazioni a
          where a.utente_id = auth.uid() and a.sezione = p_sezione)
  end;
$$;

create or replace function public.accede_a(p_sezione text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ruolo_sezione(p_sezione) is not null;
$$;

create or replace function public.e_admin_sezione(p_sezione text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ruolo_sezione(p_sezione) = 'admin';
$$;

-- Le tre funzioni storiche restano in vita come sinonimi di "…nello
-- scadenziario": decine di policy già scritte le richiamano e non hanno
-- bisogno di sapere che nel frattempo è nato un portale attorno.
create or replace function public.puo_leggere()
returns boolean language sql stable security definer set search_path = public as $$
  select public.accede_a('scadenziario');
$$;

create or replace function public.puo_scrivere()
returns boolean language sql stable security definer set search_path = public as $$
  select public.accede_a('scadenziario');
$$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.e_admin_sezione('scadenziario');
$$;

-- ---------- RLS DELLE NUOVE TABELLE ----------
alter table public.sezioni        enable row level security;
alter table public.autorizzazioni enable row level security;

-- L'elenco delle sezioni non è un dato riservato (sono gli stessi nomi che si
-- leggono in home): serve a chiunque abbia fatto il login per disegnare il
-- menu, comprese le card bloccate.
drop policy if exists sezioni_read on public.sezioni;
create policy sezioni_read on public.sezioni for select to authenticated using (true);

-- Ognuno legge i propri permessi (l'app li usa per capire cosa mostrare);
-- il super admin li legge e li scrive tutti.
drop policy if exists autor_self on public.autorizzazioni;
create policy autor_self on public.autorizzazioni for select using (utente_id = auth.uid());
drop policy if exists autor_sa_read on public.autorizzazioni;
create policy autor_sa_read on public.autorizzazioni for select using (public.e_super_admin());
drop policy if exists autor_sa_write on public.autorizzazioni;
create policy autor_sa_write on public.autorizzazioni for all
  using (public.e_super_admin()) with check (public.e_super_admin());

-- ---------- PROFILI: la gestione utenti passa al super admin ----------
-- Prima erano gli admin (cioè, di fatto, gli admin dello scadenziario) a
-- vedere e modificare i profili altrui: ora che gli admin sono di sezione non
-- avrebbe più senso, un admin della formazione non deve poter toccare i
-- permessi di nessun altro.
drop policy if exists prof_admin_read on public.profili;
create policy prof_admin_read on public.profili for select using (public.e_super_admin());
drop policy if exists prof_admin_update on public.profili;
create policy prof_admin_update on public.profili for update
  using (public.e_super_admin())
  with check (public.e_super_admin() and (id <> auth.uid() or ruolo = 'super_admin'));

-- ============================================================
--  DOPO L'ESECUZIONE, verifica con:
--    select email, ruolo from public.profili order by ruolo;
--    select p.email, a.sezione, a.ruolo from public.autorizzazioni a
--      join public.profili p on p.id = a.utente_id order by p.email;
--  Deve esserci almeno un profilo 'super_admin' (il tuo) e tutti i vecchi
--  admin/operatore devono comparire sulla sezione 'scadenziario'.
-- ============================================================
