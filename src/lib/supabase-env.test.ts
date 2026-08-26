import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEFAULT_SUPABASE_URL, resolveSupabaseServerUrl } from "./supabase-env";

describe("configuração do backend no servidor", () => {
  test("usa a mesma URL pública do navegador", () => {
    assert.equal(
      resolveSupabaseServerUrl({
        viteUrl: "https://backend-correto.example/",
        serverUrl: "https://backend-correto.example",
      }),
      "https://backend-correto.example",
    );
  });

  test("rejeita URLs diferentes antes de consultar o banco", () => {
    assert.throws(
      () =>
      resolveSupabaseServerUrl({
        viteUrl: "https://backend-correto.example",
        serverUrl: "https://backend-vazio.example",
      }),
      /apontam para bancos diferentes/,
    );
  });

  test("mantém o backend padrão quando o deploy não fornece URL", () => {
    assert.equal(resolveSupabaseServerUrl({}), DEFAULT_SUPABASE_URL);
  });
});