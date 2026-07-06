import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useLang } from "./LangProvider";
import { autoTranslate } from "./autoTranslate.functions";

/**
 * Runtime DOM auto-translator.
 *
 * When lang === "en", walks the DOM and replaces any Arabic-containing text node
 * with an English translation fetched from `autoTranslate` (cached in
 * public.ui_translations). When lang flips back to "ar", originals are restored.
 *
 * Skip rules:
 *  - Elements with [data-no-translate] (and all descendants)
 *  - <script>, <style>, <code>, <pre>, <input>, <textarea>, <select>, <svg>
 *  - Text nodes that don't contain any Arabic characters
 *
 * The original Arabic text is preserved on the text node itself
 * (`node.__i18nSrc`) so switching back to Arabic is instant.
 */

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "CODE",
  "PRE",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "SVG",
  "NOSCRIPT",
]);
const STORAGE_KEY = "aqh_auto_translations_v1";

type Cache = Record<string, string>;

function loadCache(): Cache {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}
function saveCache(c: Cache) {
  try {
    // Keep last 2000 entries max to prevent unbounded growth
    const entries = Object.entries(c);
    if (entries.length > 2000) {
      const trimmed = Object.fromEntries(entries.slice(-2000));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    }
  } catch {
    /* ignore quota */
  }
}

function shouldSkip(node: Node): boolean {
  let el: Node | null = node.parentNode;
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    const e = el as HTMLElement;
    if (SKIP_TAGS.has(e.tagName)) return true;
    if (e.hasAttribute && e.hasAttribute("data-no-translate")) return true;
    el = e.parentNode;
  }
  return false;
}

function collectArabicTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = n as Text;
      const raw = t.nodeValue;
      if (!raw) return NodeFilter.FILTER_REJECT;
      if (!ARABIC_RE.test(raw)) return NodeFilter.FILTER_REJECT;
      if (shouldSkip(t)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  return nodes;
}

// Track originals on text nodes via a WeakMap (nodes are transient).
const originals = new WeakMap<Text, string>();
// Live registry of Arabic->text nodes so we can update them once the batch resolves
// or when re-visiting the page after cache hydration.
const pendingByText = new Map<string, Set<Text>>();

export function AutoTranslator() {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cacheRef = useRef<Cache>({});
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queueRef = useRef<Set<string>>(new Set());
  const flushTimer = useRef<number | null>(null);
  const mutationSuppress = useRef(0);

  // Hydrate cache from localStorage once
  useEffect(() => {
    cacheRef.current = loadCache();
  }, []);

  const applyTranslation = (node: Text, translated: string) => {
    // Preserve leading/trailing whitespace of the original text node
    const src = node.nodeValue ?? "";
    const leading = src.match(/^\s*/)?.[0] ?? "";
    const trailing = src.match(/\s*$/)?.[0] ?? "";
    mutationSuppress.current++;
    node.nodeValue = `${leading}${translated}${trailing}`;
    // release suppression on microtask
    queueMicrotask(() => {
      mutationSuppress.current = Math.max(0, mutationSuppress.current - 1);
    });
  };

  const scheduleFlush = () => {
    if (flushTimer.current !== null) return;
    flushTimer.current = window.setTimeout(async () => {
      flushTimer.current = null;
      const batch = Array.from(queueRef.current);
      queueRef.current.clear();
      if (batch.length === 0) return;
      try {
        // API limits to 60 per call; chunk if needed.
        const chunks: string[][] = [];
        for (let i = 0; i < batch.length; i += 50) chunks.push(batch.slice(i, i + 50));
        for (const chunk of chunks) {
          const { translations } = await autoTranslate({ data: { texts: chunk, to: "en" } });
          for (const [src, tr] of Object.entries(translations)) {
            cacheRef.current[src] = tr;
            const set = pendingByText.get(src);
            if (set) {
              for (const node of set) {
                if (node.isConnected) applyTranslation(node, tr);
              }
              pendingByText.delete(src);
            }
          }
        }
        saveCache(cacheRef.current);
      } catch (err) {
        console.warn("[AutoTranslator] batch failed", err);
      }
    }, 250);
  };

  const processRoot = (root: Node) => {
    const nodes = collectArabicTextNodes(root);
    for (const node of nodes) {
      const raw = node.nodeValue ?? "";
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (!originals.has(node)) originals.set(node, raw);
      const cached = cacheRef.current[trimmed];
      if (cached) {
        applyTranslation(node, cached);
      } else {
        const set = pendingByText.get(trimmed) ?? new Set<Text>();
        set.add(node);
        pendingByText.set(trimmed, set);
        queueRef.current.add(trimmed);
      }
    }
    if (queueRef.current.size > 0) scheduleFlush();
  };

  const restoreAll = () => {
    // Walk all text nodes; restore any that we've tracked.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n as Text;
      const orig = originals.get(t);
      if (orig !== undefined && t.nodeValue !== orig) {
        mutationSuppress.current++;
        t.nodeValue = orig;
        queueMicrotask(() => {
          mutationSuppress.current = Math.max(0, mutationSuppress.current - 1);
        });
      }
    }
    pendingByText.clear();
    queueRef.current.clear();
  };

  // Main effect: react to lang + route changes
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (lang === "ar") {
      restoreAll();
      return;
    }
    // First pass after route change (defer a tick so React finishes paint)
    const raf = requestAnimationFrame(() => processRoot(document.body));

    // Observe dynamic content
    const observer = new MutationObserver((records) => {
      if (mutationSuppress.current > 0) return;
      for (const rec of records) {
        if (rec.type === "childList") {
          rec.addedNodes.forEach((n) => {
            if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
              processRoot(n);
            }
          });
        } else if (rec.type === "characterData") {
          const t = rec.target as Text;
          if (t.nodeValue && ARABIC_RE.test(t.nodeValue) && !shouldSkip(t)) {
            processRoot(t);
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [lang, pathname]);

  return null;
}
