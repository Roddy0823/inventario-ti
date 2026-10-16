# Reportes ampliados y nuevo módulo de Estadísticas

## 1. Reabastecimiento en Reportes
- Nueva tarjeta en Reportes: "Pedidos de reabastecimiento" con filtros de periodo (desde/hasta), estado del pedido y proveedor.
- Exporta Excel y PDF con el detalle por línea: pedido, proveedor, artículo, cantidad pedida/recibida, precio, valor, estado, fechas y quién lo solicitó.
- Se quitan los botones Excel/PDF de la página Reabastecimiento (queda solo la gestión de pedidos).

## 2. Actas por persona
- Nueva tarjeta "Actas por empleado": buscador de empleado (nombre o cédula) + periodo opcional + tipo (entrega/devolución/todas).
- Excel y PDF con todas sus actas firmadas y el desglose de equipos, más resumen: equipos entregados, devueltos y en su poder actualmente.

## 3. Estadísticas (rediseño)
**Tarjetas superiores (KPIs con salud):** cada una con color verde/ámbar/rojo y comparación % frente al mes anterior.
- Tasa de utilización: asignados / (total sin bajas).
- Disponibilidad inmediata: equipos disponibles vs. tipos con stock crítico.
- Tasa de falla: equipos que pasaron a reparación o baja en los últimos 30 días / total.
- Efectividad de firmas: % firmadas vs. pendientes y tiempo promedio de firma.
- Se conservan valor total del inventario y garantías.

**Pestañas de gráficos:**
1. Visión general: dona con total en el centro por estado + barras apiladas por tipo y estado.
2. Movimientos: área mensual (12 meses) de entregas, devoluciones e ingresos al inventario.
3. Calidad y fallas: barras horizontales con ranking de marcas y modelos por reparaciones y bajas.
4. Empleados: equipos asignados agrupados por cargo, área y sede (selector).
5. Proveedores, stock y garantías: barras dobles disponible vs. mínimo por artículo, y garantías que vencen en 30/60/90 días.

Se mantienen los filtros por sede y tipo, y la exportación a Excel/PDF.

## Detalles técnicos
- Ampliar la RPC `estadisticas_inventario` (nueva migración) con: kpis del mes actual y anterior, fallas por marca/modelo desde `equipo_historial`/`reparaciones`, distribución por cargo/área/sede de empleados, tiempo promedio de firma (`firmado_at - created_at`), stock vs mínimo y garantías 30/60/90.
- Usar `components/ui/chart.tsx` y `tabs.tsx` con recharts.
- Reportes nuevos con `fetchAll` + `reportePdf`/`descargarCSV` y `log_evento` para auditoría; permiso `reportes_exportar`.
