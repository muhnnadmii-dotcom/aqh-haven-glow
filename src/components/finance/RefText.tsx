import { cn } from "@/lib/utils";

/**
 * Shorten long machine-style references while keeping any human prefix.
 * Rules:
 *  - If the text contains '#', shorten only the part after the LAST '#'.
 *    "سلة — تسوية #salla_payments-cdb6f047016b" → "سلة — تسوية #…047016b"
 *  - Otherwise, if the whole string is long, keep the last 8 chars: "…047016b".
 * Original text is always exposed via the native title tooltip.
 */
export function shortenRef(text: string): string {
  if (!text) return text;
  const hashIdx = text.lastIndexOf("#");
  if (hashIdx >= 0) {
    const prefix = text.slice(0, hashIdx + 1);
    const tail = text.slice(hashIdx + 1);
    if (tail.length > 10) return `${prefix}…${tail.slice(-8)}`;
    return text;
  }
  if (text.length > 20) return `…${text.slice(-8)}`;
  return text;
}

type Props = {
  text: string | null | undefined;
  className?: string;
  /** max width utility, defaults to a readable desktop cap */
  maxWidthClass?: string;
  fallback?: string;
};

export function RefText({ text, className, maxWidthClass = "max-w-[180px]", fallback = "—" }: Props) {
  const raw = (text ?? "").trim();
  if (!raw) return <span className={className}>{fallback}</span>;
  const short = shortenRef(raw);
  return (
    <span
      title={raw}
      className={cn("inline-block align-bottom truncate", maxWidthClass, className)}
    >
      {short}
    </span>
  );
}

export default RefText;
