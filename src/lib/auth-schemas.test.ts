import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { phoneAccessInput, phoneSchema } from "./auth-schemas";

describe("normalização de telefone no acesso", () => {
  test("remove máscara, espaços e símbolos", () => {
    assert.equal(phoneSchema.parse("(35) 99999-9999"), "35999999999");
  });

  test("normaliza telefone da cliente e de indicação", () => {
    assert.deepEqual(
      phoneAccessInput.parse({
        fullName: "Cliente Teste",
        phone: "+55 (35) 99999-9999",
        referrerPhone: "(35) 98888-7777",
      }),
      }),
      {
      fullName: "Cliente Teste",
      phone: "5535999999999",
      referrerPhone: "35988887777",
      },
    );
  });

  test("rejeita telefone sem DDD suficiente", () => {
    assert.throws(() => phoneSchema.parse("9999-9999"), /Informe o telefone com DDD/);
  });
});