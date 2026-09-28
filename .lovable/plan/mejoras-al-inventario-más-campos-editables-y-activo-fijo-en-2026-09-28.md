# Mejoras al inventario: más campos editables y activo fijo en el acta

## 1. Edición de equipos más completa
Hoy el botón "Editar" de la ficha del equipo solo permite cambiar marca, modelo, sede, proveedor, garantía y observaciones. Se amplía para poder editar también:

- **Activo fijo** (con validación de que no esté repetido; si ya existe en otro equipo se muestra el aviso "Ese activo fijo ya existe").
- **Tipo de equipo** (lista del catálogo).
- **Nombre de equipo**.
- **Sistema operativo**.
- **Número de factura**.
- **Año de compra**.
- **Novedad**.
- **Fecha de ingreso**.

La serie sigue sin ser editable directamente (solo el administrador con "Corregir serie" y motivo, como hoy). Cada cambio queda registrado en el historial del equipo y en la auditoría, gracias a las reglas que ya existen en la base de datos.

## 2. Activo fijo en el acta de entrega (y devolución)
- El PDF del acta muestra el **activo fijo** de cada equipo, debajo de la serie en la tabla de equipos (si el equipo no tiene, no se muestra nada).
- También aparece en el resumen del acta dentro de la aplicación (detalle del acta y pantalla de firma), junto a la serie de cada equipo.

## Detalles técnicos
- `equipos.$id.tsx` (`EditarEquipo`): se agregan los campos nuevos al formulario y al `update`; el error de duplicado (23505 en `equipos_activo_fijo_uq`) se traduce a un mensaje claro. No requiere migración: las columnas ya existen y el trigger de historial ya registra los cambios.
- `firmas.server.ts`: `cargarActaCompleta` incluye `activo_fijo` en la consulta de equipos; `actaDTO` lo expone; `generarPdf` lo dibuja bajo la serie de cada equipo.
- `ActaResumen.tsx` y `actas.$id.tsx`: se muestra el activo fijo junto a la serie de cada equipo.
- Verificación: editar un equipo cambiando su activo fijo, intentar uno repetido para ver el aviso, y crear/firmar un acta de prueba para confirmar que el activo fijo aparece en el PDF.
