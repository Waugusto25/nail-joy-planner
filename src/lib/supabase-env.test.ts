import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEFAULT_SUPABASE_URL, resolveSupabaseServerUrl } from "./supabase-env";

describe("configuração do backend no servidor", () => {
  test("prioriza a URL injetada no servidor", () => {
    assert.equal(
      resolveSupabaseServerUrl({
        viteUrl: "https://backend-do-navegador.example",
        serverUrl: "https://backend-do-servidor.example/",
      }),
      "https://backend-do-servidor.example",
    );
  });

  test("aceita uma URL externa injetada sem validar ID de projeto", () => {
    assert.equal(
      resolveSupabaseServerUrl({ serverUrl: "https://backend-atual.example/" }),
      "https://backend-atual.example",
    );
  });

  test("usa VITE_SUPABASE_URL quando SUPABASE_URL não existe", () => {
    assert.equal(
      resolveSupabaseServerUrl({ viteUrl: "https://backend-do-navegador.example/" }),
      "https://backend-do-navegador.example",
    );
  });

  test("mantém o backend padrão quando o deploy não fornece URL", () => {
    assert.equal(resolveSupabaseServerUrl({}), DEFAULT_SUPABASE_URL);
  });
});