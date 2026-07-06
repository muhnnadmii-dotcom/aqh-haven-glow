"""
Automated guard test: every /admin route MUST redirect an unauthenticated
visitor to /auth, and MUST NOT trigger any data-fetching (loaders, REST,
RPC, storage, functions, server-fns) against the backend before redirect.

Run:  python3 tests/admin_auth_guard.py [baseUrl]
"""
import asyncio, os, sys, re
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BASE_URL", "http://localhost:8080")
SUPABASE_HOST = "smghxcukgztsedpebcoy.supabase.co"

ADMIN_ROUTES = [
    "/admin",
    "/admin/appointments", "/admin/articles",
    "/admin/content", "/admin/design", "/admin/design/about", "/admin/design/contact",
    "/admin/finance", "/admin/finance/attachments", "/admin/finance/audit",
    "/admin/finance/categories", "/admin/finance/expenses", "/admin/finance/export",
    "/admin/finance/import", "/admin/finance/import-batches", "/admin/finance/incomes",
    "/admin/finance/quotes", "/admin/finance/settings", "/admin/finance/suppliers",
    "/admin/gallery",
    "/admin/inventory", "/admin/inventory/catalog", "/admin/inventory/categories",
    "/admin/inventory/export", "/admin/inventory/products", "/admin/inventory/reports",
    "/admin/inventory/requests",
    "/admin/project-categories", "/admin/projects", "/admin/requests", "/admin/roles",
    "/admin/services", "/admin/site/navigation", "/admin/staff", "/admin/tanks",
    "/admin/testimonials", "/admin/translations", "/admin/users",
]

ALLOWED_AUTH = [
    re.compile(r"/auth/v1/user(\?|$)"),
    re.compile(r"/auth/v1/token(\?|$)"),
    re.compile(r"/auth/v1/settings(\?|$)"),
    re.compile(r"/auth/v1/logout(\?|$)"),
]

def is_forbidden(url: str) -> bool:
    if SUPABASE_HOST not in url:
        return False
    if any(seg in url for seg in ("/rest/v1/", "/rpc/", "/storage/v1/", "/functions/v1/", "/realtime/")):
        return True
    if "/auth/v1/" in url:
        return not any(r.search(url) for r in ALLOWED_AUTH)
    return False

async def main():
    failed = 0
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for route in ADMIN_ROUTES:
                ctx = await browser.new_context(viewport={"width": 1280, "height": 800})
                page = await ctx.new_page()
                leaks, server_fns = [], []
                # Only count backend requests that fire while we're still on the /admin URL.
                # Requests made after the redirect to /auth are the public shell (Navbar/Footer)
                # and are allowed — /auth is a public route.
                def on_request(req):
                    try:
                        current = urlparse(page.url).path
                    except Exception:
                        current = ""
                    if not current.startswith("/admin"):
                        return
                    url = req.url
                    if is_forbidden(url):
                        leaks.append(url)
                    if "/_serverFn/" in url:
                        server_fns.append(url)
                page.on("request", on_request)
                err = None
                try:
                    await page.goto(f"{BASE}{route}", wait_until="networkidle", timeout=15000)
                except Exception as e:
                    err = str(e).splitlines()[0]
                final = page.url
                parsed = urlparse(final)
                redirected = parsed.path.startswith("/auth")
                ok = redirected and not leaks and not server_fns and not err
                if not ok:
                    failed += 1
                results.append((route, parsed.path + (("?" + parsed.query) if parsed.query else ""),
                                redirected, leaks, server_fns, err, ok))
                await ctx.close()
        finally:
            await browser.close()


    print("\n=== Admin Auth-Guard Report ===\n")
    for route, final, redirected, leaks, sfns, err, ok in results:
        print(f"[{'PASS' if ok else 'FAIL'}] {route}  →  {final}")
        if not redirected: print("   ✗ did not redirect to /auth")
        if leaks:
            print(f"   ✗ forbidden backend calls ({len(leaks)}):")
            for u in leaks[:5]: print(f"      - {u}")
        if sfns:
            print(f"   ✗ server-function calls ({len(sfns)}):")
            for u in sfns[:5]: print(f"      - {u}")
        if err: print(f"   ✗ error: {err}")
    print(f"\nTotal: {len(results)}  Passed: {len(results)-failed}  Failed: {failed}\n")
    sys.exit(0 if failed == 0 else 1)

asyncio.run(main())
