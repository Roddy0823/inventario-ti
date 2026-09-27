# Carga del inventario real de Finesa

## Qué contienen los archivos
- 370 empleados (16 sedes, empresas con variaciones de escritura: "FInesa S.A", "Finesa").
- 2.098 equipos (portátiles, cargadores, monitores, periféricos), todos "Asignado".
- 2.054 asignaciones equipo-empleado; todas coinciden con empleados y equipos existentes.
- El archivo original (452 filas) aporta datos extra: nombre de equipo, sistema operativo, factura, novedad.

## Problemas detectados que se resuelven en la carga
- 92 seriales repetidos y 117 códigos de Activo Fijo repetidos: se carga la primera aparición y el resto va a un reporte descargable para revisión.
- 886 equipos sin serial: se usa el Activo Fijo como identificador; si tampoco hay, se genera código FIN-ACC automático.
- Valores "#N/D", "Pendiente", "NN" se tratan como vacíos. Marcas y empresas se normalizan (mayúsculas/espacios, "Plantrnics" a "Plantronics", "Logitec" a "Logitech", etc.).
- Todos los correos son "PENDIENTE_ACTUALIZAR": se dejan vacíos para completarse después.

## Qué se construye
1. Nuevo campo "Activo Fijo" en equipos (único, buscable y visible en listas, detalle y reportes).
2. Campos adicionales opcionales en equipos: nombre de equipo, sistema operativo, número de factura, año de compra, novedad.
3. Página Carga masiva acepta el Excel de 3 hojas (Empleados, Inventario_Equipos, Asignaciones): vista previa con errores por fila, carga por lotes con barra de progreso y reporte final descargable.
4. Asignaciones de la carga inicial: el equipo queda "asignado" al empleado sin acta, con evento "Carga inicial" en su historial y registro en auditoría. Las devoluciones futuras sí usan acta.
5. Carga inmediata de este archivo al sistema, creando automáticamente catálogos faltantes (sedes, áreas, empresas, marcas, tipos) y entregándote el reporte de repetidos.

## Detalles técnicos
- Migración: columnas `activo_fijo` (unique parcial), `nombre_equipo`, `sistema_operativo`, `factura_numero`, `anio_compra`, `novedad` en `equipos`; RPC `asignar_carga_inicial(p_equipo, p_empleado)` security definer que exige permiso `cargas_masivas`, cambia estado y registra historial/auditoría (el trigger de estado hoy solo permite cambios vía acta).
- Lectura de Excel en navegador con SheetJS (`xlsx`); inserciones en lotes de 200; validaciones reusan las actuales.
- Carga inicial ejecutada una vez con el cliente admin del servidor, registrando al admin inventarioTI como actor.
