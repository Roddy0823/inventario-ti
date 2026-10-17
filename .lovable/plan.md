# Pantalla de inicio de sesión minimalista y renovada

## Qué cambia
- Se quita el panel azul de la izquierda con textos (eslogan, Ley 527, "Uso interno exclusivo").
- Se eliminan títulos y textos explicativos ("Portal del empleado", instrucciones, "No hay registro público...", "¿Olvidó su PIN?...").
- Solo queda una tarjeta centrada en la pantalla.

## Diseño nuevo
- Fondo con degradado suave en los azules Finesa (navy a azul medio) y una textura sutil de líneas o puntos.
- Tarjeta blanca centrada, esquinas redondeadas, sombra elegante, ancho cómodo.
- Arriba de la tarjeta: "FINESA" en tipografía de marca con una línea fina de acento.
- Selector Empleado / Mesa de ayuda como pestañas tipo pastilla con transición suave.
- Campos con ícono a la izquierda (cédula, candado, correo), más altos y legibles.
- PIN de 4 dígitos mostrado como 4 casillas individuales.
- Botón "Ingresar" ancho, con indicador de carga.
- Enlace pequeño "¿Olvidó su contraseña?" solo en Mesa de ayuda.
- Leve animación de entrada de la tarjeta. Se ve bien en celular.

## Detalles técnicos
- Se edita `src/routes/index.tsx` (presentación) y se agregan tokens de degradado/sombra en `src/styles.css`. La lógica de ingreso no cambia.
