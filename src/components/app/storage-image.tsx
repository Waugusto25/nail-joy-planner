import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { resolveServiceImageFn } from "@/lib/service-images.functions";

const BUCKET = "service-images";
/**
 * Assets `/__l5e/...` são servidos pelo próprio domínio publicado. Mantemos o
 * caminho relativo: apontar para o endereço antigo gera redirecionamento entre
 * domínios, que o navegador do computador bloqueia em imagens.
 */
export function resolveDirectImageUrl(url?: string | null) {
  if (!url) return null;
  const legacy = url.match(/^https:\/\/nail-joy-planner\.lovable\.app(\/__l5e\/assets-v1\/.*)$/);
  return legacy ? legacy[1] : url;
}

function isDirect(url: string) {
  return /^(https?:)?\/\//.test(url) || url.startsWith("/") || url.startsWith("data:");
}

/** Resolves either a direct URL or a private storage path into a usable image src. */
export function useResolvedImage(url?: string | null) {
  const resolveImage = useServerFn(resolveServiceImageFn);
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
    setSrc(null);
    void resolveImage({ data: { path: nextUrl } })
      .then(({ signedUrl }) => {
        if (alive) setSrc(signedUrl);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [url, resolveImage]);

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
