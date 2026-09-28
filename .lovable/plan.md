# Volver a un solo administrador (inventarioTI)

## Qué va a pasar
1. **Eliminar la cuenta de Juan Espinosa** (juanespinosa@finesa.com.co) y todo lo que cargó: 370 empleados, 118 catálogos (marcas, sedes, áreas, etc.) y su auxiliar (la cuenta del auxiliar también se borra). No tiene equipos ni actas.
2. **inventarioTI queda como único administrador**, con todos sus datos intactos.
3. **Regla permanente: solo puede existir un administrador.** La base de datos rechazará cualquier intento de crear un segundo administrador, incluso directamente en Supabase. Para cambiar de administrador habría que quitar primero el actual.
4. **Cédula vuelve a ser única en todo el sistema** (ya no por cuenta), eliminando el caso de cédulas repetidas al ingresar al portal.
5. La eliminación queda registrada en la auditoría.

Se mantiene la separación interna por cuenta (no afecta nada con un solo administrador y evita reescribir las reglas de acceso).

## Detalles técnicos
- Borrado con cliente admin, en orden: acta_items/tokens (ninguno), equipo_historial (n/a), empleados owner Juan (desvincular user_id y borrar sus usuarios auth de empleado si existen), catalogo_items owner Juan, user_permisos/user_roles/profiles del auxiliar y de Juan, luego `auth.admin.deleteUser` para ambos.
- Migración: índice único parcial `user_roles(role) where role='admin'`; reemplazar el índice `(owner_id, upper(identificacion))` por único global `upper(identificacion)` (verificar antes que no haya duplicados en inventarioTI).
- Actualizar AGENTS.md y memoria: "un solo administrador en todo el sistema".
- Verificar: conteo de admins = 1, Juan no puede iniciar sesión, inventarioTI ve sus datos.
