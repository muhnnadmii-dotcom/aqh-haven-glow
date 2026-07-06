import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  type: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(1).max(4000),
});

export const submitContactInquiry = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Also archive to contact_requests for the raw log
    await supabaseAdmin.from("contact_requests").insert({
      name: data.name,
      phone: data.phone,
      type: data.type || "استفسار",
      message: data.message,
    });

    // Insert into service_requests so it appears in /admin/requests
    const { error } = await supabaseAdmin.from("service_requests").insert({
      type: "consultation",
      name: data.name,
      phone: data.phone,
      customer_notes: data.message,
      details: { source: "contact_form", request_subtype: data.type || "استفسار" },
      status: "new",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
