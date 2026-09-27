import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/panel", replace: true });
    });
  }, [nav]);

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
    nav({ to: "/panel", replace: true });
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
        <form onSubmit={submit} className="w-full max-w-sm space-y-6">
          <div>
            <div className="font-display text-xl font-extrabold text-primary lg:hidden">FINESA</div>
            <h2 className="mt-2 text-2xl font-bold">Ingresar</h2>
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
      </main>
    </div>
  );
}
