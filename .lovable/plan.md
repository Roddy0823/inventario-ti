# Proveedores sin botones de contacto + nuevo flujo de reabastecimiento

## 1. Quitar botones de contacto
- Eliminar todos los botones/íconos de Llamar, WhatsApp y Correo en: lista de proveedores, ficha del proveedor, panel de reabastecer y ficha del equipo (proveedor de reparación).
- En su lugar se muestra un bloque de solo lectura "Datos de contacto": asesor, teléfono directo, celular, teléfono empresa, correo, dirección y sitio web, con un botón pequeño "Copiar" por dato para pegarlo donde se necesite.
- El campo "Celular / WhatsApp" se renombra a "Celular".

## 2. Reabastecimiento con pedidos de compra
Hoy existe solo "marcar cotización solicitada" y "recibir stock" sueltos. Se reemplaza por un pedido con ciclo claro:

```text
Borrador -> Pedido realizado -> Recibido parcial -> Recibido completo
                    \-> Cancelado (con motivo)
```

- **Nueva página "Reabastecimiento"** dentro de Inventario (menú lateral), con:
  - Arriba: artículos por debajo del stock mínimo, con cantidad sugerida y proveedor principal ya seleccionado; botón "Crear pedido".
  - Pedidos abiertos y cerrados con filtros (estado, proveedor, fechas), paginación y exportación a Excel/PDF.
- **Pedido**: proveedor, una o varias líneas (artículo, cantidad, precio unitario estimado), fecha esperada (calculada con los días de entrega del proveedor), notas, total estimado. Se puede crear un pedido con varios artículos del mismo proveedor de una vez.
- **Recepción por línea**: al recibir se registran seriales (o cantidad sin serial), marca, modelo, sede, valor real, factura y garantía; permite recibir parcialmente. Los equipos entran como "Disponible" con su historial, y se actualiza el último precio del proveedor.
- **Avisos**: pedidos con fecha esperada vencida se marcan "Atrasado"; el panel de alertas de stock indica cuando un artículo ya tiene pedido en curso (para no pedir dos veces).
- **Ficha del proveedor**: pestaña de pedidos con cumplimiento (a tiempo / atrasados) y total comprado.
- Todo queda auditado (quién creó, cambió, recibió o canceló y cuándo).

## Detalles técnicos
- Migración: tablas `pedidos_compra` (owner_id, proveedor_id, estado, fecha_esperada, notas, creado_por, cancelado_motivo) y `pedido_lineas` (pedido_id, tipo_id, cantidad, recibida, precio_estimado), RLS por `my_owner_id()` + `has_permiso`, triggers de auditoría. Migrar solicitudes abiertas de `solicitudes_reabastecimiento` a pedidos y dejar la tabla antigua solo lectura.
- RPC `recibir_pedido_linea` (security definer, valida permiso) que inserta equipos, actualiza `recibida`, estado del pedido y `articulo_proveedores` en una transacción.
- Quitar `waLink`, `telLink`, `mailLink`, `mensajeReabastecer` de `src/lib/proveedores.ts`; nueva ruta `src/routes/_authenticated/reabastecimiento.tsx`; `StockAlertas` y `RecibirStock` pasan a usar pedidos.
