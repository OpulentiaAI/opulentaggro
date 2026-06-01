// Copyright (c) 2026, Opulent AI and contributors
// Extends Purchase Order list with STO trace shortcut for internal suppliers.

frappe.listview_settings["Purchase Order"] = frappe.listview_settings["Purchase Order"] || {};
const po_onload = frappe.listview_settings["Purchase Order"].onload;

frappe.listview_settings["Purchase Order"].onload = function (listview) {
	if (po_onload) {
		po_onload(listview);
	}

	listview.page.add_menu_item(__("STO Dashboard"), () => frappe.set_route("sto-dashboard"));

	listview.page.add_action_item(__("View STO Trace"), () => {
		const selected = listview.get_checked_items();
		if (selected.length !== 1) {
			frappe.msgprint(__("Select exactly one Purchase Order."));
			return;
		}
		frappe.set_route("sto-trace", { purchase_order: selected[0].name });
	});
};
