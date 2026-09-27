# Ajustes, firma del técnico, cambio de contraseña y mejoras de panel y reportes

## 1. Cambiar contraseña de un auxiliar (Usuarios y permisos)
- Nuevo botón **"Contraseña"** en cada fila de auxiliar: el administrador escribe la nueva contraseña (mín. 8) y la confirma.
- Solo el Administrador; nunca sobre cuentas de administrador. Queda en auditoría ("CAMBIAR_CONTRASEÑA", sin guardar la clave).

## 2. Nueva página "Ajustes" (administradores y auxiliares)
Entrada en el menú lateral, con secciones:
- **Mi perfil:** cambiar el nombre (se actualiza en el menú, en las actas nuevas y en la auditoría).
- **Mi firma:** dibujar la firma en el recuadro, verla guardada, reemplazarla o borrarla.
- **Auditoría** (solo Administrador): la pantalla de auditoría pasa a estar dentro de Ajustes como pestaña; se quita del menú lateral. La dirección antigua redirige a Ajustes.

## 3. Firma del técnico automática en las actas
- Al generar un acta, si quien la crea tiene firma registrada, esta se estampa automáticamente en el PDF en el espacio "Técnico", junto a la firma del empleado.
- Se guarda una copia de la firma con el acta, para que cambios posteriores de la firma no alteren actas ya emitidas.
- Si el técnico no tiene firma, el formulario de Nueva acta muestra un aviso con enlace a Ajustes (el acta se puede crear igual).

## 4. Tarjetas del Panel clicables
- Equipos totales → Inventario (Activos, sin filtro).
- Disponibles / Asignados → Inventario, pestaña Activos filtrada por ese estado.
- En reparación / Dados de baja → Inventario en esa pestaña.

## 5. Reporte de actas firmadas con desglose de equipos
- Excel: una fila por equipo (No. acta, tipo, fecha de firma, empleado, cédula, técnico, tipo de equipo, marca, modelo, serie, activo fijo).
- PDF: se mantiene el resumen y la tabla pasa a listar cada equipo entregado o devuelto agrupado por acta, con totales de equipos entregados y devueltos.

## Detalles técnicos
- Migración: columnas `firma_path` en `profiles` y `tecnico_firma_path` en `actas`; bucket privado existente `actas` con carpeta `firmas-usuarios/{user_id}.png`. Nombre y firma se actualizan vía server functions con `requireSupabaseAuth` (profiles no admite UPDATE directo por RLS) que registran auditoría.
- `cambiarPasswordAuxiliar` en `usuarios.functions.ts` con `esAdmin` + `supabaseAdmin.auth.admin.updateUserById`, devolviendo `{ error }`.
- `actas.nueva`: al insertar, server fn copia la firma del perfil a `actas/{id}/tecnico.png`; `generarPdf` en `firmas.server.ts` la embebe si existe.
- Ruta nueva `/_authenticated/ajustes` con pestañas (Perfil, Firma, Auditoría); el contenido de `auditoria.tsx` se mueve a un componente reutilizado y `/auditoria` hace redirect.
- `equipos.index` acepta `validateSearch` `{ tab?, estado? }` para abrir la pestaña y filtro; `panel.tsx` envuelve `Stat` en `Link`.
- `reportes.tsx`: consulta actas con `acta_items(equipo:equipos(serie, activo_fijo, modelo, tipo_id, marca_id))` y aplana a filas por equipo.
