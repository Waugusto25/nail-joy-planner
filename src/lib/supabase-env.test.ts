import { describe, expect, test } from "bun:test";

import { DEFAULT_SUPABASE_URL, resolveSupabaseServerUrl } from "./supabase-env";

describe("configuração do backend no servidor", () => {
  test("usa a mesma URL pública do navegador", () => {
    expect(
      resolveSupabaseServerUrl({
        viteUrl: "https://backend-correto.example/",
        serverUrl: "https://backend-correto.example",
      }),
    ).toBe("https://backend-correto.example");
  });

  test("rejeita URLs diferentes antes de consultar o banco", () => {
    expect(() =>
      resolveSupabaseServerUrl({
        viteUrl: "https://backend-correto.example",
        serverUrl: "https://backend-vazio.example",
      }),
    ).toThrow("apontam para bancos diferentes");
  });

  test("mantém o backend padrão quando o deploy não fornece URL", () => {
    expect(resolveSupabaseServerUrl({})).toBe(DEFAULT_SUPABASE_URL);
  });
});