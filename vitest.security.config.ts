import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit-test authorization handlers without TanStack's HTTP transport transform.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/lib/service-images.functions.test.ts"] },
});