-- ============================================================
--  PATCH — La cancellazione dei preventivi di assistenza agli admin
--  Da eseguire nell'SQL Editor di Supabase del portale, dopo
--  patch-2026-09-02-assistenze.sql.
--
--  Fino a qui una sola policy "for all" dava lettura, scrittura E
--  cancellazione a chiunque avesse accesso alla sezione: un operatore poteva
--  eliminare definitivamente il preventivo preparato da un altro, e di un
--  preventivo eliminato non resta niente. Le altre operazioni restano come
--  prima — inserire e modificare sono il lavoro di tutti i giorni.
--
--  L'app nasconde il cestino a chi non è admin, ma quello è solo un modo di
--  non mettere in mano un pulsante che non funziona: la regola che conta è
--  questa qui.
-- ============================================================

drop policy if exists prev_ass_write on public.preventivi_assistenze;

drop policy if exists prev_ass_insert on public.preventivi_assistenze;
create policy prev_ass_insert on public.preventivi_assistenze for insert
  with check (public.accede_a('assistenze'));

drop policy if exists prev_ass_update on public.preventivi_assistenze;
create policy prev_ass_update on public.preventivi_assistenze for update
  using (public.accede_a('assistenze')) with check (public.accede_a('assistenze'));

drop policy if exists prev_ass_delete on public.preventivi_assistenze;
create policy prev_ass_delete on public.preventivi_assistenze for delete
  using (public.e_admin_sezione('assistenze'));

-- La policy di lettura (prev_ass_read) resta invariata, come quelle delle
-- impostazioni: il tariffario è un parametro del lavoro quotidiano e lo
-- tocca anche l'operatore.
