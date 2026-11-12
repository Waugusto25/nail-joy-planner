import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sign: vi.fn(), from: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ middleware: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }),
}));
vi.mock("./supabase-auth-middleware", () => ({ requireServerSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { storage: { from: mocks.from } },
}));

import { resolveServiceImageFn } from "./service-images.functions";

type Invocation = {
  data: { path: string };
  context: { supabase: ReturnType<typeof caller> };
};
const invoke = resolveServiceImageFn as unknown as (input: Invocation) => Promise<{ signedUrl: string | null }>;
function caller(ownUrl: string | null, published: boolean, failed = false) {
  const eq = vi.fn().mockReturnThis();
  return {
    eq,
    storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn(async () => ({ data: ownUrl ? { signedUrl: ownUrl } : null })) })) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq, limit: vi.fn(async () => ({
      data: published ? [{ id: "service" }] : [], error: failed ? { message: "unavailable" } : null,
    })) })) })),
  };
}

describe("private service image authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sign.mockResolvedValue({ data: { signedUrl: "https://images.example/signed" } });
    mocks.from.mockReturnValue({ createSignedUrl: mocks.sign });
  });
  it("uses caller RLS for owners and administrators without privileged signing", async () => {
    const result = await invoke({ data: { path: "servicos/photo.png" }, context: { supabase: caller("owner-url", false) } });
    expect(result.signedUrl).toBe("owner-url");
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("denies unpublished files without privileged storage access", async () => {
    const result = await invoke({ data: { path: "servicos/private.png" }, context: { supabase: caller(null, false) } });
    expect(result.signedUrl).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("signs only the exact active service photo for five minutes", async () => {
    const db = caller(null, true);
    await invoke({ data: { path: "servicos/published.png" }, context: { supabase: db } });
    expect(db.from).toHaveBeenCalledWith("services");
    expect(db.eq).toHaveBeenCalledWith("active", true);
    expect(db.eq).toHaveBeenCalledWith("image_url", "servicos/published.png");
    expect(mocks.sign).toHaveBeenCalledWith("servicos/published.png", 300);
  });
  it("fails closed if the service authorization query fails", async () => {
    const result = await invoke({ data: { path: "servicos/photo.png" }, context: { supabase: caller(null, true, true) } });
    expect(result.signedUrl).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});