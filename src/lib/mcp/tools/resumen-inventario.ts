import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "resumen_inventario",
  title: "Resumen del inventario",
  description: "Cuenta los equipos del inventario por estado (disponible, asignado, en reparación, de baja).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const { data, error } = await supabaseForUser(ctx).rpc("panel_conteos");
    if (error) throw new ToolError(error.message);
    const conteos = JSON.parse(JSON.stringify(data ?? {})) as Record<string, number>;
    return { content: [{ type: "text", text: JSON.stringify(conteos) }] };
  },
});
