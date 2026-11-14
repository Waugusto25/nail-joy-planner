import { describe, expect, it } from "vitest";
import { isGoogleBridgeSession } from "./google-access";

describe("isGoogleBridgeSession", () => {
  it("reconhece a sessão Google", () => {
    expect(isGoogleBridgeSession({ email: "maria@gmail.com", app_metadata: { provider: "google" } })).toBe(true);
  });
  it("não confunde a conta interna por telefone", () => {
    expect(isGoogleBridgeSession({ email: "maria@jannahnails.app", app_metadata: { provider: "email" } })).toBe(false);
  });
  it("ignora sessão ausente", () => {
    expect(isGoogleBridgeSession(null)).toBe(false);
  });
});

import { isLovableHost } from "./google-access";
describe("isLovableHost", () => {
  it("usa o login direto no domínio próprio da Vercel", () => {
    expect(isLovableHost("jannahnails.com")).toBe(false);
    expect(isLovableHost("www.jannahnails.com")).toBe(false);
  });
  it("mantém o atalho na hospedagem Lovable", () => {
    expect(isLovableHost("nail-joy-planner.lovable.app")).toBe(true);
  });
});
