# Paginación, carga fluida, alertas de stock y proveedores

## 1. Paginación (10 / 20 / 50 / 100, siempre 50 por defecto)
- Nuevo control reutilizable: "Mostrando X a Y de Z registros", selector de filas por página, Anterior / Siguiente y "Página X de Y". Vuelve a la página 1 al cambiar un filtro o el tamaño.
- **Inventario**: la base de datos devuelve solo la página visible con el total, manteniendo búsqueda, tipo, estado y las pestañas En reparación / Dados de baja. Las exportaciones siguen trayendo todo.
- **Auditoría** (en Ajustes): paginada desde la base de datos, con filtros rápidos Hoy / Últimos 7 días / Últimos 30 días / Todos, además de las fechas actuales.
- **Historial del equipo**: línea de tiempo limpia y paginada; cada evento se despliega para ver el detalle. Lo mismo para las actas del equipo.
- **Actas y Empleados**: mismo control, 50 por defecto (los filtros actuales se mantienen).

## 2. Carga fluida
- Barra de progreso fina arriba y aviso flotante abajo a la derecha "Cargando datos..." al cambiar de página.
- Filas de carga (esqueletos) en las tablas principales mientras llegan los datos.
- Barra de progreso por lotes al importar Excel grandes.

## 3. Alertas de stock bajo y proveedores (admin y auxiliar)
- **Alertas**: por tipo de equipo (del catálogo) con mínimo (por defecto 3), activar/desactivar o eliminar. La alerta salta cuando los equipos disponibles de ese tipo son iguales o menores al mínimo.
- **Campana** en la barra lateral/superior con un contador rojo de artículos en stock bajo.
- **Aviso** en Panel e Inventario con los botones "Configurar alertas" y "Ver proveedores / Reabastecer".
- **Panel lateral de proveedores por artículo**: estado ("Portátil: 2 disponibles — mínimo 3"), proveedores asociados con botones Llamar, WhatsApp (mensaje prellenado pidiendo cotización) y Correo; formulario para registrar un proveedor nuevo o vincular uno existente, con precio de referencia, días de entrega y proveedor principal.
- Todo queda en la auditoría y separado por cuenta como el resto de datos.

## Ajustes respecto al documento
- El tipo de artículo se toma del catálogo de tipos de equipo (no texto libre) para que coincida exactamente con el inventario.
- La auditoría vive en Ajustes; la paginación se aplica allí.

## Detalles técnicos
- Migración: `proveedores` (nombre, nit, contacto_nombre, telefono req., whatsapp, email, ciudad, notas, owner_id), `alertas_stock_config` (tipo_id → catalogo_items, stock_minimo default 3, activa, owner_id, único (owner_id, tipo_id)), `articulo_proveedores` (tipo_id, proveedor_id ON DELETE CASCADE, precio_referencia, tiempo_entrega_dias, es_principal, owner_id). GRANT a authenticated/service_role, RLS por `owner_id = my_owner_id()` y `is_staff(auth.uid())` para escribir; trigger `audit_trigger` y `updated_at`.
- RPC `stock_bajo()` (SECURITY INVOKER) que cuenta disponibles por tipo_id contra reglas activas.
- Índices: `equipos(owner_id, estado, tipo_id)`, `auditoria(created_at desc)`.
- `DataTablePagination.tsx`; consultas con `.range()` + `count: 'exact'`; búsqueda en servidor con `.or(ilike...)`; `useRouterState` para el indicador; `Collapsible`, `Sheet`, `Skeleton`, `Progress` de shadcn.
