import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { CampanaAlertas } from "@/components/StockAlertas";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import type { Permiso } from "@/lib/constantes";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Laptop, Users, FileSignature, FolderOpen, Tags, UserCog, FileBarChart, Upload, LogOut, Menu, X, Inbox, Settings, Loader2, Truck, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: Shell,
});

type NavItem = { to: string; label: string; icon: typeof Laptop; show: boolean };

function Shell() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const cargando = useRouterState({ select: (s) => s.status === "pending" });

  async function salir() {
    await supabase.rpc("log_evento", { p_accion: "LOGOUT", p_detalle: "Cierre de sesión" });
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  }

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;

  if (!me || !me.activo || (!me.isStaff && !me.isEmpleado)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-bold">Cuenta sin acceso</h1>
        <p className="max-w-sm text-sm text-muted-foreground">Su cuenta está suspendida o no tiene un rol asignado. Contacte al Administrador.</p>
        <Button variant="outline" onClick={salir}>Cerrar sesión</Button>
      </div>
    );
  }

  const can = (p: Permiso) => me.can(p);
  const items: NavItem[] = me.isEmpleado
    ? [{ to: "/mi-portal", label: "Mis equipos y actas", icon: Inbox, show: true }]
    : [
        { to: "/panel", label: "Panel", icon: LayoutDashboard, show: true },
        { to: "/equipos", label: "Inventario", icon: Laptop, show: true },
        { to: "/proveedores", label: "Proveedores", icon: Truck, show: true },
        { to: "/estadisticas", label: "Estadísticas", icon: BarChart3, show: true },
        { to: "/empleados", label: "Empleados", icon: Users, show: true },
        { to: "/actas/nueva", label: "Nueva acta", icon: FileSignature, show: can("actas_entrega") || can("actas_devolucion") },
        { to: "/actas", label: "Repositorio de actas", icon: FolderOpen, show: true },
        { to: "/carga-masiva", label: "Carga masiva", icon: Upload, show: can("cargas_masivas") },
        { to: "/reportes", label: "Reportes", icon: FileBarChart, show: can("reportes_exportar") },
        { to: "/catalogos", label: "Catálogos", icon: Tags, show: me.isAdmin },
        { to: "/usuarios", label: "Usuarios y permisos", icon: UserCog, show: me.isAdmin },
      ];

  const rol = me.isAdmin ? "Administrador" : me.isStaff ? "Auxiliar de soporte" : "Empleado";

  return (
    <div className="flex min-h-screen">
      {cargando && (
        <>
          <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/20"><div className="h-full w-1/3 animate-[carga_1.2s_ease-in-out_infinite] bg-primary" /></div>
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-md"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando datos...</div>
        </>
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
          <div>
            <div className="font-display text-lg font-extrabold tracking-tight text-sidebar-accent-foreground">FINESA</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-primary">Inventario y actas</div>
          </div>
          {me.isStaff && <CampanaAlertas />}
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.filter((i) => i.show).map((i) => (
            <Link
              key={i.to}
              to={i.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: i.to === "/actas" || i.to === "/panel" }}
              className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
            >
              <i.icon className="h-4 w-4 shrink-0" /> {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-sidebar-accent-foreground">{me.nombre}</div>
              <div className="text-xs text-sidebar-primary">{rol}</div>
            </div>
            <Link
              to="/ajustes"
              className="flex shrink-0 items-center gap-1.5 rounded border border-sidebar-border px-2 py-1.5 text-xs hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
            >
              <Settings className="h-3.5 w-3.5" /> Ajustes
            </Link>
          </div>
          <button onClick={salir} className="mt-3 flex items-center gap-2 text-xs hover:text-sidebar-accent-foreground">
            <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu className="h-5 w-5" /></button>
          <span className="font-display font-extrabold text-primary">FINESA</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
