import assert from "node:assert/strict";
import { test } from "node:test";
import { settleFromMpPayment } from "./mercado-pago-settle.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

test("Pix aprovado usa baixa atômica verificada, sem alteração direta ou repetição", async () => {
  let calls = 0;
  const db = { rpc: async (name: string, args: Record<string, unknown>) => {
    calls++;
    assert.equal(name, "settle_verified_mp");
    assert.equal(args["p_payment_id"], "123");
    assert.equal(args["p_amount_cents"], 100);
    return { data: calls === 1 ? "paid" : "already_paid", error: null };
  } } as unknown as SupabaseClient<Database>;
  const payment = { id: 123, status: "approved", external_reference: null, transaction_amount: 1, date_approved: null };
  process.env["REMINDERS_SERVICE_TOKEN"] = "local-test-only";
  try {
    assert.equal(await settleFromMpPayment(db, payment), "paid");
    assert.equal(await settleFromMpPayment(db, payment), "already_paid");
  } finally { delete process.env["REMINDERS_SERVICE_TOKEN"]; }
});