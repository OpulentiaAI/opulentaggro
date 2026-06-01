// Copyright (c) 2026, Opulent AI and contributors
// License: GNU General Public License v3. See license.txt

frappe.pages["sto-trace"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("STO Trace"),
		single_column: true,
	});

	page.main.addClass("sto-trace");
	wrapper.sto_trace = new erpnext.intercompany.STOTrace(page);

	frappe.breadcrumbs.add("Intercompany", "sto-dashboard");
};

erpnext.intercompany = erpnext.intercompany || {};

erpnext.intercompany.STOTrace = class STOTrace {
	constructor(page) {
		this.page = page;
		this.purchase_order =
			(frappe.route_options && frappe.route_options.purchase_order) ||
			frappe.utils.get_query_params().purchase_order ||
			null;
		this.setup();
		if (this.purchase_order) {
			this.load(this.purchase_order);
		} else {
			this.render_empty();
		}
	}

	setup() {
		this.page.po_field = this.page.add_field({
			fieldtype: "Link",
			fieldname: "purchase_order",
			options: "Purchase Order",
			label: __("Stock Transfer Order (PO)"),
			default: this.purchase_order,
			get_query: () => ({ filters: { is_internal_supplier: 1 } }),
			change: () => {
				const po = this.page.po_field.get_value();
				if (po) {
					frappe.set_route("sto-trace", { purchase_order: po });
				}
			},
		});

		this.page.add_menu_item(__("Back to Dashboard"), () => frappe.set_route("sto-dashboard"));
		this.page.add_menu_item(__("Open Purchase Order"), () => {
			if (this.purchase_order) {
				frappe.set_route("Form", "Purchase Order", this.purchase_order);
			}
		});

		this.$layout = $('<div class="sto-trace-layout"></div>').appendTo(this.page.main);
	}

	render_empty() {
		this.$layout.html(
			`<div class="sto-empty-select">${__(
				"Select an internal Purchase Order to view the STO document chain."
			)}</div>`
		);
	}

	load(purchase_order) {
		this.purchase_order = purchase_order;
		this.page.po_field.set_value(purchase_order);

		frappe.call({
			method: "erpnext.intercompany.page.sto_trace.sto_trace.get_sto_trace_page_data",
			args: { purchase_order },
			freeze: true,
			callback: (r) => {
				if (!r.message) return;
				this.render(r.message);
				this.setup_actions(r.message);
			},
		});
	}

	render(data) {
		this.$layout.empty();

		const header = $(`
			<div class="sto-header">
				<div class="po-title">${frappe.utils.escape_html(data.purchase_order)}</div>
				${erpnext.intercompany.render_stage_badge(data.stage)}
				<span class="text-muted">OpulentAggro</span>
			</div>
		`);
		this.$layout.append(header);
		this.$layout.append(this.render_pipeline(data));
		this.$layout.append(this.render_documents(data));
		if (data.three_way_match) {
			this.$layout.append(this.render_match(data.three_way_match));
		}
		this.$actions = $('<div class="sto-actions"></div>').appendTo(this.$layout);
	}

	render_pipeline(data) {
		const current = data.stage;
		const stage_index = data.stage_index ?? -1;
		const $pipeline = $('<div class="sto-pipeline"></div>');

		(data.stages || []).forEach((stage, idx) => {
			let cls = "sto-pipeline-step";
			if (stage === "Dispute" && current === "Dispute") cls += " dispute current";
			else if (stage === current) cls += " current";
			else if (idx < stage_index && current !== "Dispute") cls += " done";
			else if (current === "Completed" || current === "Three Way Matched") cls += " done";

			$pipeline.append(`<div class="${cls}">${frappe.utils.escape_html(stage)}</div>`);
		});

		return $pipeline;
	}

	render_doc_card(doctype, doc) {
		if (!doc) {
			return `<div class="sto-doc-card"><div class="doctype">${frappe.utils.escape_html(
				doctype
			)}</div><div class="meta">${__("Not created")}</div></div>`;
		}
		const route = frappe.router.slug(doctype);
		return `
			<div class="sto-doc-card">
				<div class="doctype">${frappe.utils.escape_html(doctype)}</div>
				<div class="name"><a href="/app/${route}/${encodeURIComponent(doc.name)}">${frappe.utils.escape_html(
					doc.name
				)}</a></div>
				<div class="meta">${__("Status")}: ${frappe.utils.escape_html(doc.status || doc.docstatus)}</div>
			</div>`;
	}

	render_documents(data) {
		const docs = data.documents || {};
		const $section = $(`
			<div class="sto-section">
				<h4>${__("Document Chain")}</h4>
				<div class="sto-doc-grid"></div>
			</div>
		`);
		const $grid = $section.find(".sto-doc-grid");

		$grid.append(this.render_doc_card(__("Purchase Order"), docs.purchase_order));
		$grid.append(this.render_doc_card(__("Sales Order"), docs.sales_order));

		(docs.delivery_notes || []).forEach((dn) => {
			$grid.append(this.render_doc_card(__("Delivery Note"), dn));
		});
		if (!(docs.delivery_notes || []).length) {
			$grid.append(this.render_doc_card(__("Delivery Note"), null));
		}

		(docs.sales_invoices || []).forEach((si) => {
			$grid.append(this.render_doc_card(__("Sales Invoice"), si));
		});
		if (!(docs.sales_invoices || []).length) {
			$grid.append(this.render_doc_card(__("Sales Invoice"), null));
		}

		(docs.purchase_invoices || []).forEach((pi) => {
			$grid.append(this.render_doc_card(__("Purchase Invoice"), pi));
		});
		if (!(docs.purchase_invoices || []).length) {
			$grid.append(this.render_doc_card(__("Purchase Invoice"), null));
		}

		(docs.purchase_receipts || []).forEach((pr) => {
			$grid.append(this.render_doc_card(__("Purchase Receipt"), pr));
		});
		if (!(docs.purchase_receipts || []).length) {
			$grid.append(this.render_doc_card(__("Purchase Receipt"), null));
		}

		return $section;
	}

	render_match(match) {
		const matched = match.matched;
		const comparison = match.comparison || {};
		return $(`
			<div class="sto-section">
				<h4>${__("Three-Way Match")}</h4>
				<div class="sto-match-panel ${matched ? "matched" : "dispute"}">
					<div><strong>${matched ? __("Matched") : __("Dispute")}</strong></div>
					<div class="text-muted">${frappe.utils.escape_html(match.message || match.reason || "")}</div>
					<div style="margin-top:8px">
						${__("PO Qty")}: ${comparison.po_qty ?? "-"} |
						${__("PR Qty")}: ${comparison.pr_qty ?? "-"} |
						${__("Qty Var")}: ${comparison.qty_variance_percent != null ? comparison.qty_variance_percent.toFixed(2) + "%" : "-"}
					</div>
					<div>
						${__("PO Amount")}: ${format_currency(comparison.po_amount || 0)} |
						${__("PI Amount")}: ${format_currency(comparison.pi_amount || 0)} |
						${__("Price Var")}: ${comparison.price_variance_percent != null ? comparison.price_variance_percent.toFixed(2) + "%" : "-"}
					</div>
				</div>
			</div>
		`);
	}

	setup_actions(data) {
		this.$actions.empty();
		const po = data.purchase_order;
		const stage = data.stage;

		const actions = {
			Draft: {
				label: __("Submit (DoA Approval)"),
				method: "erpnext.intercompany.stock_transfer_order.submit_stock_transfer_order",
				args: { purchase_order: po },
			},
			"Pending Approval": {
				label: __("Approve & Route to Sender"),
				method: "erpnext.intercompany.stock_transfer_order.approve_and_route_stock_transfer",
				args: { purchase_order: po },
			},
			Approved: {
				label: __("Post Goods In Transit"),
				method: "erpnext.intercompany.stock_transfer_order.post_goods_in_transit",
				args: { purchase_order: po },
			},
			"Goods In Transit": {
				label: __("Create IC Invoice"),
				method: "erpnext.intercompany.stock_transfer_order.create_intercompany_invoice",
				args: { purchase_order: po },
			},
			"IC Invoiced": {
				label: __("Post Goods Receipt"),
				method: "erpnext.intercompany.stock_transfer_order.post_stock_transfer_receipt",
				args: { purchase_order: po },
			},
			Received: {
				label: __("Run Three-Way Match"),
				method: "erpnext.intercompany.stock_transfer_order.run_stock_transfer_three_way_match",
				args: { purchase_order: po, qty_tolerance_percent: 0, price_tolerance_percent: 0 },
			},
		};

		const action = actions[stage];
		if (action) {
			this.$actions.append(
				`<button class="btn btn-primary btn-sm">${frappe.utils.escape_html(action.label)}</button>`
			);
			this.$actions.find("button").on("click", () => {
				frappe.call({
					method: action.method,
					args: action.args,
					freeze: true,
					callback: () => {
						frappe.show_alert({ message: __("STO updated"), indicator: "green" });
						this.load(po);
					},
				});
			});
		}

		if (["Received", "Dispute", "Three Way Matched"].includes(stage)) {
			this.$actions.append(
				`<button class="btn btn-default btn-sm btn-rerun-match">${__("Re-run Three-Way Match")}</button>`
			);
			this.$actions.find(".btn-rerun-match").on("click", () => {
				frappe.call({
					method: "erpnext.intercompany.stock_transfer_order.run_stock_transfer_three_way_match",
					args: { purchase_order: po, qty_tolerance_percent: 0, price_tolerance_percent: 0 },
					freeze: true,
					callback: () => this.load(po),
				});
			});
		}
	}
};

frappe.pages["sto-trace"].on_page_show = function (wrapper) {
	const po =
		(frappe.route_options && frappe.route_options.purchase_order) ||
		frappe.utils.get_query_params().purchase_order;
	if (po && wrapper.sto_trace && wrapper.sto_trace.purchase_order !== po) {
		wrapper.sto_trace.load(po);
	}
};
