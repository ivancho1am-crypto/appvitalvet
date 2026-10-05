-- Auditoría de seguridad — deuda técnica #4 (docs/deuda-tecnica.md:
-- "auditar seguridad de las funciones SECURITY DEFINER antes de pensar en
-- exponer esto a más usuarios").
--
-- SOLO LECTURA. No modifica nada. Correr en Supabase > SQL Editor.
--
-- POR QUÉ ESTE ARCHIVO Y NO UN AUDIT AUTOMÁTICO: el método de lectura que
-- se usa en todo este proyecto (OpenAPI de PostgREST, vía curl con la
-- service key) solo expone tablas/vistas, no el código de las funciones
-- (pg_proc/information_schema.routines no están servidos por la API REST
-- — devuelven 404, verificado el 2026-10-05). Auditar esto requiere acceso
-- de SQL directo, que solo tienen Iván o ChatGPT (con acceso a Supabase).
--
-- CONTEXTO ENCONTRADO el 2026-10-05, al preparar este archivo: hay 16
-- funciones expuestas como RPC pública (PostgREST /rpc/*). Varias, por su
-- nombre, parecen tocar autenticación/identidad de usuarios — justo el
-- tipo de función que normalmente SOLO funciona si es SECURITY DEFINER
-- (un usuario común no podría, si no, confirmar el correo de otro o crear
-- un tutor para una cuenta ajena):
--
--   confirm_my_email, confirm_user_by_id, create_tutor_for_app_user,
--   upsert_tutor_for_app, link_to_vitalvet, get_my_tutor_id, is_staff,
--   rls_auto_enable, bridge_mas_to_pacientes, create_paciente_from_saas,
--   insert_paciente, check_rate_limit, jarvis_consulta, jarvis_insertar,
--   match_obsidian_chunks, search_similar_conversations
--
-- Esta lista es SOLO por nombre — ninguna se leyó ni se verificó todavía.

-- 1) Todas las funciones SECURITY DEFINER del esquema public, con su
--    definición completa (para leer qué hacen y decidir si cada una
--    realmente necesita ese privilegio).
select
  p.proname                          as funcion,
  pg_get_userbyid(p.proowner)        as dueño,
  p.prosecdef                        as es_security_definer,
  pg_get_functiondef(p.oid)          as definicion_completa
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by p.proname;

-- 2) Las 16 funciones expuestas como RPC pública (estén o no en la lista
--    de arriba) — para cruzar cuáles son SECURITY DEFINER Y además
--    públicamente invocables sin autenticación adicional.
select
  p.proname               as funcion,
  p.prosecdef             as es_security_definer,
  pg_get_function_identity_arguments(p.oid) as parametros,
  (select array_agg(r.rolname) from pg_roles r
    join pg_auth_members m on m.member = r.oid
    where m.roleid = (
      select grantee from information_schema.routine_privileges
      where routine_name = p.proname and privilege_type = 'EXECUTE' limit 1
    )
  ) as notas_roles
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'bridge_mas_to_pacientes','check_rate_limit','confirm_my_email',
    'confirm_user_by_id','create_paciente_from_saas','create_tutor_for_app_user',
    'get_my_tutor_id','insert_paciente','is_staff','jarvis_consulta',
    'jarvis_insertar','link_to_vitalvet','match_obsidian_chunks',
    'rls_auto_enable','search_similar_conversations','upsert_tutor_for_app'
  )
order by p.proname;

-- 3) Qué rol puede EJECUTAR cada una vía la API pública (anon = cualquiera
--    sin iniciar sesión, authenticated = cualquier usuario logueado).
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('anon', 'authenticated')
order by routine_name, grantee;

-- Qué buscar en los resultados:
--   - Funciones SECURITY DEFINER otorgadas a 'anon' (sin login) son las de
--     mayor riesgo: cualquiera en internet podría invocarlas.
--   - Si el cuerpo de la función no valida auth.uid() / el usuario que
--     llama antes de actuar, el SECURITY DEFINER le da más privilegio del
--     que debería tener quien la invoca.
--   - confirm_user_by_id / confirm_email suenan a que podrían confirmar
--     la cuenta de CUALQUIER usuario si no validan de algún modo que quien
--     llama es esa misma persona (o un administrador) — es la primera que
--     yo revisaría.
