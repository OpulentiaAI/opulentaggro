/**
 * Unit tests for IC extended MCP tool handlers (mock ERPNext client).
 * Run: node tests/ic-extended-tools.test.mjs
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  handleIcExtendedToolCall,
  icExtendedToolDefinitions,
  isIcExtendedToolName,
} from "../build/ic-extended-tools.js";

const TREASURY = "erpnext.intercompany.intercompany_treasury";
const TRIANGULAR = "erpnext.intercompany.intercompany_triangular";
const ACCRUAL = "erpnext.intercompany.intercompany_accrual";

class MockClient {
  constructor() {
    this.calls = [];
  }

  async callMethod(method, args) {
    this.calls.push({ method, args });
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
  await runTest("icExtendedToolDefinitions count", () => {
    assert.equal(icExtendedToolDefinitions.length, 8);
  })
);

results.push(
  await runTest("isIcExtendedToolName", () => {
    assert.ok(isIcExtendedToolName("ic_match_and_clear"));
    assert.ok(!isIcExtendedToolName("ic_list_accounts"));
  })
);

results.push(
  await runTest("ic_match_and_clear maps to treasury", async () => {
    const client = new MockClient();
    await handleIcExtendedToolCall(client, "ic_match_and_clear", {
      sales_invoice: "SI-1",
      purchase_invoice: "PI-1",
    });
    assert.equal(client.calls[0].method, `${TREASURY}.match_and_clear_intercompany_invoice`);
  })
);

results.push(
  await runTest("ic_triangular_sale maps to triangular", async () => {
    const client = new MockClient();
    await handleIcExtendedToolCall(client, "ic_triangular_sale", {
      selling_company: "A",
      billing_company: "B",
      customer: "Cust",
      items: [{ item_code: "X", qty: 1 }],
    });
    assert.equal(client.calls[0].method, `${TRIANGULAR}.create_triangular_sale`);
  })
);

results.push(
  await runTest("ic_create_accrual maps to accrual", async () => {
    const client = new MockClient();
    await handleIcExtendedToolCall(client, "ic_create_accrual", {
      company: "A",
      counterparty_company: "B",
      amount: 100,
      debit_account: "Exp - A",
      credit_account: "Accrual - A",
    });
    assert.equal(client.calls[0].method, `${ACCRUAL}.create_accrual_allocation`);
  })
);

const failed = results.filter((r) => r.status === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
