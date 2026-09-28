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
- Empleados ingresan con cédula + PIN de 4 dígitos vía `ingresoEmpleado` (servidor); la contraseña interna es un HMAC del PIN con un secreto del servidor y hay bloqueo de 15 min tras 5 fallos — impide adivinar PINs desde el navegador.
- El historial de equipos lo escribe el trigger `equipos_after_update`; las funciones que cambian estado pasan contexto con `app.hist_evento`, `app.hist_detalle` y `app.acta_id` — una sola línea de tiempo sin duplicados.
- La firma del técnico se guarda en `profiles.firma_path` y se copia al acta al crearla (`actas.tecnico_firma_path`) — cambios posteriores de firma no alteran actas emitidas.
- Multi-ecosistema: cada admin tiene datos aislados vía `owner_id` en empleados/equipos/actas/catalogo_items/user_roles; `my_owner_id()` resuelve el ecosistema (admin = su id, auxiliar = el de su admin) y las políticas RLS filtran por él — nunca usar `is_staff()` solo para visibilidad de datos de negocio.
- El rol admin solo se asigna por SQL directo; el trigger `user_roles_guard_admin` rechaza asignarlo desde la app. Un solo admin en todo el sistema (índice único `user_roles_un_solo_admin`) y cédula única global — evitar duplicidades.
