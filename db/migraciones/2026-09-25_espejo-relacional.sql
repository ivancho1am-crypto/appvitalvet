-- Migración aplicada el 2026-09-25 en Supabase wjzxdevrnzvgklapolve (Vitalvet Latam).
-- Acompaña al commit que agrega public/js/espejo.js (doble escritura).
--
-- Se deja aquí para que los cambios de base queden versionados junto al código:
-- hasta ahora solo existían aplicados en producción, sin rastro en el repo.
-- Ya está TODO aplicado; este archivo es el registro, no hace falta correrlo.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. El personal no podía escribir en tutores ni pacientes.
--    Solo existían políticas para que cada tutor viera LO SUYO. Sin esto, el
--    espejo falla. Se usa is_staff() (correo en `administradores` y activo),
--    el mismo criterio que ya protegía vv_store.
-- ─────────────────────────────────────────────────────────────────────────
create policy staff_todo_tutores on public.tutores
  for all to public using (is_staff()) with check (is_staff());

create policy staff_todo_pacientes on public.pacientes
  for all to public using (is_staff()) with check (is_staff());

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Agujero de seguridad en historia_clinica.
--    Las políticas usaban `get_my_tutor_id() IS NULL` como criterio de
--    "personal de la clínica". Como el registro de usuarios es abierto,
--    CUALQUIERA que creara una cuenta y no se vinculara a un tutor podía leer,
--    modificar y borrar historias clínicas ajenas.
--    Se reemplaza por is_staff(), conservando el acceso de cada tutor a las
--    historias de sus propias mascotas.
--
--    Efecto secundario descubierto al probar: con el criterio viejo, un
--    miembro del personal que además fuera cliente de la clínica (vinculado a
--    un tutor) NUNCA podía escribir historias. Le pasaba a Iván.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists write_historia        on public.historia_clinica;
drop policy if exists vet_update_historia   on public.historia_clinica;
drop policy if exists vet_delete_historia   on public.historia_clinica;
drop policy if exists tutor_read_own_historia on public.historia_clinica;

create policy historia_select on public.historia_clinica
  for select to public
  using (
    is_staff()
    or paciente_id in (select id from public.pacientes where tutor_id = get_my_tutor_id())
  );

create policy historia_insert on public.historia_clinica
  for insert to public
  with check (
    is_staff()
    or paciente_id in (select id from public.pacientes where tutor_id = get_my_tutor_id())
  );

create policy historia_update on public.historia_clinica
  for update to public using (is_staff()) with check (is_staff());

create policy historia_delete on public.historia_clinica
  for delete to public using (is_staff());

-- NOTA para quien venga después: la política de SELECT es imprescindible, no
-- opcional. El espejo inserta y luego pide la fila creada para confirmar; si
-- la política de lectura la oculta, PostgREST falla y la escritura se pierde.
-- Esto solo se detecta probando con una sesión real: con la clave de servicio
-- no se aplica RLS y todo parece funcionar.
