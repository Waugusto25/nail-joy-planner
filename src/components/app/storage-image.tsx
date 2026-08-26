import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase-client";

const BUCKET = "service-images";
const LOVABLE_ASSET_ORIGIN = "https://nail-joy-planner.lovable.app";

/**
 * Assets do Lovable salvos como `/__l5e/...` quebram em deploy externo,
 * porque o domínio próprio tenta servir esse caminho localmente. Forçamos a
 * origem publicada do Lovable, que é onde esses arquivos existem de fato.
 */
export function resolveDirectImageUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("/__l5e/assets-v1/")) return `${LOVABLE_ASSET_ORIGIN}${url}`;
  return url;
}

function isDirect(url: string) {
  return /^(https?:)?\/\//.test(url) || url.startsWith("/") || url.startsWith("data:");
}

/** Resolves either a direct URL or a private storage path into a usable image src. */
export function useResolvedImage(url?: string | null) {
  const normalized = resolveDirectImageUrl(url);
  const [src, setSrc] = useState<string | null>(normalized && isDirect(normalized) ? normalized : null);

  useEffect(() => {
    const nextUrl = resolveDirectImageUrl(url);
    if (!nextUrl) {
      setSrc(null);
      return;
    }
    if (isDirect(nextUrl)) {
      setSrc(nextUrl);
      return;
    }
    let alive = true;
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(nextUrl, 60 * 60)
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
