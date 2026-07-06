/**
 * Automated guard test: every /admin route MUST redirect an unauthenticated
 * visitor to /auth, and MUST NOT trigger any data-fetching (loaders, REST,
 * RPC, storage, functions) against the backend before the redirect.
 *
 * Run:  node tests/admin-auth-guard.spec.mjs [baseUrl]
 * Default baseUrl: http://localhost:8080
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:8080";
const SUPABASE_HOST = "smghxcukgztsedpebcoy.supabase.co";

// Every top-level /admin route in the app. Keep in sync with src/routes/_authenticated/admin.*
const ADMIN_ROUTES = [
  "/admin",
  "/admin/appointments",
  "/admin/articles",
  "/admin/content",
  "/admin/design",
  "/admin/design/about",
  "/admin/design/contact",
  "/admin/finance",
  "/admin/finance/attachments",
  "/admin/finance/audit",
  "/admin/finance/categories",
  "/admin/finance/expenses",
  "/admin/finance/export",
  "/admin/finance/import",
  "/admin/finance/import-batches",
  "/admin/finance/incomes",
  "/admin/finance/quotes",
  "/admin/finance/settings",
  "/admin/finance/suppliers",
  "/admin/gallery",
  "/admin/inventory",
  "/admin/inventory/catalog",
  "/admin/inventory/categories",
  "/admin/inventory/export",
  "/admin/inventory/products",
  "/admin/inventory/reports",
  "/admin/inventory/requests",
  "/admin/project-categories",
  "/admin/projects",
  "/admin/requests",
  "/admin/roles",
  "/admin/services",
  "/admin/site/navigation",
  "/admin/staff",
  "/admin/tanks",
  "/admin/testimonials",
  "/admin/translations",
  "/admin/users",
];

// Any Supabase call that is NOT a bare auth/session check is a leak.
// The guard runs `supabase.auth.getUser()` which hits /auth/v1/user — allowed.
const ALLOWED_SUPABASE_PATTERNS = [
  /\/auth\/v1\/user(\?|$)/,
  /\/auth\/v1\/token(\?|$)/,
  /\/auth\/v1\/settings(\?|$)/,
  /\/auth\/v1\/logout(\?|$)/,
];

function isForbiddenSupabaseCall(url) {
  if (!url.includes(SUPABASE_HOST)) return false;
  // REST, RPC, storage, functions, realtime — anything that reads data.
  if (
    url.includes("/rest/v1/") ||
    url.includes("/rpc/") ||
    url.includes("/storage/v1/") ||
    url.includes("/functions/v1/") ||
    url.includes("/realtime/")
  ) {
    return true;
  }
  // Any other /auth/v1/* endpoint that isn't in the allowlist.
  if (url.includes("/auth/v1/")) {
    return !ALLOWED_SUPABASE_PATTERNS.some((re) => re.test(url));
  }
  return false;
}

const results = [];
let failed = 0;

const browser = await chromium.launch({ headless: true });
try {
  for (const route of ADMIN_ROUTES) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const leaks = [];
    const serverFnCalls = [];

    page.on("request", (req) => {
      const url = req.url();
      if (isForbiddenSupabaseCall(url)) leaks.push(url);
      // TanStack server functions are exposed under /_serverFn/*
      if (url.includes("/_serverFn/")) serverFnCalls.push(url);
    });

    let finalUrl = "";
    let error = null;
    try {
      await page.goto(`${BASE}${route}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      finalUrl = page.url();
    } catch (e) {
      error = e.message;
      finalUrl = page.url();
    }

    const redirected = /\/auth(\?|$|\/)/.test(new URL(finalUrl).pathname + new URL(finalUrl).search);
    const ok = redirected && leaks.length === 0 && serverFnCalls.length === 0 && !error;
    if (!ok) failed++;

    results.push({
      route,
      finalUrl,
      redirected,
      leaks,
      serverFnCalls,
      error,
      ok,
    });

    await context.close();
  }
} finally {
  await browser.close();
}

// Report
console.log("\n=== Admin Auth-Guard Report ===\n");
for (const r of results) {
  const status = r.ok ? "PASS" : "FAIL";
  console.log(`[${status}] ${r.route}  →  ${new URL(r.finalUrl).pathname}${new URL(r.finalUrl).search}`);
  if (!r.redirected) console.log(`   ✗ did not redirect to /auth`);
  if (r.leaks.length) {
    console.log(`   ✗ forbidden backend calls (${r.leaks.length}):`);
    r.leaks.slice(0, 5).forEach((u) => console.log(`      - ${u}`));
  }
  if (r.serverFnCalls.length) {
    console.log(`   ✗ server-function calls (${r.serverFnCalls.length}):`);
    r.serverFnCalls.slice(0, 5).forEach((u) => console.log(`      - ${u}`));
  }
  if (r.error) console.log(`   ✗ navigation error: ${r.error}`);
}

console.log(`\nTotal: ${results.length}  Passed: ${results.length - failed}  Failed: ${failed}\n`);
process.exit(failed === 0 ? 0 : 1);
