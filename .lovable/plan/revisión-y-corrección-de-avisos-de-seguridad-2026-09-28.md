# Revisión y corrección de avisos de seguridad

El escaneo muestra dos grupos de avisos (ninguno crítico; no hay paquetes vulnerables):

## 1. Funciones internas ejecutables por usuarios con sesión (14 avisos)

La mayoría son **intencionales**: las reglas de acceso (RLS) las necesitan para decidir quién ve qué (`has_role`, `has_permiso`, `is_active`, `is_staff`, `my_owner_id`, `my_empleado_id`, `panel_conteos`). Quitarles el acceso rompería la aplicación.

Acciones:
- **Revisar una por una** las 14 funciones y clasificarlas:
  - *Necesarias para las reglas de acceso* → se marcan como revisadas/intencionales.
  - *Funciones de acción que no deberían llamarse directamente* (p. ej. triggers internos como `audit_trigger`, `equipos_after_update`, `handle_new_user`, `rls_auto_enable`) → se les quita el permiso de ejecución a usuarios con sesión (REVOKE EXECUTE), porque solo las llama la base de datos.
- Verificar que las funciones de acción sensibles (`anular_acta`, `cambiar_estado_equipo`, `corregir_serie`, `finalizar_reparacion`, `asignar_carga_inicial`) ya validan rol/permiso por dentro — lo hacen, pero se confirma en la revisión.

## 2. Protección contra contraseñas filtradas desactivada

Supabase puede rechazar contraseñas que aparecen en filtraciones conocidas (HaveIBeenPwned).
- **No se puede activar desde aquí**: es un interruptor en el panel de Supabase (Authentication → Password Security).
- Se le indica al usuario el paso exacto para activarlo (un clic, sin costo).

## Resultado esperado

- Las funciones puramente internas dejan de ser llamables por usuarios con sesión.
- Las funciones que las reglas de acceso necesitan quedan documentadas como intencionales.
- El usuario activa la protección de contraseñas filtradas con una guía de un paso.

## Detalles técnicos

- Migración SQL: `REVOKE EXECUTE ON FUNCTION <nombre> FROM authenticated` solo para funciones de trigger e internas que no usa ninguna política RLS ni la app.
- No se toca ninguna función usada en políticas RLS (rompería el acceso).
- Sin cambios en el código de la aplicación.
