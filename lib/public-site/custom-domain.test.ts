import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDomain, isApexDomain, dnsRecordsFor, VERCEL_A_RECORD, VERCEL_CNAME } from "./custom-domain-shared";

test("normalizeDomain cleans what customers paste", () => {
  assert.deepEqual(normalizeDomain("https://WWW.Noory.com/stay?x=1"), { ok: true, host: "www.noory.com" });
  assert.deepEqual(normalizeDomain("  noory.com. "), { ok: true, host: "noory.com" });
  assert.deepEqual(normalizeDomain("book.noory.co.om:443"), { ok: true, host: "book.noory.co.om" });
});

test("normalizeDomain rejects bad and reserved input", () => {
  assert.equal((normalizeDomain("") as { error: string }).error, "empty");
  for (const bad of ["noory", "-a.com", "a..com", "noory.c", "192.168.1.1", "exa mple.com", "a.b.123"]) {
    assert.equal(normalizeDomain(bad).ok, false, bad);
  }
  for (const blocked of ["binaya.app", "www.binaya.app", "demo.binaya.app", "omrent.net", "x.vercel.app", "foo.localhost", "site.test"]) {
    assert.deepEqual(normalizeDomain(blocked), { ok: false, error: "blocked" }, blocked);
  }
});

test("apex vs subdomain and the DNS records to create", () => {
  assert.equal(isApexDomain("noory.com"), true);
  assert.equal(isApexDomain("www.noory.com"), false);
  assert.equal(isApexDomain("noory.co.om"), true); // two-level public suffix
  assert.equal(isApexDomain("www.noory.co.om"), false);
  assert.deepEqual(dnsRecordsFor("noory.com"), [{ type: "A", name: "@", value: VERCEL_A_RECORD }]);
  assert.deepEqual(dnsRecordsFor("www.noory.com"), [{ type: "CNAME", name: "www", value: VERCEL_CNAME }]);
  assert.deepEqual(dnsRecordsFor("book.noory.co.om"), [{ type: "CNAME", name: "book", value: VERCEL_CNAME }]);
});
