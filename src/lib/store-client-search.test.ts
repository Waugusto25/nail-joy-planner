import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { matchesStoreClient } from "./store-client-search";

const client = { full_name: "Márcia Oliveira", nickname: "Vizinha", phone: "35992718433" };

describe("pesquisa de cliente no novo pedido", () => {
  test("filtra nomes enquanto digita, sem diferenciar acentos e maiúsculas", () => {
    assert.equal(matchesStoreClient(client, "m"), true);
    assert.equal(matchesStoreClient(client, "MARCIA"), true);
    assert.equal(matchesStoreClient(client, "Wellington"), false);
  });
  test("pesquisa também pelo apelido", () => {
    assert.equal(matchesStoreClient(client, "VIZINHA"), true);
    assert.equal(matchesStoreClient(client, "Cunhado"), false);
  });
  test("pesquisa telefone com ou sem máscara", () => {
    assert.equal(matchesStoreClient(client, "(35) 99271"), true);
    assert.equal(matchesStoreClient(client, "8433"), true);
    assert.equal(matchesStoreClient(client, "(67) 99271"), false);
  });
  test("busca vazia mantém todos os clientes disponíveis", () => {
    assert.equal(matchesStoreClient(client, "  "), true);
  });
});