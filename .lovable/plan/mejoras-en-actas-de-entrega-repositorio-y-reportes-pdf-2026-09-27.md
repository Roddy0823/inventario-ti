# Mejoras en actas de entrega, repositorio y reportes PDF

## 1. Flujo de actas de entrega (Nueva acta)
- **Búsqueda de equipos más fácil:** filtros por tipo, marca y sede, y búsqueda por serie, modelo, activo fijo o nombre de equipo.
- **Estado de cada equipo:** al elegir un equipo se puede anotar su estado físico (Nuevo / Bueno / Regular / Con daños), sus accesorios (cargador, maleta, mouse…) y una nota corta. Esto queda guardado en el acta y aparece en el PDF firmado, en una columna por equipo.
- En devoluciones funciona igual, así se deja constancia de cómo vuelve el equipo.

## 2. Repositorio de actas (acciones del administrador)
- **Filtros:** estado (pendiente, firmada, anulada), tipo, rango de fechas, empleado (nombre o cédula) y técnico.
- **Anular acta:** botón en cada fila (solo administrador), con motivo obligatorio. Se usa la regla de anulación que ya existe y queda en la auditoría.
- **Descargar varias:** casillas para seleccionar actas firmadas y un botón "Descargar seleccionadas", que genera un solo archivo ZIP con los PDF (máximo 100 por vez).

## 3. Reportes en PDF (además de Excel)
Cada reporte tiene dos botones: **Excel** y **PDF**.
- **Actas firmadas en un periodo:** PDF horizontal con encabezado Finesa, el periodo, el total de actas por tipo y una tabla con número, tipo, empleado, cédula, técnico, fecha de firma, medio de firma y cantidad de equipos.
- **Inventario actual:** PDF horizontal con los filtros aplicados (estado y sede), resumen por estado y una tabla con serie, activo fijo, tipo, marca, modelo, sede, estado y responsable. Tiene número de página y fecha de generación.
- Cada exportación queda registrada en la auditoría.

## Detalles técnicos
- Migración: agregar a `acta_items` las columnas `estado_fisico text`, `accesorios text` y `nota text` (opcionales). La regla de acceso para insertar no cambia.
- `actas.nueva.tsx`: filtros por catálogo; al marcar un equipo se abre un bloque en línea para estado, accesorios y nota; se envían en el insert de `acta_items`.
- `firmas.server.ts`: la tabla del PDF firmado muestra las nuevas columnas (si están vacías aparece "—").
- `actas.index.tsx`: filtros en el navegador sobre la lista paginada con `fetchAll`; diálogo para anular que llama a `supabase.rpc("anular_acta")`; selección múltiple y ZIP con `jszip` (se descargan los enlaces firmados de cada PDF como archivos y se arma el ZIP en el navegador; se descarga igual que `descargarPdfActa`).
- `reportes.tsx`: PDF generado en el navegador con `jspdf` + `jspdf-autotable` y colores corporativos; se mantiene el CSV actual.
- Verificación: prueba en la app creando un acta con estado por equipo, revisando el PDF, anulando un acta de prueba, descargando un ZIP y exportando los dos PDF.
