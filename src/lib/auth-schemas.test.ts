import { describe, expect, test } from "bun:test";

import { phoneAccessInput, phoneSchema } from "./auth-schemas";

describe("normalização de telefone no acesso", () => {
  test("remove máscara, espaços e símbolos", () => {
    expect(phoneSchema.parse("(35) 99999-9999")).toBe("35999999999");
  });

  test("normaliza telefone da cliente e de indicação", () => {
    expect(
      phoneAccessInput.parse({
        fullName: "Cliente Teste",
        phone: "+55 (35) 99999-9999",
        referrerPhone: "(35) 98888-7777",
      }),
    ).toEqual({
      fullName: "Cliente Teste",
      phone: "5535999999999",
      referrerPhone: "35988887777",
    });
  });

  test("rejeita telefone sem DDD suficiente", () => {
    expect(() => phoneSchema.parse("9999-9999")).toThrow("Informe o telefone com DDD");
  });
});