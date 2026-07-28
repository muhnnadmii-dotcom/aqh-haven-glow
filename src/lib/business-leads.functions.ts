import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().default(""),
  industry: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  budget: z.string().trim().max(120).optional().default(""),
  timeline: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(1).max(4000),
  source: z.string().trim().max(60).optional().default("business_lead"),
  page: z.string().trim().max(120).optional().default(""),
  // Optional business-visit fields
  facility_name: z.string().trim().max(160).optional().default(""),
  facility_type: z.string().trim().max(160).optional().default(""),
  need_type: z.string().trim().max(160).optional().default(""),
  preferred_time: z.string().trim().max(160).optional().default(""),
});

export const submitBusinessLead = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const source = data.source || "business_lead";
    const readable = [
      data.facility_name && `المنشأة: ${data.facility_name}`,
      data.company && !data.facility_name && `الشركة/الجهة: ${data.company}`,
      data.facility_type && `نوع المنشأة: ${data.facility_type}`,
      data.industry && !data.facility_type && `القطاع: ${data.industry}`,
      data.need_type && `نوع الاحتياج: ${data.need_type}`,
      data.city && `المدينة: ${data.city}`,
      data.preferred_time && `الوقت المناسب: ${data.preferred_time}`,
      data.budget && `الميزانية: ${data.budget}`,
      data.timeline && `الإطار الزمني: ${data.timeline}`,
      data.email && `البريد: ${data.email}`,
      data.page && `الصفحة: ${data.page}`,
      "",
      data.message,
    ].filter(Boolean).join("\n");

    await supabaseAdmin.from("contact_requests").insert({
      name: data.name,
      phone: data.phone,
      type: source,
      message: readable,
    });

    const { error } = await supabaseAdmin.from("service_requests").insert({
      type: "consultation",
      name: data.name,
      phone: data.phone,
      customer_notes: readable,
      details: {
        source,
        request_subtype: source,
        company: data.company || data.facility_name || null,
        facility_name: data.facility_name || null,
        facility_type: data.facility_type || null,
        need_type: data.need_type || null,
        preferred_time: data.preferred_time || null,
        industry: data.industry || null,
        city: data.city || null,
        budget: data.budget || null,
        timeline: data.timeline || null,
        email: data.email || null,
        page: data.page || null,
      },
      status: "new",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
