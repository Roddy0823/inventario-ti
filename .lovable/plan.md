# Equipos en reparación y dados de baja

## Qué pasa hoy
Cuando un equipo pasa a "En reparación" o "De baja", el sistema lo desliga del empleado. Por eso el empleado deja de verlo en su portal y en el inventario ya no se sabe a quién pertenecía.

## Qué vamos a hacer

1. **El equipo en reparación sigue ligado al empleado**
   - Al pasar a "En reparación" se conserva el responsable (el motivo queda en el historial, como hoy).
   - Nueva acción **"Finalizar reparación"** con dos opciones:
     - *Devolver al empleado*: vuelve a "Asignado" al mismo empleado, sin acta nueva (queda en el historial y la auditoría).
     - *Dejar disponible*: pasa a "Disponible" y se desliga del empleado.
   - Mientras está en reparación no se puede incluir en actas de entrega ni devolución.

2. **Portal del empleado**
   - Aviso destacado arriba: "Tienes X equipo(s) en reparación" con tipo, marca, serie, fecha de envío y motivo.
   - En "Mis equipos" esos equipos aparecen con la etiqueta "En reparación".

3. **Nueva sección en Inventario** (pestañas en la página de equipos)
   - **Activos** (lo de hoy), **En reparación** y **Dados de baja**.
   - En reparación: equipo, serie, empleado ligado (con enlace), desde cuándo, motivo y botón "Finalizar reparación".
   - Dados de baja: equipo, serie, último responsable, fecha de baja, motivo y quién la hizo.
   - Contador en cada pestaña y exportación a Excel.

4. **De baja**: se mantiene la regla actual (se desliga del empleado), pero se muestra el último responsable tomado del historial.

## Detalles técnicos
- Migración: `cambiar_estado_equipo` conserva `empleado_id` cuando `p_estado = 'en_reparacion'`; nueva RPC `finalizar_reparacion(p_equipo, p_devolver boolean, p_motivo)` con permiso `equipos_editar`, usando el contexto `app.estado_ok` / `app.hist_evento` para el historial.
- Validar en `acta_items_before_insert` que no se agreguen equipos en reparación.
- Datos de baja/reparación (fecha, motivo, actor, último responsable) se leen de `equipo_historial` (la política actual lo permite al personal).
- `mi-portal.tsx`: consultar estados `asignado` y `en_reparacion`; RLS de equipos ya permite ver los propios.
- `equipos.index.tsx`: pestañas con filtro por estado usando `fetchAll`.
