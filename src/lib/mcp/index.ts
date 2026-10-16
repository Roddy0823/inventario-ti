import { auth, defineMcp } from "@lovable.dev/mcp-js";
import resumenInventario from "./tools/resumen-inventario";
import buscarEquipos from "./tools/buscar-equipos";
import listarActas from "./tools/listar-actas";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "inventario-ti",
  title: "Inventario TI",
  version: "0.1.0",
  instructions:
    "Consulta del inventario de equipos y actas de Finesa. Solo lectura; los datos respetan los permisos del usuario que inicia sesión.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [resumenInventario, buscarEquipos, listarActas],
});
