# Sistema de Inventario y Actas Digitales — Finesa

Aplicación interna en español, estilo corporativo sobrio (azules profundos, gris azulado, fondo claro), construida por fases sobre la base de datos Supabase ya conectada (actualmente vacía).

## Fase 1 — Base, acceso y catálogos

- Inicio de sesión con correo y contraseña, recuperación de contraseña y pantalla de restablecimiento. Sin registro público.
- Roles: Administrador y Auxiliar de Soporte, guardados en una tabla de roles aparte (nunca en el perfil) para evitar escalación de privilegios.
- Panel principal con menú lateral: Inventario, Empleados, Actas, Repositorio, Catálogos, Usuarios, Auditoría (los tres últimos solo Administrador).
- Catálogos maestros: Marcas, Tipos de equipo, Sedes, Áreas y Empresas. Crear, editar y desactivar; no se pueden eliminar si ya están en uso.
- Registro automático de auditoría (quién creó, editó o anuló cada registro, con fecha y hora).

## Fase 2 — Equipos y empleados

- Alta de equipos: tipo, marca, modelo, serie, fecha de ingreso, estado, observaciones, proveedor, fin de garantía y factura adjunta (PDF/imagen).
- Periféricos sin serie: código interno automático tipo `FIN-ACC-0001`.
- Series y códigos únicos; serie no editable salvo corrección del Administrador con motivo obligatorio.
- Estados: Disponible, Asignado, En reparación, De baja. Cambio manual a reparación o baja exige motivo.
- Búsqueda y filtros por serie, tipo, marca, estado, sede y empleado asignado.
- Ficha del equipo con historial cronológico completo.
- Empleados: alta con identificación única, correo, cargo, área y sede; edición; baja lógica bloqueada si tiene equipos asignados (paz y salvo); no se asignan equipos a inactivos; perfil con equipos actuales e historial.
- Carga masiva por CSV de equipos y empleados, con validación previa en pantalla antes de insertar.

## Fase 3 — Actas, firma y PDF

- Crear acta de entrega (equipo Disponible + empleado Activo, con periféricos adicionales) y de devolución, con el mismo flujo.
- Vista previa del acta: fecha, datos del empleado, equipos, técnico y observaciones.
- Firma en pantalla con dedo o mouse, sin login del empleado.
- Enlace de firma remota optimizado para móvil, de un solo uso y con vencimiento a 48 horas. Por ahora se copia al portapapeles (sin envío de correo).
- La firma registra trazo, fecha/hora e IP del firmante (Ley 527 de 1999).
- Al firmar se genera el PDF del acta y se guarda automáticamente en el almacenamiento seguro.
- Estados del acta: Pendiente de firma, Firmada, Anulada. Solo el Administrador anula, con motivo; nunca se elimina.
- El estado del equipo cambia solo tras firma: Asignado en entrega, Disponible en devolución.

## Fase 4 — Repositorio y reportes

- Repositorio de actas con filtros por fechas, empleado, tipo y estado; ver y descargar PDF.
- Exportación CSV del inventario por estado y sede.
- Exportación CSV de actas firmadas en un periodo.
- Gestión de cuentas: el Administrador invita, crea, suspende o cambia el rol de los auxiliares.
- Pantalla de auditoría para el Administrador.

## Detalles técnicos

- Tablas: `profiles`, `user_roles` (+ función `has_role`), `catalogos` (marcas, tipos_equipo, sedes, areas, empresas), `empleados`, `equipos`, `equipo_historial`, `actas`, `acta_items`, `firmas`, `tokens_firma`, `auditoria`. Todas con RLS, GRANT explícitos y `created_at`/`updated_at`.
- Código interno de periféricos mediante secuencia + trigger; unicidad por índice sobre serie/código.
- Reglas de negocio críticas (paz y salvo, transición de estados, no eliminar catálogos en uso, un solo uso del token) implementadas con triggers/constraints en base de datos, no solo en la interfaz.
- Firma remota: ruta pública que valida un token aleatorio de 48 h contra una función de servidor; RLS impide cualquier acceso a datos fuera del acta correspondiente. IP tomada de la cabecera de la petición.
- PDF generado en el servidor (pdf-lib, compatible con el runtime edge) y subido a un bucket privado; descarga mediante URL firmada.
- CSV: validación en cliente con parseo, reporte de errores fila por fila, inserción por lotes en una función de servidor.
- Rutas protegidas bajo `_authenticated/`; rutas públicas: `/` (login), `/auth`, restablecer contraseña y `/firmar/$token`.
- Tokens de invitación y suspensión de auxiliares vía API de administración de Supabase en funciones de servidor con verificación de rol.
