# Reorganizar el menú lateral en grupos desplegables

Hoy el menú tiene 12 enlaces sueltos. Se agrupan por tarea, con grupos que se abren y cierran.

## Nueva estructura

```text
Panel
Inventario            (desplegable)
  - Equipos
  - Reabastecimiento
  - Proveedores
  - Carga masiva
Personas y actas      (desplegable)
  - Empleados
  - Nueva acta
  - Repositorio de actas
Análisis              (desplegable)
  - Estadísticas
  - Reportes
Administración        (desplegable, solo administrador)
  - Catálogos
  - Usuarios y permisos
---
Nombre / rol · Ajustes · Cerrar sesión (igual que hoy)
```

## Comportamiento
- El grupo que contiene la página actual se abre solo y queda resaltado.
- Los grupos recuerdan si los dejaste abiertos o cerrados.
- Un grupo sin páginas permitidas para el auxiliar no aparece.
- Botón para contraer el menú a solo íconos en pantallas grandes (al pasar el mouse se ve el nombre); en celular sigue el menú deslizable actual.
- El portal del empleado no cambia (un solo enlace).

## Detalles técnicos
- Solo se modifica `src/routes/_authenticated/route.tsx`: lista de grupos con ítems y permisos, estado abierto por grupo en localStorage (leído en useEffect), detección del grupo activo con `useRouterState`, modo compacto `w-16` con tooltips.
- Sin cambios en páginas, permisos ni base de datos.
