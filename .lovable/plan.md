# Pantalla de inicio de sesión minimalista

## Qué cambia
- Se quita el panel azul de la izquierda con textos (eslogan, Ley 527, "Uso interno exclusivo").
- Solo queda una tarjeta centrada en la pantalla con:
  - Logo "FINESA" arriba
  - Selector Empleado / Mesa de ayuda
  - Campos (cédula + PIN, o correo + contraseña) y botón "Ingresar"
  - Enlace "¿Olvidó su contraseña?" en Mesa de ayuda (se mantiene por ser necesario)
- Se eliminan los títulos y textos explicativos ("Portal del empleado", "Ingrese con su número de cédula...", "No hay registro público...", "¿Olvidó su PIN?...").

## Detalles técnicos
- Solo se edita `src/routes/index.tsx` (presentación). La lógica de ingreso no cambia.
