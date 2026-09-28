# Nuevo administrador con ecosistema propio (multi-cuenta)

## Objetivo
Crear la cuenta de administrador **juanespinosa@finesa.com.co** y que cada administrador tenga su propio ecosistema aislado: sus empleados, equipos, actas, catálogos, auxiliares y auditoría. La cuenta actual (inventarioTI) conserva todo lo que ya cargó; la nueva empieza vacía. Ninguna cuenta ve los datos de la otra.

## 1. Crear la cuenta del nuevo administrador
- Usuario en Supabase Auth: juanespinosa@finesa.com.co / contraseña indicada, con perfil y rol `admin` (por SQL, como siempre; la app nunca crea administradores).
- La cuenta inventarioTI no se toca: conserva sus empleados, inventario, auxiliares y actas.

## 2. Aislamiento de datos por administrador (migración)
Hoy las reglas de acceso dejan ver todo a cualquier persona del personal (`is_staff`). Se cambia a un modelo de "ecosistema por administrador":

- Nueva columna `owner_id` (el administrador dueño del dato) en: `empleados`, `equipos`, `actas`, `catalogo_items`.
- Todo lo existente queda asignado a inventarioTI (es su carga). Lo que cree Juan Espinosa queda con su propio `owner_id`.
- Los auxiliares quedan ligados al administrador que los creó (columna `owner_id` en `user_roles` para el rol auxiliar).
- Nuevas funciones de acceso:
  - `my_owner_id()`: si soy admin, mi propio id; si soy auxiliar, el id de mi administrador.
  - Las reglas de visibilidad pasan de `is_staff()` a "personal del mismo ecosistema": el admin y sus auxiliares ven solo los datos con su `owner_id`.
- Se actualizan las políticas de `empleados`, `equipos`, `actas`, `acta_items`, `catalogo_items`, `equipo_historial` y `auditoria` (cada admin ve solo su auditoría).
- El portal del empleado no cambia: cada empleado sigue viendo solo lo suyo.

## 3. Regla "un solo admin por ecosistema"
- Trigger en `user_roles`: rechaza asignar el rol `admin` cuando la operación viene de un usuario de la app (solo se permite vía SQL directo en Supabase, como ya es la regla). Así, desde la cuenta de un administrador es imposible crear otro administrador.
- La app ya no ofrece crear admins; esto lo refuerza a nivel de base de datos.

## 4. Ajustes en la aplicación
- Al crear empleados, equipos, actas, catálogos o auxiliares, se guarda automáticamente el `owner_id` del administrador del usuario actual (por defecto en base de datos, sin que el usuario lo elija).
- "Usuarios y permisos": cada admin ve y gestiona solo sus auxiliares.
- Reportes, panel, repositorio y carga masiva quedan automáticamente acotados al ecosistema del usuario conectado.
- La carga masiva del nuevo admin crea sus propios catálogos aunque los nombres coincidan con los de otra cuenta (las listas maestras también son por ecosistema).

## Detalles técnicos
- Migración: `ALTER TABLE ... ADD COLUMN owner_id uuid` en las 4 tablas + `user_roles`; backfill con el id de inventarioTI (62b3c312-48bf-4b96-878b-3f810029619c); índices por `owner_id`; reescritura de las políticas RLS afectadas; función `my_owner_id()` security definer; trigger `solo_sql_crea_admin` en `user_roles` (rechaza rol admin si `auth.uid()` no es null, es decir, si viene de la app).
- Catálogos: el índice único de nombre pasa de `(tipo, upper(nombre))` a `(tipo, owner_id, upper(nombre))` para que cada ecosistema tenga sus listas.
- Creación de la cuenta: Auth Admin API con la llave de servicio (mismo procedimiento usado para inventarioTI) + inserción del rol por SQL.
- Verificación: entrar como Juan Espinosa (panel vacío, sin datos de inventarioTI), crear un auxiliar y un equipo de prueba, y confirmar que desde inventarioTI no se ven; y viceversa.
