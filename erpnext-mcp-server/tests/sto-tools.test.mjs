/**
 * Unit tests for STO MCP tool handlers (mock ERPNext client).
 * Run: node --experimental-strip-types tests/sto-tools.test.mjs
 * Or after build: node tests/sto-tools.test.mjs
 */

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { handleStoToolCall, stoToolDefinitions, isStoToolName } from "../build/sto-tools.js";

const METHOD_PREFIX = "erpnext.intercompany.stock_transfer_order";

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

// Tool registry
results.push(
	await runTest("stoToolDefinitions count", () => {
		assert.equal(stoToolDefinitions.length, 16);
	})
);

results.push(
	await runTest("isStoToolName", () => {
		assert.ok(isStoToolName("sto_create"));
		assert.ok(!isStoToolName("get_documents"));
	})
);

// sto_create
results.push(
	await runTest("sto_create maps to API method", async () => {
		const client = new MockClient();
		const items = [{ item_code: "ITEM-1", qty: 2, rate: 50 }];
		const res = await handleStoToolCall(client, "sto_create", {
			company: "Co A",
			supplier: "Internal Supplier Co B",
			items,
		});
		assert.equal(client.calls.length, 1);
		assert.equal(client.calls[0].method, `${METHOD_PREFIX}.create_stock_transfer_order`);
		assert.equal(client.calls[0].args.company, "Co A");
		assert.equal(JSON.parse(client.calls[0].args.items)[0].item_code, "ITEM-1");
		assert.equal(res.isError, undefined);
	})
);

results.push(
	await runTest("sto_create validates params", async () => {
		const client = new MockClient();
		const res = await handleStoToolCall(client, "sto_create", { company: "X" });
		assert.equal(res.isError, true);
	})
);

results.push(
	await runTest("sto_create accepts pre-serialized items JSON string", async () => {
		const client = new MockClient();
		const items = [{ item_code: "ITEM-1", qty: 2, rate: 50 }];
		const res = await handleStoToolCall(client, "sto_create", {
			company: "Co A",
			supplier: "Internal Supplier Co B",
			items: JSON.stringify(items),
		});
		assert.equal(res.isError, undefined);
		assert.equal(client.calls[0].args.items, JSON.stringify(items));
	})
);

// sto_submit
results.push(
	await runTest("sto_submit", async () => {
		const client = new MockClient({
			[`${METHOD_PREFIX}.submit_stock_transfer_order`]: () => ({
				purchase_order: "PO-001",
				stage: "Pending Approval",
			}),
		});
		const res = await handleStoToolCall(client, "sto_submit", { purchase_order: "PO-001" });
		assert.equal(client.calls[0].method, `${METHOD_PREFIX}.submit_stock_transfer_order`);
		assert.match(res.content[0].text, /PO-001/);
	})
);

// sto_list passes include_stage default via limit only
results.push(
	await runTest("sto_list", async () => {
		const client = new MockClient({
			[`${METHOD_PREFIX}.list_stock_transfer_orders`]: () => [],
		});
		await handleStoToolCall(client, "sto_list", { limit: 10 });
		assert.equal(client.calls[0].args.limit, 10);
	})
);

// Full workflow mock chain
results.push(
	await runTest("STO workflow mock chain", async () => {
		const po = "PO-STO-TEST";
		let stage = "Draft";
		const client = new MockClient({
			[`${METHOD_PREFIX}.create_stock_transfer_order`]: () => ({
				purchase_order: po,
				stage: "Draft",
			}),
			[`${METHOD_PREFIX}.submit_stock_transfer_order`]: () => {
				stage = "Pending Approval";
				return { purchase_order: po, stage };
			},
			[`${METHOD_PREFIX}.approve_and_route_stock_transfer`]: () => {
				stage = "Approved";
				return { purchase_order: po, sales_order: "SO-001", stage };
			},
			[`${METHOD_PREFIX}.post_goods_in_transit`]: () => {
				stage = "Goods In Transit";
				return { purchase_order: po, delivery_note: "DN-001", stage };
			},
			[`${METHOD_PREFIX}.create_intercompany_invoice`]: () => {
				stage = "IC Invoiced";
				return { purchase_order: po, sales_invoice: "SI-001", purchase_invoice: "PI-001", stage };
			},
			[`${METHOD_PREFIX}.post_stock_transfer_receipt`]: () => {
				stage = "Received";
				return { purchase_order: po, purchase_receipt: "PR-001", stage };
			},
			[`${METHOD_PREFIX}.get_stock_transfer_trace`]: () => ({
				purchase_order: po,
				stage: "Reconciliation Pending",
			}),
			[`${METHOD_PREFIX}.run_stock_transfer_three_way_match`]: () => ({
				purchase_order: po,
				matched: true,
			}),
			[`${METHOD_PREFIX}.list_stock_transfer_orders`]: () => [{ name: po, stage: "Three Way Matched" }],
		});

		const tools = [
			["sto_create", { company: "A", supplier: "S", items: [{ item_code: "I", qty: 1 }] }],
			["sto_submit", { purchase_order: po }],
			["sto_approve_and_route", { purchase_order: po }],
			["sto_post_goods_in_transit", { purchase_order: po }],
			["sto_create_ic_invoice", { purchase_order: po }],
			["sto_post_goods_receipt", { purchase_order: po }],
			["sto_get_trace", { purchase_order: po }],
			["sto_three_way_match", { purchase_order: po }],
			["sto_list", { limit: 5 }],
		];

		for (const [tool, args] of tools) {
			const res = await handleStoToolCall(client, tool, args);
			assert.notEqual(res.isError, true, `${tool} should not error`);
		}
		assert.equal(client.calls.length, 9);
	})
);

console.log("\n| Test | Status | ms |");
console.log("|------|--------|-----|");
for (const r of results) {
	console.log(`| ${r.name} | ${r.status} | ${r.ms} |`);
}

const failed = results.filter((r) => r.status === "FAIL");
process.exit(failed.length ? 1 : 0);
