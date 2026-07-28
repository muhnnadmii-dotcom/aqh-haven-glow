import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listMyServiceRequestsTool from "./tools/list_my_service_requests";

// OAuth issuer MUST be the direct Supabase host, not the .lovable.cloud proxy.
// See app-mcp-server-authoring knowledge for the reasoning.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "aqua-haven-mcp",
  title: "Aqua Haven",
  version: "0.1.0",
  instructions:
    "Tools for the authenticated Aqua Haven user. Use `whoami` to verify the session, and `list_my_service_requests` to read the caller's own service requests. All data access is scoped by Row Level Security to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listMyServiceRequestsTool],
});
