-- ============================================================
--  PATCH 04/09/2026 — Due falle nei permessi sulla tabella profili
--  Da eseguire in Supabase > SQL Editor su un database gia' in uso.
--  Su un database nuovo non serve: schema.sql include gia' tutto.
-- ------------------------------------------------------------
--  1. Il flag "deve cambiare password" era scrivibile dal client.
--     La policy prof_update_self lasciava aggiornare qualunque colonna della
--     propria riga tranne il ruolo: un utente creato da un admin con password
--     provvisoria poteva quindi azzerare il flag con una singola chiamata REST
--     e continuare a usare quella password. Ora il flag lo spegne un trigger
--     su auth.users, che guarda l'hash della password vera, e la policy lo
--     congela insieme al ruolo.
--
--  2. Un super admin poteva nominarne un altro.
--     prof_admin_update controllava solo che non ci si declassasse da soli,
--     mentre il README dava per scontato che il ruolo di super admin si
--     assegnasse esclusivamente dal database. Adesso e' cosi' davvero.
-- ============================================================

-- ---------- 1. Il flag lo spegne la password, non il client ----------
create or replace function public.handle_password_changed()
returns trigger language plpgsql security definer as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    update public.profili set deve_cambiare_password = false where id = new.id;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row execute procedure public.handle_password_changed();

drop policy if exists prof_update_self on public.profili;
create policy prof_update_self on public.profili for update
  using (id = auth.uid())
  with check (id = auth.uid() and (ruolo, deve_cambiare_password) = (
    select p.ruolo, p.deve_cambiare_password from public.profili p where p.id = auth.uid()));

-- ---------- 2. Il super admin non nomina altri super admin ----------
drop policy if exists prof_admin_update on public.profili;
create policy prof_admin_update on public.profili for update
  using (public.e_super_admin())
  with check (public.e_super_admin() and case
    when id = auth.uid() then ruolo = 'super_admin'
    else ruolo <> 'super_admin'
  end);

-- ---------- Verifica ----------
-- Chi ha ancora il flag acceso (password provvisoria mai cambiata):
--   select email, deve_cambiare_password from public.profili
--   where deve_cambiare_password order by email;
-- Chi e' super admin (l'unico modo per aggiungerne uno resta questo file):
--   select email from public.profili where ruolo = 'super_admin';
