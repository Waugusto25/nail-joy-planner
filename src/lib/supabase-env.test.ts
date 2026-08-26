import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEFAULT_SUPABASE_URL, resolveSupabaseServerUrl } from "./supabase-env";

describe("configuração do backend no servidor", () => {
  test("usa a mesma URL pública do navegador", () => {
    assert.equal(
      resolveSupabaseServerUrl({
        viteUrl: `${DEFAULT_SUPABASE_URL}/`,
        serverUrl: DEFAULT_SUPABASE_URL,
      }),
      DEFAULT_SUPABASE_URL,
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

  test("rejeita uma única URL externa em vez de consultar outro banco", () => {
    assert.throws(
      () => resolveSupabaseServerUrl({ serverUrl: "https://backend-vazio.example" }),
      /não pertence ao backend deste aplicativo/,
    );
  });

  test("aceita a URL canônica configurada no deploy", () => {
    assert.equal(
      resolveSupabaseServerUrl({
        viteUrl: `${DEFAULT_SUPABASE_URL}/`,
        serverUrl: DEFAULT_SUPABASE_URL,
      }),
      DEFAULT_SUPABASE_URL,
    );
  });

  test("mantém o backend padrão quando o deploy não fornece URL", () => {
    assert.equal(resolveSupabaseServerUrl({}), DEFAULT_SUPABASE_URL);
  });
});