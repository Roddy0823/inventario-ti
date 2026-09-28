# Optimización, rendimiento y seguridad

## 1. Seguridad
- Correr el escaneo de seguridad completo y corregir todos los avisos (incluidos los 13 antiguos): permisos de funciones internas, políticas de acceso demasiado amplias, archivos de almacenamiento.
- Quitar el permiso de ejecución público (visitantes sin sesión) a las funciones internas; dejar solo usuarios con sesión donde las reglas de acceso las necesitan.
- Revisar que toda acción del servidor verifique quién la pide y a qué ecosistema pertenece (actas, firmas, reportes, carga masiva).
- Secreto propio para los PIN de empleados (hoy se deriva de la llave maestra del servidor), sin romper los PIN actuales: se regeneran al habilitar acceso de nuevo.
- Enlaces de firma: confirmar vencimiento de 48 h y un solo uso en el servidor.

## 2. Rendimiento
- Caché de datos: evitar que cada página recargue todo al volver a ella (tiempo de vigencia de 1 minuto; catálogos y perfil 10 minutos).
- Inventario, empleados y actas: paginar y filtrar en la base de datos en vez de traer las ~2.000 filas completas al navegador.
- Panel: calcular los conteos en la base de datos (una sola consulta) en vez de descargar todos los equipos.
- Índices en columnas más buscadas (serie, activo fijo, cédula, estado, fechas de actas).
- Cargar bajo demanda las librerías pesadas (Excel, PDF, ZIP) solo al pulsar exportar.

## 3. Optimización general
- Búsquedas con espera breve al escribir para no consultar en cada tecla.
- Mensajes de error claros y pantalla de error en cada sección para que nunca quede en blanco.

## Detalles técnicos
- QueryClient con `staleTime` por defecto; `defaultPreloadStaleTime` ajustado.
- RPC `panel_conteos()` agrupando por estado filtrado por `my_owner_id()`.
- `.range()` + `count: 'exact'` y filtros `ilike` del lado servidor en listas; `fetchAll` solo para exportaciones.
- `REVOKE EXECUTE ... FROM anon, public` en funciones SECURITY DEFINER; migración de índices.
- Secreto `EMPLEADO_PIN_SECRET` para el HMAC.
- `import()` dinámico de xlsx, jspdf, jszip.
- `errorComponent` en rutas autenticadas.
