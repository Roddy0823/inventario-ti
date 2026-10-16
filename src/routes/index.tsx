import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ingresoEmpleado } from "@/lib/usuarios.functions";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},
  head: () => ({
    meta: [
      { title: "Ingresar — Finesa Inventario y Actas" },
      { name: "description", content: "Acceso al sistema de inventario de equipos y actas digitales de Finesa." },
      { property: "og:title", content: "Ingresar — Finesa Inventario y Actas" },
      { property: "og:description", content: "Acceso al sistema de inventario de equipos y actas digitales de Finesa." },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<"empleado" | "personal">("empleado");
  const [cedula, setCedula] = useState("");
  const [pin, setPin] = useState("");
  const ingresar = useServerFn(ingresoEmpleado);
  const { next } = Route.useSearch();
  const destino = next ? oauthReturnPath(next) : null;
  const irDestino = () => { if (destino && destino !== "/") window.location.assign(destino); else nav({ to: "/panel", replace: true }); };

  async function submitEmpleado(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await ingresar({ data: { cedula, pin } });
      if ("error" in r) { toast.error(r.error); setLoading(false); return; }
      const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
      if (error) throw error;
      qc.removeQueries({ queryKey: ["me"] });
      irDestino();
    } catch {
      toast.error("No fue posible ingresar. Intente de nuevo.");
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) irDestino();
    });
  }, [nav, destino]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      toast.error(error.message.includes("banned") ? "Su cuenta está suspendida." : "Correo o contraseña incorrectos.");
      return;
    }
    await supabase.rpc("log_evento", { p_accion: "LOGIN", p_detalle: "Inicio de sesión" });
    qc.removeQueries({ queryKey: ["me"] });
    irDestino();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <div className="font-display text-2xl font-extrabold tracking-tight">FINESA</div>
        <div className="max-w-md">
          <p className="text-sm uppercase tracking-[0.2em] text-sidebar-primary">Gestión de activos TI</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">Inventario de equipos y actas digitales con trazabilidad completa.</h1>
          <p className="mt-6 flex items-center gap-2 text-sm text-sidebar-primary">
            <ShieldCheck className="h-4 w-4" /> Firmas con registro de fecha, hora e IP — Ley 527 de 1999
          </p>
        </div>
        <div className="text-xs text-sidebar-primary">Uso interno exclusivo</div>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
        <div className="grid grid-cols-2 rounded-md border border-border p-1 text-sm">
          <button type="button" onClick={() => setModo("empleado")} className={`rounded px-3 py-1.5 ${modo === "empleado" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Empleado</button>
          <button type="button" onClick={() => setModo("personal")} className={`rounded px-3 py-1.5 ${modo === "personal" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Mesa de ayuda</button>
        </div>
        {modo === "empleado" ? (
        <form onSubmit={submitEmpleado} className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Portal del empleado</h2>
            <p className="text-sm text-muted-foreground">Ingrese con su número de cédula y el PIN de 4 dígitos que le entregó la mesa de ayuda.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cedula">Número de cédula</Label>
            <Input id="cedula" inputMode="numeric" autoComplete="username" required value={cedula} onChange={(e) => setCedula(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN</Label>
            <Input id="pin" type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" autoComplete="current-password" required value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ""))} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</Button>
          <p className="text-center text-xs text-muted-foreground">¿Olvidó su PIN? Solicite uno nuevo a la mesa de ayuda.</p>
        </form>
        ) : (
        <form onSubmit={submit} className="space-y-6">
          <div>
            <div className="font-display text-xl font-extrabold text-primary lg:hidden">FINESA</div>
            <h2 className="mt-2 text-2xl font-bold">Mesa de ayuda</h2>
            <p className="text-sm text-muted-foreground">Use su correo corporativo y contraseña.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link to="/recuperar" className="text-xs text-muted-foreground underline-offset-4 hover:underline">¿Olvidó su contraseña?</Link>
            </div>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</Button>
          <p className="text-center text-xs text-muted-foreground">No hay registro público. Solicite su cuenta al Administrador.</p>
        </form>
        )}
        </div>
      </main>
    </div>
  );
}
