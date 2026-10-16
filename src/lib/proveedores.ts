export const ETIQUETAS_PROVEEDOR = ["Venta de Hardware", "Periféricos y Accesorios", "Servicio Técnico / Reparaciones", "Licenciamiento"] as const;
export const ETIQUETA_SERVICIO = "Servicio Técnico / Reparaciones";
export const FORMAS_PAGO = ["Contado", "Crédito 30 días", "Crédito 60 días", "Otro"] as const;

export type Prov = {
  id: string; nombre: string; nit: string | null; ciudad: string | null; direccion: string | null; sitio_web: string | null;
  contacto_nombre: string | null; asesor_telefono: string | null; telefono: string | null; whatsapp: string | null; email: string | null;
  etiquetas: string[]; dias_entrega: number | null; forma_pago: string | null; activo: boolean; notas: string | null;
};

export const cop = (n: number | null | undefined) => (n == null ? "—" : `$${Number(n).toLocaleString("es-CO")}`);
export const telLink = (s: string) => `tel:${s.replace(/[^\d+]/g, "")}`;
export const waNum = (s: string) => { const d = s.replace(/\D/g, ""); return d.length === 10 ? `57${d}` : d; };
export const celular = (p: Pick<Prov, "whatsapp" | "telefono" | "asesor_telefono">) => p.whatsapp || p.telefono || p.asesor_telefono || "";
export const telefonoPrincipal = (p: Pick<Prov, "whatsapp" | "telefono" | "asesor_telefono">) => p.asesor_telefono || p.telefono || p.whatsapp || "";

export function mensajeReabastecer(asesor: string | null, articulo: string, cantidad: number) {
  return `Hola${asesor ? ` ${asesor}` : ""}, te escribo desde el área de TI. Actualmente requerimos cotización y disponibilidad para reabastecer ${articulo} (Cantidad requerida: ${cantidad} unidades). Quedo atento.`;
}
export const waLink = (p: Prov, texto: string) => `https://wa.me/${waNum(celular(p))}?text=${encodeURIComponent(texto)}`;
export const mailLink = (p: Prov, asunto: string, texto: string) => `mailto:${p.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
