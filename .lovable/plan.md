# Proveedores y Estadísticas del inventario

## 1. Página de Proveedores (menú lateral, debajo de Inventario)
- Lista de todos los proveedores con búsqueda (nombre, NIT, ciudad), paginación de 50 y exportación a Excel.
- Columnas: nombre, NIT, contacto, teléfono, ciudad, número de tipos de equipo que surte y número de equipos comprados a él.
- Crear, editar y eliminar proveedor (con confirmación).
- Detalle del proveedor en un panel lateral: datos de contacto, botones Llamar / WhatsApp / Correo, tipos de equipo que surte (precio de referencia, días de entrega, principal) con opción de vincular o quitar, y equipos comprados a este proveedor con su valor total.
- Visible para administrador y auxiliares; todo queda en la auditoría.

## 2. Valor de compra por equipo
- Nuevo campo "Valor de compra" (pesos colombianos) en cada equipo: editable en la ficha del equipo, visible en el inventario y admitido en la carga masiva de Excel.
- El campo "Proveedor" del equipo pasa a elegirse de la lista de proveedores registrados (se conserva el texto actual de los equipos ya cargados).
- Cada cambio de valor queda en el historial del equipo y en la auditoría.

## 3. Módulo de Estadísticas (menú lateral)
- **Tarjetas**: total de equipos, valor total del inventario, valor de equipos asignados, valor en reparación, valor dado de baja, equipos sin valor registrado, actas firmadas en el mes y pendientes.
- **Gráficos**: equipos por estado, por tipo, por marca y por sede; valor por tipo y por sede; ingresos de equipos por mes (últimos 12 meses); entregas vs devoluciones por mes; garantías vencidas y por vencer (90 días); antigüedad por año de compra; top proveedores por valor.
- **Tablas**: resumen por tipo (cantidad, disponibles, asignados, en reparación, de baja, valor total, valor promedio) y alertas de stock bajo.
- Filtros por sede y tipo; exportar el resumen a PDF y Excel.

## Detalles técnicos
- Migración: `equipos.valor_compra numeric(14,2)` y `equipos.proveedor_id uuid → proveedores` (ON DELETE SET NULL); índice en proveedor_id. El trigger de historial registra cambios de valor.
- RPC `estadisticas_inventario(p_sede uuid, p_tipo uuid)` SECURITY INVOKER filtrada por `my_owner_id()`, devuelve JSON con todos los agregados (evita el límite de 1000 filas).
- Rutas nuevas: `_authenticated/proveedores.tsx`, `_authenticated/estadisticas.tsx`; enlaces en `route.tsx` solo para personal.
- Gráficos con `recharts` (componentes chart de shadcn) usando los colores del tema.
- `equipos.$id.tsx` (edición), `equipos.index.tsx` (columna valor), `ImportExcel.tsx` (columna "Valor compra"), `StockAlertas.tsx` reutiliza el formulario de proveedores.
