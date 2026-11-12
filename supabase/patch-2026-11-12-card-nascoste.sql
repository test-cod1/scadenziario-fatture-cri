-- ============================================================
--  PATCH — CARD DELLA HOME NASCOSTE A CHI NON È ABILITATO
--  Data: 2026-11-12
--
--  La home mostra tutte le sezioni, anche quelle chiuse (col lucchetto), così
--  si sa che esistono e a chi chiedere. Per alcune non serve che si sappia:
--  il super admin può spegnerne la card per chi non vi è abilitato, con
--  l'occhio sulla card in home. Chi è abilitato continua a vederla.
--
--  È solo una scelta di cosa disegnare: la protezione dei dati resta quella
--  delle autorizzazioni e delle RLS, che non cambiano.
--
--  È idempotente. Da eseguire nell'SQL Editor PRIMA di pubblicare il codice
--  (il codice regge anche senza: in quel caso le card restano tutte visibili).
-- ============================================================

alter table public.sezioni add column if not exists nascosta boolean not null default false;

-- Solo il super admin cambia la visibilità, e solo quella: etichetta e ordine
-- restano del codice e dell'SQL Editor.
revoke update on public.sezioni from authenticated;
grant update (nascosta) on public.sezioni to authenticated;
drop policy if exists sezioni_sa_update on public.sezioni;
create policy sezioni_sa_update on public.sezioni for update to authenticated
  using (public.e_super_admin()) with check (public.e_super_admin());

-- ---------- VERIFICA ----------
select id, etichetta, nascosta from public.sezioni order by ordine;
