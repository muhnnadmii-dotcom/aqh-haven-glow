import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { onImageError, IMAGE_PLACEHOLDER } from "@/lib/storage";
import { attachmentUrl, isImage, type AttachmentRow } from "@/lib/request-attachments";

/** Resolve a request_attachments row to a URL (signed for the private bucket). */
export function useAttachmentUrl(row: Pick<AttachmentRow, "file_path" | "bucket">): string {
  const [url, setUrl] = useState<string>(IMAGE_PLACEHOLDER);
  useEffect(() => {
    let active = true;
    attachmentUrl(row).then((u) => { if (active) setUrl(u); });
    return () => { active = false; };
  }, [row.file_path, row.bucket]);
  return url;
}

/** Display tile for an attachment image or PDF link. */
export function AttachmentTile({
  row,
  onOpen,
  alt,
  className,
}: {
  row: AttachmentRow;
  onOpen?: (url: string) => void;
  alt?: string;
  className?: string;
}) {
  const url = useAttachmentUrl(row);
  const img = isImage(row.file_type, row.file_name);
  if (img) {
    return (
      <button onClick={() => onOpen?.(url)} className={className ?? "block w-full aspect-square"}>
        <img
          src={url}
          onError={onImageError}
          alt={alt ?? row.file_name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </button>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={className ?? "flex flex-col items-center justify-center aspect-square text-muted-foreground hover:text-gold"}
    >
      <FileText size={28} />
      <span className="text-[10px] mt-1 px-2 truncate w-full text-center">PDF</span>
    </a>
  );
}
