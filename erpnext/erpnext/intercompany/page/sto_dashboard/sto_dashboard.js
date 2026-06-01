// Copyright (c) 2026, Opulent AI and contributors
// License: GNU General Public License v3. See license.txt

frappe.pages["sto-dashboard"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Stock Transfer Orders"),
		single_column: true,
	});

	page.main.addClass("sto-dashboard");
	wrapper.sto_dashboard = new erpnext.intercompany.STODashboard(page);

	frappe.breadcrumbs.add("Intercompany");
};

erpnext.intercompany = erpnext.intercompany || {};

erpnext.intercompany.STO_STAGE_COLORS = {
	Draft: { bg: "#73737333", fg: "#737373" },
	"Pending Approval": { bg: "#ffca0033", fg: "#d5a910" },
	Approved: { bg: "#009fff33", fg: "#009fff" },
	"Goods In Transit": { bg: "#08c0ef33", fg: "#08c0ef" },
	"IC Invoiced": { bg: "#c635e433", fg: "#c635e4" },
	Received: { bg: "#0dbe4e33", fg: "#0dbe4e" },
	"Three Way Matched": { bg: "#07c48033", fg: "#07c480" },
	Dispute: { bg: "#ff2e3f33", fg: "#ff2e3f" },
	Completed: { bg: "#0dbe4e33", fg: "#0a0a0a" },
	Cancelled: { bg: "#73737333", fg: "#737373" },
};

erpnext.intercompany.render_stage_badge = function (stage) {
	const colors = erpnext.intercompany.STO_STAGE_COLORS[stage] || {
		bg: "#73737333",
		fg: "#737373",
	};
	return `<span class="sto-stage-badge" style="background:${colors.bg};color:${colors.fg}">${frappe.utils.escape_html(
		stage || __("Unknown")
	)}</span>`;
};

