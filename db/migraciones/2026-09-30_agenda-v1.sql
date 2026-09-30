-- Agenda v1 — extiende la tabla `citas`, que ya existía en Supabase con
-- 0 filas y sin ningún código que la usara (probablemente diseñada para un
-- flujo de WhatsApp/n8n que nunca se activó). No se crea tabla nueva.
--
-- Por qué extender y no crear otra tabla:
--   citas ya tiene la forma correcta (fecha_hora, duracion_min, estado,
--   servicio, google_event_id, reminder_sent) y YA está protegida con la
--   misma política is_staff() que usa el resto del sistema — cero trabajo
--   de seguridad adicional. Le falta una sola cosa: conectarse de verdad
--   con tutores/pacientes en vez de guardarlos como texto suelto.
--
-- Riesgo: ninguno. La tabla está vacía y ningún archivo del repo la
-- referencia (verificado con grep antes de escribir esto). Las columnas
-- nuevas son opcionales: no rompen ningún insert que ya existiera.

-- 1) Enlace real con las entidades reales del sistema.
--    phone/tutor_name/mascota_nombre se QUEDAN tal cual: sirven para una
--    cita de alguien que aún no está registrado (ej. llega por WhatsApp
--    antes de tener tutor_id). No son redundantes, son el caso sin registro.
alter table public.citas add column if not exists tutor_id    uuid references public.tutores(id);
alter table public.citas add column if not exists paciente_id uuid references public.pacientes(id);

-- 2) El valor por defecto de `estado` era 'confirmada'. Para el flujo v1
--    (programada → confirmada → atendida | cancelada | no_asistio) el punto
--    de partida correcto es 'programada'. Como la tabla está vacía y ningún
--    proceso activo inserta hoy en `citas` (los flujos de n8n que la usarían
--    están apagados), este cambio no afecta ninguna fila existente ni ningún
--    proceso en marcha.
alter table public.citas alter column estado set default 'programada';

-- 3) Índices para las consultas que va a hacer la UI de Agenda: "citas de
--    este paciente" y "citas de este tutor".
create index if not exists idx_citas_paciente on public.citas(paciente_id);
create index if not exists idx_citas_tutor    on public.citas(tutor_id);

-- VERIFICACIÓN — debe devolver 2 filas (tutor_id, paciente_id) y decir
-- 'programada' como valor por defecto de estado.
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'citas'
   and column_name in ('tutor_id', 'paciente_id', 'estado')
 order by column_name;
