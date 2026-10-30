import assert from "node:assert/strict";
import { test } from "node:test";
import { reminderDates, whatsappConfigSchema, whatsappPhone } from "./whatsapp-rules";

test("reconfirmação é na véspera e loja um dia DEPOIS do vencimento, em Brasília", () => {
  assert.deepEqual(reminderDates(new Date("2026-10-30T01:00:00Z")), { salonDay: "2026-10-30", storeDueDay: "2026-10-28" });
});
test("chave e dados nunca enviados sem HTTPS", () => {
  assert.equal(whatsappConfigSchema.safeParse({ api_url: "http://45.39.210.139:8080", instance_name: "JannahNails", enabled: true }).success, false);
});
test("telefone normaliza DDI sem duplicar", () => {
  assert.equal(whatsappPhone("(35) 98844-4504"), "5535988444504");
  assert.equal(whatsappPhone("5535988444504"), "5535988444504");
  assert.throws(() => whatsappPhone("123"));
});