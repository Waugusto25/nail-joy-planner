import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireServerSupabaseAuth } from "./supabase-auth-middleware";

/** Private files stay owner/admin-only; publishing a service authorizes its exact photo. */
export const resolveServiceImageFn = createServerFn({ method: "POST" })
  .middleware([requireServerSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    path: z.string().min(1).max(512).regex(/^servicos\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/),
  }).parse(input))
  .handler(async ({ data, context }): Promise<{ signedUrl: string | null }> => {
    const ownImage = await context.supabase.storage.from("service-images").createSignedUrl(data.path, 300);
    if (ownImage.data?.signedUrl) return { signedUrl: ownImage.data.signedUrl };

    // Check the caller's accessible service records before using privileged storage signing.
    const { data: published, error } = await context.supabase.from("services")
      .select("id").eq("active", true).eq("image_url", data.path).limit(1);
    if (error || !published?.length) return { signedUrl: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: image } = await supabaseAdmin.storage.from("service-images").createSignedUrl(data.path, 300);
    return { signedUrl: image?.signedUrl ?? null };
  });