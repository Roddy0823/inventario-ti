import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { registrarAuditoria } from "./firmas.server";

const PERMISOS = ["equipos_editar", "empleados_editar", "cargas_masivas", "actas_entrega", "actas_devolucion", "firmas_capturar", "repositorio_ver", "reportes_exportar"] as const;

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string };

async function exigirAdmin(ctx: Ctx) {
  const [{ data: admin }, { data: activo }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("is_active", { _user_id: ctx.userId }),
  ]);
  if (!admin || !activo) throw new Error("Solo el Administrador puede realizar esta acción.");
}

function origen() {
  const o = getRequestHeader("origin");
  if (o) return o;
  const h = getRequestHeader("host");
  return h ? `https://${h}` : "";
}

function passwordTemporal() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20) + "!9a";
}

export const crearAuxiliar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      nombre: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(200),
      password: z.string().min(8).max(72),
      permisos: z.array(z.enum(PERMISOS)),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre: data.nombre },
    });
    if (error || !u.user) throw new Error(error?.message.includes("already") ? "Ya existe un usuario con ese correo." : error?.message ?? "Error");
    const id = u.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, email: data.email.toLowerCase(), nombre: data.nombre, activo: true });
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: "auxiliar" });
    if (data.permisos.length) await supabaseAdmin.from("user_permisos").insert(data.permisos.map((p) => ({ user_id: id, permiso: p })));
    await registrarAuditoria(supabaseAdmin, context.userId, "usuarios", "CREAR_AUXILIAR", id, `Auxiliar ${data.email} creado con permisos: ${data.permisos.join(", ") || "ninguno"}`);
    return { id };
  });

export const actualizarPermisos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), permisos: z.array(z.enum(PERMISOS)) }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: esAux } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", data.userId).eq("role", "auxiliar").maybeSingle();
    if (!esAux) throw new Error("Solo se pueden configurar permisos de auxiliares.");
    await supabaseAdmin.from("user_permisos").delete().eq("user_id", data.userId);
    if (data.permisos.length) await supabaseAdmin.from("user_permisos").insert(data.permisos.map((p) => ({ user_id: data.userId, permiso: p })));
    await registrarAuditoria(supabaseAdmin, context.userId, "usuarios", "PERMISOS", data.userId, `Permisos actualizados: ${data.permisos.join(", ") || "ninguno"}`);
    return { ok: true };
  });

export const cambiarEstadoUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), activo: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    if (data.userId === context.userId) throw new Error("No puede suspender su propia cuenta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: esAdmin } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", data.userId).eq("role", "admin").maybeSingle();
    if (esAdmin) throw new Error("Las cuentas de Administrador solo se gestionan en la base de datos.");
    await supabaseAdmin.auth.admin.updateUserById(data.userId, { ban_duration: data.activo ? "none" : "876000h" });
    await supabaseAdmin.from("profiles").update({ activo: data.activo }).eq("id", data.userId);
    await registrarAuditoria(supabaseAdmin, context.userId, "usuarios", data.activo ? "REACTIVAR" : "SUSPENDER", data.userId, data.activo ? "Cuenta reactivada" : "Cuenta suspendida");
    return { ok: true };
  });

export const enlaceRestablecer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("profiles").select("email").eq("id", data.userId).maybeSingle();
    if (!p?.email) throw new Error("Usuario no encontrado");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: p.email, options: { redirectTo: `${origen()}/restablecer` } });
    if (error) throw new Error(error.message);
    await registrarAuditoria(supabaseAdmin, context.userId, "usuarios", "ENLACE_CLAVE", data.userId, "Enlace para definir contraseña generado");
    return { url: link.properties.action_link };
  });

export const habilitarAccesoEmpleado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ empleadoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("has_permiso", { _user_id: context.userId, _p: "empleados_editar" });
    if (!ok) throw new Error("No tiene permiso para habilitar accesos.");
    const { data: emp } = await context.supabase.from("empleados").select("*").eq("id", data.empleadoId).maybeSingle();
    if (!emp) throw new Error("Empleado no encontrado");
    if (!emp.activo) throw new Error("El empleado está inactivo.");
    if (!emp.email) throw new Error("El empleado no tiene correo registrado.");
    const email = emp.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId = emp.user_id;
    if (!userId) {
      const { data: u, error } = await supabaseAdmin.auth.admin.createUser({ email, password: passwordTemporal(), email_confirm: true, user_metadata: { nombre: emp.nombre } });
      if (error || !u.user) throw new Error(error?.message.includes("already") ? "Ese correo ya pertenece a otra cuenta del sistema." : error?.message ?? "Error");
      userId = u.user.id;
      await supabaseAdmin.from("profiles").upsert({ id: userId, email, nombre: emp.nombre, activo: true });
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "empleado" });
      await supabaseAdmin.from("empleados").update({ user_id: userId }).eq("id", emp.id);
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      await supabaseAdmin.from("profiles").update({ activo: true }).eq("id", userId);
    }
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: `${origen()}/restablecer` } });
    if (error) throw new Error(error.message);
    await registrarAuditoria(supabaseAdmin, context.userId, "empleados", "HABILITAR_ACCESO", emp.id, `Acceso al portal habilitado para ${email}`);
    return { url: link.properties.action_link };
  });

export const retirarEmpleado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ empleadoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // La actualización con el cliente del usuario aplica RLS y la regla de paz y salvo
    const { data: emp, error } = await context.supabase.from("empleados").update({ activo: false }).eq("id", data.empleadoId).select("id, user_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!emp) throw new Error("No tiene permiso para retirar empleados.");
    if (emp.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.auth.admin.updateUserById(emp.user_id, { ban_duration: "876000h" });
      await supabaseAdmin.from("profiles").update({ activo: false }).eq("id", emp.user_id);
      await registrarAuditoria(supabaseAdmin, context.userId, "empleados", "SUSPENDER_ACCESO", emp.id, "Acceso al portal suspendido por retiro");
    }
    return { ok: true };
  });
