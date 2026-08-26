import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase-client";

const BUCKET = "service-images";

function isDirect(url: string) {
  return /^(https?:)?\/\//.test(url) || url.startsWith("/") || url.startsWith("data:");
}

/** Resolves either a direct URL or a private storage path into a usable image src. */
export function useResolvedImage(url?: string | null) {
  const [src, setSrc] = useState<string | null>(url && isDirect(url) ? url : null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }
    if (isDirect(url)) {
      setSrc(url);
      return;
    }
    let alive = true;
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(url, 60 * 60)
      .then(({ data }) => {
        if (alive) setSrc(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return src;
}

export function StorageImage({
  url,
  alt,
  className,
}: {
  url?: string | null;
  alt: string;
  className?: string;
}) {
  const src = useResolvedImage(url);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

export const SERVICE_IMAGE_BUCKET = BUCKET;
