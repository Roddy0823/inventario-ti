<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisiones técnicas
- Reglas de negocio críticas (paz y salvo, cambios de estado de equipos, serie inmutable, anulación) viven en triggers/RPC de Postgres — la interfaz no es la frontera de seguridad.
- Roles en `user_roles` y permisos por acción en `user_permisos`; `has_permiso()` se usa en RLS — evita escalación de privilegios.
- Los administradores solo se crean por SQL en Supabase; la app nunca asigna el rol admin — requisito del cliente.
- Firma y PDF se generan en servidor (`src/lib/firmas.server.ts`, pdf-lib) con cliente admin; los tokens de firma solo son accesibles por el servidor — aislamiento de enlaces remotos.
- `auditoria` es inmutable (trigger bloquea UPDATE/DELETE); acciones con cliente admin registran el actor manualmente — trazabilidad completa.
