// Run: npm run test:whatsapp
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

process.env.WHATSAPP_TOKEN_KEY = crypto.randomBytes(32).toString("base64");

import { encryptSecret, decryptSecret, maskSecret } from "./crypto";
import {
  toMetaComponents, buildSendComponents, validateDraft, renderText, namedFromPositional,
  unsupportedFields, STARTERS, type TemplateDraft,
} from "./template-model";
import { __setFetch, sendTemplateMessage, createTemplate, listTemplates, GraphError } from "./graph";

test("encrypt/decrypt round-trip, random IV, tamper detection", () => {
  const a = encryptSecret("EAAG-secret-token");
  const b = encryptSecret("EAAG-secret-token");
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a), "EAAG-secret-token");
  const tampered = a.slice(0, -4) + (a.endsWith("A") ? "B" : "A") + a.slice(-3);
  assert.throws(() => decryptSecret(tampered));
  assert.equal(maskSecret("EAAG123456"), "••••3456");
});

const draft: TemplateDraft = {
  name: "binaya_invoice", language: "ar", category: "UTILITY", purpose: "INVOICE",
  header: "فاتورة {{invoice_number}}",
  body: "مرحبًا {{guest_name}}، فاتورتك {{invoice_number}} بقيمة {{invoice_total}}.\nرابط: {{document_link}}\nشكرًا.",
  footer: "Binaya",
};

test("named PMS fields become positional variables with samples", () => {
  const { components, variableMap } = toMetaComponents(draft);
  assert.deepEqual(variableMap.header, ["invoice_number"]);
  assert.deepEqual(variableMap.body, ["guest_name", "invoice_number", "invoice_total", "document_link"]);
  const body = components.find((c: any) => c.type === "BODY") as any;
  assert.equal(body.text, "مرحبًا {{1}}، فاتورتك {{2}} بقيمة {{3}}.\nرابط: {{4}}\nشكرًا.");
  assert.equal(body.example.body_text[0].length, 4);
  const header = components.find((c: any) => c.type === "HEADER") as any;
  assert.equal(header.text, "فاتورة {{1}}");
  assert.equal(namedFromPositional(body.text, variableMap.body), draft.body);
});

test("send components follow the slot order", () => {
  const { variableMap } = toMetaComponents(draft);
  const comps = buildSendComponents(variableMap, { guest_name: "Salim", invoice_number: "INV-1", invoice_total: "OMR 10.000", document_link: "https://x/y" }) as any[];
  assert.equal(comps[0].type, "header");
  assert.deepEqual(comps[0].parameters, [{ type: "text", text: "INV-1" }]);
  assert.deepEqual(comps[1].parameters.map((p: any) => p.text), ["Salim", "INV-1", "OMR 10.000", "https://x/y"]);
  // a missing value never sends an empty parameter (Meta rejects those)
  const c2 = buildSendComponents({ header: [], body: ["guest_name"] }, {}) as any[];
  assert.equal(c2[0].parameters[0].text, "-");
});

test("validation mirrors Meta rules", () => {
  assert.deepEqual(validateDraft(draft), []);
  assert.ok(validateDraft({ ...draft, name: "Bad Name" }).includes("nameFormat"));
  assert.ok(validateDraft({ ...draft, body: "{{guest_name}} مرحبًا" }).includes("varAtEdge"));
  assert.ok(validateDraft({ ...draft, body: "مرحبًا {{guest_name}}." }).includes("varAtEdge"));
  assert.ok(validateDraft({ ...draft, body: "مرحبًا {{guest_name}} {{invoice_number}} شكرًا" }).includes("adjacentVars"));
  assert.ok(validateDraft({ ...draft, body: "مرحبًا {{nope}} شكرًا" }).includes("unknownField"));
  assert.ok(validateDraft({ ...draft, footer: "{{org_name}}" }).includes("footerVars"));
  assert.ok(validateDraft({ ...draft, buttons: [{ type: "URL", text: "Open", url: "http://insecure" }] }).includes("buttonUrl"));
});

test("every starter template is valid and fillable from its document", () => {
  for (const s of STARTERS) {
    assert.deepEqual(validateDraft(s), [], `${s.name}/${s.language}`);
    const { variableMap } = toMetaComponents(s);
    const doc = s.purpose === "INVOICE" ? "invoice" : s.purpose === "RECEIPT" ? "receipt" : "reservation";
    assert.deepEqual(unsupportedFields(variableMap, doc), [], `${s.name}/${s.language}`);
  }
});

test("preview renders values and keeps unknown tokens visible", () => {
  assert.equal(renderText("Hi {{guest_name}} / {{x_y}}", { guest_name: "Ali" }), "Hi Ali / {{x_y}}");
});

test("graph client: send template request shape + error mapping", async () => {
  const calls: { url: string; init: any }[] = [];
  __setFetch(async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/messages")) return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 });
    if (url.includes("message_templates") && init?.method === "POST")
      return new Response(JSON.stringify({ error: { message: "Invalid parameter", code: 100, error_user_msg: "Name exists" } }), { status: 400 });
    return new Response(JSON.stringify({ data: [{ id: "t1", name: "a", language: "ar", status: "APPROVED", category: "UTILITY", components: [] }], paging: {} }), { status: 200 });
  });
  const r = await sendTemplateMessage("TOKEN", "123", { to: "96890000000", name: "binaya_invoice", language: "ar", components: [] });
  assert.equal(r.messages[0].id, "wamid.1");
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.messaging_product, "whatsapp");
  assert.equal(sent.template.language.code, "ar");
  assert.equal(calls[0].init.headers.Authorization, "Bearer TOKEN");
  await assert.rejects(() => createTemplate("TOKEN", "waba", { name: "x", language: "ar", category: "UTILITY", components: [] }),
    (e: unknown) => e instanceof GraphError && e.code === 100 && e.userMessage === "Name exists");
  const list = await listTemplates("TOKEN", "waba");
  assert.equal(list.length, 1);
  __setFetch(null);
});

test("webhook signature + status ordering", async () => {
  const { verifySignature, nextStatus } = await import("./webhook");
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const sig = "sha256=" + crypto.createHmac("sha256", "app-secret").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "app-secret"), true);
  assert.equal(verifySignature(body + " ", sig, "app-secret"), false);
  assert.equal(verifySignature(body, sig, ""), false);
  assert.equal(verifySignature(body, null, "app-secret"), false);
  assert.equal(nextStatus("SENT", "delivered"), "DELIVERED");
  assert.equal(nextStatus("READ", "delivered"), "READ");
  assert.equal(nextStatus("DELIVERED", "failed"), "FAILED");
  assert.equal(nextStatus("FAILED", "read"), "FAILED");
});
