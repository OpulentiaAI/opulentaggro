"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StageBadge } from "@/components/StageBadge";
import { StoBackendFallback } from "@/components/sto/StoBackendFallback";
import { normalizeStoDashboardOrders } from "@/lib/sto/stage-inference";
import { STO_STAGES, type StoOrderRow } from "@/lib/types/sto";

type DashboardData = {
  brand?: string;
  total?: number;
  stages?: string[];
  stage_counts?: Record<string, number>;
  orders?: StoOrderRow[];
  error?: string;
};

const DASHBOARD_METHOD_PATH =
  "/api/method/erpnext/intercompany/page/sto_dashboard/sto_dashboard/get_sto_dashboard_data";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(value?: string): string {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export function StoDashboardView() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState("All");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetch("/api/resource/Company?fields=[\"name\"]&limit_page_length=50&order_by=name asc")
      .then((res) => res.json())
      .then((json) => {
        const rows = (json.data ?? []) as { name: string }[];
        setCompanies(rows.map((r) => r.name).filter(Boolean));
      })
      .catch(() => {
        /* optional — free-text company still works */
      });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: "100",
      stage: stageFilter,
    });
    if (company) params.set("company", company);

    try {
      const res = await fetch(`${DASHBOARD_METHOD_PATH}?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setData({ error: json.message || json.error || `HTTP ${res.status}` });
        return;
      }
      const message = json.message as DashboardData;
      const rawOrders = message.orders ?? [];
      const needsStage =
        rawOrders.length > 0 && rawOrders.some((row) => !row.stage);
      if (needsStage) {
        const { orders, stage_counts } = normalizeStoDashboardOrders(rawOrders);
        setData({ ...message, orders, stage_counts });
      } else {
        setData(message);
      }
    } catch (e) {
      setData({ error: e instanceof Error ? e.message : "Failed to load dashboard" });
    } finally {
      setLoading(false);
    }
  }, [company, stageFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function selectStage(stage: string) {
    setStageFilter(stage);
  }

  async function handleCreate(form: FormData) {
    setCreating(true);
    setCreateError(null);
    const items = [
      {
        item_code: form.get("item_code"),
        qty: Number(form.get("qty") || 1),
        rate: form.get("rate") ? Number(form.get("rate")) : undefined,
        warehouse: form.get("warehouse") || undefined,
      },
    ];
    try {
      const res = await fetch("/api/sto/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: form.get("company"),
          supplier: form.get("supplier"),
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || "Create failed");
        return;
      }
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const stageCounts = data?.stage_counts ?? {};
  const stages = data?.stages ?? [...STO_STAGES];
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const apiError = data?.error ?? null;

  return (
    <StoBackendFallback page="sto-dashboard" title="Stock Transfer Orders" error={apiError}>
      <div className="sto-dashboard frappe-page">
        <div className="frappe-page-head">
          <nav className="desk-breadcrumbs" aria-label="Breadcrumb">
            <Link href="/app/intercompany">Intercompany</Link>
            <span aria-hidden>/</span>
            <span>Stock Transfer Orders</span>
          </nav>
          <div className="frappe-page-head-main">
            <h1 className="frappe-page-title">Stock Transfer Orders</h1>
            <div className="frappe-page-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setDialogOpen(true)}
              >
                + New STO
              </button>
            </div>
          </div>
        </div>

        <div className="frappe-page-filters">
          <label className="frappe-filter">
            <span>Company</span>
            {companies.length ? (
              <select
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                }}
              >
                <option value="">All companies</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Company (optional)"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onBlur={() => void refresh()}
              />
            )}
          </label>
          <label className="frappe-filter">
            <span>Stage</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="All">All</option>
              {stages.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && !data?.orders && !apiError ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="sto-layout">
            <div className="sto-summary-grid">
              <div
                role="button"
                tabIndex={0}
                className={`sto-summary-card${stageFilter === "All" ? " active" : ""}`}
                onClick={() => selectStage("All")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") selectStage("All");
                }}
              >
                <div className="count">{total}</div>
                <div className="label">All STOs</div>
              </div>
              {stages.map((stage) => (
                <div
                  key={stage}
                  role="button"
                  tabIndex={0}
                  className={`sto-summary-card${stageFilter === stage ? " active" : ""}`}
                  onClick={() => selectStage(stage)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectStage(stage);
                  }}
                >
                  <div className="count">{stageCounts[stage] ?? 0}</div>
                  <div className="label">
                    <StageBadge stage={stage} compact />
                  </div>
                </div>
              ))}
            </div>

            <div className="sto-toolbar">
              <span>
                Showing <strong>{orders.length}</strong> of <strong>{total}</strong> STOs
              </span>
              <span className="sto-brand">OpulentAggro</span>
            </div>

            <div className="sto-table-wrap">
              {!orders.length ? (
                <div className="sto-empty">No stock transfer orders found.</div>
              ) : (
                <table className="sto-list-table">
                  <thead>
                    <tr>
                      <th>Purchase Order</th>
                      <th>Stage</th>
                      <th>Company</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((row) => (
                      <tr
                        key={row.name}
                        data-po={row.name}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("a")) return;
                          router.push(
                            `/app/sto-trace?purchase_order=${encodeURIComponent(row.name)}`
                          );
                        }}
                      >
                        <td>
                          <Link href={`/app/purchase-order/${encodeURIComponent(row.name)}`}>
                            {row.name}
                          </Link>
                        </td>
                        <td>
                          <StageBadge stage={row.stage} />
                        </td>
                        <td>{row.company ?? ""}</td>
                        <td>{row.supplier ?? ""}</td>
                        <td>{formatDate(row.transaction_date)}</td>
                        <td>{formatCurrency(row.grand_total ?? 0)}</td>
                        <td>{row.status ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        <footer className="sto-desk-footer">
          <span className="sto-desk-footer-brand">OpulentAggro</span>
          <span className="muted">Pierre Light · Intercompany STO</span>
        </footer>

        {dialogOpen ? (
          <div
            className="frappe-dialog-backdrop"
            role="presentation"
            onClick={() => setDialogOpen(false)}
          >
            <div
              className="frappe-dialog"
              role="dialog"
              aria-labelledby="sto-create-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="sto-create-title">Create Stock Transfer Order</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleCreate(new FormData(e.currentTarget));
                }}
              >
                <label>
                  Company *
                  <input name="company" required defaultValue={company} list="sto-companies" />
                </label>
                <datalist id="sto-companies">
                  {companies.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <label>
                  Internal Supplier *
                  <input name="supplier" required placeholder="Internal supplier name" />
                </label>
                <label>
                  Item *
                  <input name="item_code" required placeholder="Item code" />
                </label>
                <label>
                  Qty
                  <input name="qty" type="number" min={1} defaultValue={1} />
                </label>
                <label>
                  Rate
                  <input name="rate" type="number" step="0.01" />
                </label>
                <label>
                  Target Warehouse
                  <input name="warehouse" placeholder="Warehouse" />
                </label>
                {createError ? <p className="error-banner inline">{createError}</p> : null}
                <div className="frappe-dialog-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </StoBackendFallback>
  );
}
