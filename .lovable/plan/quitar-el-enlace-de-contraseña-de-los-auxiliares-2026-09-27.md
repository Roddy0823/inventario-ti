# Quitar el enlace de contraseña de los auxiliares

## Objetivo
La contraseña de un auxiliar siempre la define el administrador al crear la cuenta. Por eso se elimina la opción "Enlace de contraseña" de la lista de usuarios.

## Cambios

1. **Página de Usuarios** (`src/routes/_authenticated/usuarios.tsx`)
   - Quitar el botón **"Enlace de contraseña"** y su función `copiarLink` de la lista de auxiliares.
   - Limpiar las importaciones que queden sin uso.

2. **Servidor** (`src/lib/usuarios.functions.ts`)
   - Eliminar la función `enlaceRestablecer`, que era la que generaba ese enlace y ya no tendría ningún uso.

## Resultado
- En **Usuarios**, cada auxiliar solo tendrá las acciones de editar permisos, suspender/activar y eliminar.
- Si un auxiliar olvida su contraseña, el administrador lo resuelve eliminando la cuenta y creándola de nuevo con una contraseña nueva (flujo ya existente).
- No hay cambios en la base de datos.
