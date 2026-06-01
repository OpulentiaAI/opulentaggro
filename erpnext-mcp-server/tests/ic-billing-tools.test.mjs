/**
 * Unit tests for intercompany billing MCP tool handlers (mock ERPNext client).
 * Run after build: node tests/ic-billing-tools.test.mjs
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  handleIcBillingToolCall,
  icBillingToolDefinitions,
  isIcBillingToolName,
} from "../build/ic-billing-tools.js";

const METHOD_PREFIX = "erpnext.intercompany.intercompany_billing";

class MockClient {
  constructor(responses = {}) {
    this.responses = responses;
    this.calls = [];
  }

  async callMethod(method, args) {
    this.calls.push({ method, args });
    if (this.responses[method]) {
      return this.responses[method](args);
    }
    return { ok: true, method, args };
  }
}

async function runTest(name, fn) {
  const start = performance.now();
  try {
    await fn();
    const ms = (performance.now() - start).toFixed(1);
    console.log(`PASS ${name} (${ms}ms)`);
    return { name, status: "PASS", ms: parseFloat(ms) };
  } catch (err) {
    const ms = (performance.now() - start).toFixed(1);
    console.error(`FAIL ${name} (${ms}ms):`, err.message);
    return { name, status: "FAIL", ms: parseFloat(ms), detail: err.message };
  }
}

const results = [];

results.push(
  await runTest("icBillingToolDefinitions count", () => {
    assert.equal(icBillingToolDefinitions.length, 6);
  })
);

results.push(
  await runTest("isIcBillingToolName", () => {
    assert.ok(isIcBillingToolName("ic_list_accounts"));
    assert.ok(!isIcBillingToolName("sto_create"));
  })
);

results.push(
  await runTest("ic_list_accounts maps to API", async () => {
    const client = new MockClient({
      [`${METHOD_PREFIX}.list_intercompany_accounts`]: () => [
        { from_company: "Co A", to_company: "Co B", configured: true },
      ],
    });
    const res = await handleIcBillingToolCall(client, "ic_list_accounts", { company: "Co A" });
    assert.equal(client.calls[0].method, `${METHOD_PREFIX}.list_intercompany_accounts`);
    assert.equal(client.calls[0].args.company, "Co A");
    assert.equal(res.isError, undefined);
  })
);

results.push(
  await runTest("ic_create_sales_invoice validates params", async () => {
    const client = new MockClient();
    const res = await handleIcBillingToolCall(client, "ic_create_sales_invoice", {
      from_company: "A",
    });
    assert.equal(res.isError, true);
  })
);

results.push(
  await runTest("ic_create_sales_invoice maps items JSON", async () => {
    const client = new MockClient();
    const items = [{ item_code: "ITEM-1", qty: 5, rate: 100 }];
    await handleIcBillingToolCall(client, "ic_create_sales_invoice", {
      from_company: "Opulent Fresh EU",
      to_company: "Opulent Fresh NA",
      items,
      submit: true,
    });
    assert.equal(client.calls[0].method, `${METHOD_PREFIX}.create_intercompany_sales_invoice`);
    assert.equal(JSON.parse(client.calls[0].args.items)[0].item_code, "ITEM-1");
    assert.equal(client.calls[0].args.submit, 1);
  })
);

results.push(
  await runTest("IC billing workflow mock chain", async () => {
    const client = new MockClient({
      [`${METHOD_PREFIX}.list_intercompany_accounts`]: () => [
        {
          from_company: "Opulent Fresh EU",
          to_company: "Opulent Fresh NA",
          configured: true,
        },
        {
          from_company: "Opulent Fresh EU",
          to_company: "Opulent Fresh APAC",
          configured: true,
        },
      ],
      [`${METHOD_PREFIX}.create_intercompany_invoice_pair`]: () => ({
        sales_invoice: "SI-001",
        purchase_invoice: "PI-001",
        sales_invoice_docstatus: 1,
        purchase_invoice_docstatus: 1,
      }),
      [`${METHOD_PREFIX}.get_intercompany_invoice_status`]: () => ({
        ar_posted: true,
        ap_posted: true,
        fully_posted: true,
      }),
      [`${METHOD_PREFIX}.submit_intercompany_invoice`]: () => ({
        sales_invoice: { name: "SI-001", docstatus: 1 },
      }),
    });

    const tools = [
      ["ic_list_accounts", {}],
      [
        "ic_create_invoice_pair",
        {
          from_company: "Opulent Fresh EU",
          to_company: "Opulent Fresh NA",
          items: [{ item_code: "STO-TEST-ITEM-001", qty: 10, rate: 50 }],
        },
      ],
      ["ic_get_invoice_status", { sales_invoice: "SI-001" }],
      ["ic_submit_invoice", { sales_invoice: "SI-001" }],
    ];

    for (const [tool, args] of tools) {
      const res = await handleIcBillingToolCall(client, tool, args);
      assert.notEqual(res.isError, true, `${tool} should not error`);
    }
    assert.equal(client.calls.length, 4);
  })
);

console.log("\n| Test | Status | ms |");
console.log("|------|--------|-----|");
for (const r of results) {
  console.log(`| ${r.name} | ${r.status} | ${r.ms} |`);
}

const failed = results.filter((r) => r.status === "FAIL");
process.exit(failed.length ? 1 : 0);