erpnext.intercompany.STODashboard = class STODashboard {
	constructor(page) {
		this.page = page;
		this.stage_filter = "All";
		this.setup();
		this.refresh();
	}

	setup() {
		this.page.company_field = this.page.add_field({
			fieldtype: "Link",
			fieldname: "company",
			options: "Company",
			label: __("Company"),
			default: frappe.defaults.get_user_default("company"),
			change: () => this.refresh(),
		});

		this.page.stage_field = this.page.add_field({
			fieldtype: "Select",
			fieldname: "stage",
			label: __("Stage"),
			options: ["All"].concat(Object.keys(erpnext.intercompany.STO_STAGE_COLORS)),
			default: "All",
			change: () => {
				this.stage_filter = this.page.stage_field.get_value() || "All";
				this.refresh();
			},
		});

		this.page.set_primary_action(__("New STO"), () => this.open_create_dialog(), "add");

		this.page.add_menu_item(__("Refresh"), () => this.refresh());

		this.$layout = $('<div class="sto-layout"></div>').appendTo(this.page.main);
		this.$summary = $('<div class="sto-summary-grid"></div>').appendTo(this.$layout);
		this.$toolbar = $('<div class="sto-toolbar"></div>').appendTo(this.$layout);
		this.$table_wrap = $('<div class="sto-table-wrap"></div>').appendTo(this.$layout);
	}

	open_create_dialog() {
		const dialog = new frappe.ui.Dialog({
			title: __("Create Stock Transfer Order"),
			fields: [
				{
					fieldtype: "Link",
					fieldname: "company",
					options: "Company",
					label: __("Company"),
					reqd: 1,
					default: this.page.company_field.get_value(),
				},
				{
					fieldtype: "Link",
					fieldname: "supplier",
					options: "Supplier",
					label: __("Internal Supplier"),
					reqd: 1,
					get_query: () => ({ filters: { is_internal_supplier: 1 } }),
				},
				{
					fieldtype: "Table",
					fieldname: "items",
					label: __("Items"),
					reqd: 1,
					fields: [
						{
							fieldtype: "Link",
							fieldname: "item_code",
							options: "Item",
							label: __("Item"),
							in_list_view: 1,
							reqd: 1,
						},
						{
							fieldtype: "Float",
							fieldname: "qty",
							label: __("Qty"),
							in_list_view: 1,
							default: 1,
							reqd: 1,
						},
						{
							fieldtype: "Currency",
							fieldname: "rate",
							label: __("Rate"),
							in_list_view: 1,
						},
						{
							fieldtype: "Link",
							fieldname: "warehouse",
							options: "Warehouse",
							label: __("Target Warehouse"),
							in_list_view: 1,
						},
					],
				},
			],
			primary_action_label: __("Create"),
			primary_action: (values) => {
				if (!values.items || !values.items.length) {
					frappe.msgprint(__("Add at least one item."));
					return;
				}
				frappe.call({
					method: "erpnext.intercompany.stock_transfer_order.create_stock_transfer_order",
					args: {
						company: values.company,
						supplier: values.supplier,
						items: values.items,
					},
					freeze: true,
					callback: (r) => {
						dialog.hide();
						if (r.message && r.message.purchase_order) {
							frappe.show_alert({
								message: __("STO {0} created", [r.message.purchase_order]),
								indicator: "green",
							});
							this.refresh();
						}
					},
				});
			},
		});
		dialog.show();
	}

	refresh() {
		const company = this.page.company_field.get_value();
		this.stage_filter = this.page.stage_field.get_value() || "All";

		frappe.call({
			method: "erpnext.intercompany.page.sto_dashboard.sto_dashboard.get_sto_dashboard_data",
			args: {
				company,
				stage: this.stage_filter,
				limit: 100,
			},
			freeze: true,
			callback: (r) => {
				if (!r.message) return;
				this.render_summary(r.message);
				this.render_table(r.message.orders || []);
				this.$toolbar.html(
					`<span>${__("Showing")} <strong>${(r.message.orders || []).length}</strong> ${__(
						"of"
					)} <strong>${r.message.total || 0}</strong> STOs</span><span class="sto-brand">OpulentAggro</span>`
				);
			},
		});
	}

	render_summary(data) {
		this.$summary.empty();
		const counts = data.stage_counts || {};

		const all_card = $(`
			<div class="sto-summary-card ${this.stage_filter === "All" ? "active" : ""}">
				<div class="count">${data.total || 0}</div>
				<div class="label">${__("All STOs")}</div>
			</div>
		`);
		all_card.on("click", () => {
			this.page.stage_field.set_value("All");
			this.stage_filter = "All";
			this.refresh();
		});
		all_card.appendTo(this.$summary);

		(data.stages || []).forEach((stage) => {
			const card = $(`
				<div class="sto-summary-card ${this.stage_filter === stage ? "active" : ""}">
					<div class="count">${counts[stage] || 0}</div>
					<div class="label">${frappe.utils.escape_html(stage)}</div>
				</div>
			`);
			card.on("click", () => {
				this.page.stage_field.set_value(stage);
				this.stage_filter = stage;
				this.refresh();
			});
			card.appendTo(this.$summary);
		});
	}

	render_table(orders) {
		this.$table_wrap.empty();

		if (!orders.length) {
			this.$table_wrap.html(`<div class="sto-empty">${__("No stock transfer orders found.")}</div>`);
			return;
		}

		const $table = $(`
			<table class="sto-list-table">
				<thead>
					<tr>
						<th>${__("Purchase Order")}</th>
						<th>${__("Stage")}</th>
						<th>${__("Company")}</th>
						<th>${__("Supplier")}</th>
						<th>${__("Date")}</th>
						<th>${__("Amount")}</th>
						<th>${__("Status")}</th>
					</tr>
				</thead>
				<tbody></tbody>
			</table>
		`);

		const $tbody = $table.find("tbody");
		orders.forEach((row) => {
			const $tr = $(`
				<tr data-po="${frappe.utils.escape_html(row.name)}">
					<td><a href="/app/purchase-order/${encodeURIComponent(row.name)}">${frappe.utils.escape_html(
						row.name
					)}</a></td>
					<td>${erpnext.intercompany.render_stage_badge(row.stage)}</td>
					<td>${frappe.utils.escape_html(row.company || "")}</td>
					<td>${frappe.utils.escape_html(row.supplier || "")}</td>
					<td>${frappe.datetime.str_to_user(row.transaction_date)}</td>
					<td>${format_currency(row.grand_total || 0)}</td>
					<td>${frappe.utils.escape_html(row.status || "")}</td>
				</tr>
			`);
			$tr.on("click", (e) => {
				if ($(e.target).closest("a").length) return;
				frappe.set_route("sto-trace", { purchase_order: row.name });
			});
			$tbody.append($tr);
		});

		this.$table_wrap.append($table);
	}
};
