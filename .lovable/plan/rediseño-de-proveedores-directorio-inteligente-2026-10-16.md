# Rediseño de Proveedores (Directorio Inteligente)

## 1. Ficha completa del proveedor
- Empresa: razón social / nombre comercial, NIT, ciudad, dirección, sitio web.
- Asesor asignado: nombre, teléfono directo, celular/WhatsApp, correo.
- Tipo de proveedor (etiquetas, varias a la vez): Venta de Hardware, Periféricos y Accesorios, Servicio Técnico / Reparaciones, Licenciamiento.
- Condiciones: días promedio de entrega, forma de pago (Contado, Crédito 30/60 días, otro), estado Activo / Inactivo.
- Lista con búsqueda por nombre, NIT o artículo que vende (ej. "Diademas"), filtros por etiqueta y estado, 50 por página.
- Los proveedores actuales se conservan (el contacto actual pasa a "asesor").

## 2. Artículos por proveedor
- Vincular tipos de equipo del catálogo a cada proveedor.
- Estrella de proveedor principal por artículo (solo uno por artículo); aparece primero en las alertas.
- Precio de referencia, último precio de compra y fecha de última compra.

## 3. Reabastecimiento en 1 clic desde las alertas
- Panel lateral de la alerta con proveedores ordenados (principal primero, solo activos).
- WhatsApp al asesor con mensaje: "Hola [Asesor], te escribo desde el área de TI. Actualmente requerimos cotización y disponibilidad para reabastecer [Artículo] (Cantidad requerida: X unidades). Quedo atento." La cantidad se sugiere (mínimo − disponibles + 1) y se puede cambiar.
- Llamar y Correo con asunto y artículo ya redactados.
- "Marcar cotización solicitada": etiqueta visible para todos "Cotización solicitada a [Proveedor] el [Fecha] por [Usuario]", con opción de cerrarla (recibido / cancelado).
- Crear y vincular un proveedor nuevo sin salir del panel.

## 4. Hoja de vida del equipo y garantías
- En el equipo: proveedor de compra (lista), número de factura/orden y vencimiento de garantía.
- Semáforo: insignia verde "En garantía con [Proveedor] hasta [mes año]" o gris "Garantía vencida".
- Botón "Recibir stock de este proveedor" (desde la solicitud o el proveedor): abre un formulario con proveedor y tipo ya llenos para registrar varios seriales de una vez; cierra la solicitud en curso.

## 5. Reparaciones
- Al enviar un equipo a reparación se puede elegir el proveedor de servicio técnico (solo los etiquetados así).
- La tarjeta del equipo en reparación muestra el proveedor y sus botones de contacto.
- En el proveedor: equipos reparados, en reparación ahora y tiempo promedio de devolución.

## 6. Auditoría y reportes
- Todo cambio (proveedor, vínculos, mínimos de alerta, solicitudes) queda en la auditoría.
- Reportes: resumen por proveedor (equipos suministrados, en garantía, valor, reparaciones), en Excel y PDF.

## Detalles técnicos
- Migración `proveedores`: `direccion`, `sitio_web`, `asesor_telefono`, `etiquetas text[]`, `dias_entrega`, `forma_pago`, `activo bool`; `contacto_nombre` se usa como asesor, `telefono` deja de ser obligatorio si hay celular.
- `articulo_proveedores`: `ultimo_precio`, `ultima_compra date`; índice único parcial (owner_id, tipo_id) where es_principal.
- Nueva tabla `solicitudes_reabastecimiento` (tipo_id, proveedor_id, cantidad, estado solicitada/recibida/cancelada, solicitado_por, nombre, fechas, owner_id) con GRANT, RLS por `my_owner_id()` + `is_staff`, `audit_trigger`.
- `equipos.reparacion_proveedor_id`; `cambiar_estado_equipo` acepta proveedor opcional; `finalizar_reparacion` lo limpia; historial registra entrada/salida para medir tiempos.
- Archivos: `proveedores.tsx` (rehecho con `ui/table`), `StockAlertas.tsx`, `equipos.$id.tsx`, nuevo `RecibirStock.tsx`, `FinalizarReparacion.tsx`/diálogo de estado, `reportes.tsx`.
