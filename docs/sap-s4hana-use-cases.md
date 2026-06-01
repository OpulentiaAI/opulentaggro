# SAP S/4HANA agent CLI use cases (intercompany & finance)

Concrete scenarios for AI agent CLIs built with [cli-printing-press](https://github.com/mvanhorn/cli-printing-press), prioritized for **intercompany** and **P2P/finance** work (see workspace AgroFresh intercompany requirements).

**Legend:** R = read (GET), W = write (POST/PATCH/DELETE). Sandbox = hub `sandbox.api.sap.com` (**GET only**).

---

## Priority matrix

| Priority | Use case | Primary service | IC / P2P relevance |
|----------|----------|-----------------|-------------------|
| P0 | Business partner lookup | `API_BUSINESS_PARTNER` | Vendor/customer resolution across company codes |
| P0 | Purchase order inquiry | `API_PURCHASEORDER_PROCESS_SRV` / `API_PURCHASEORDER_2` | Triangular / IC PO tracking |
| P0 | Journal entry / GL lines | `API_JOURNALENTRYITEMBASIC_SRV`, `API_OPLACCTGDOCITEMCUBE_SRV` | IC reconciliation, partner company |
| P1 | Supplier invoice | `API_SUPPLIERINVOICE_PROCESS_SRV` | P2P accrual & three-way match |
| P1 | Billing document | `API_BILLING_DOCUMENT_SRV` | IC billing / revenue recognition |
| P1 | Sales order | `API_SALES_ORDER_SRV` | IC sales order (SO03) inquiry |
| P2 | Material master | `API_PRODUCT_SRV` / `API_MATERIAL_STOCK_SRV` | Stock transfer IC |
| P2 | Cost / profit center | `API_COSTCENTER_SRV`, `API_PROFITCENTER_SRV` | Allocation validation |
| P2 | Customer invoice | Customer invoice OData (hub search) | AR side of IC |
| P3 | Bank / payment | Payment-related APIs (region-specific) | Cash application |

---

## P0 — Business partner lookup and maintenance

| Field | Value |
|-------|-------|
| **API name** | Business Partner (A2X) |
| **Service** | `API_BUSINESS_PARTNER` |
| **Hub** | https://api.sap.com/api/API_BUSINESS_PARTNER/overview |
| **Path** | `/sap/opu/odata/sap/API_BUSINESS_PARTNER/` |
| **Key entities** | `A_BusinessPartner`, `A_BusinessPartnerAddress`, `A_Customer`, `A_Supplier` |
| **R/W** | R common; W needs CSRF + roles |
| **Auth** | OAuth 2.0 (Cloud) or Basic (comm. user); scenario often `SAP_COM_0008` |
| **Example read** | `GET .../A_BusinessPartner?$filter=BusinessPartnerCategory eq '2'&$top=50&$format=json` |
| **Agent commands** | `bp list`, `bp get --id`, `bp search --name` |

**Notes:** Expand addresses with `$expand=to_BusinessPartnerAddress`. For IC, correlate `BusinessPartner` with company-code-specific customer/supplier roles.

---

## P0 — Purchase order queries

### OData V2 (broadly deployed)

| Field | Value |
|-------|-------|
| **Service** | `API_PURCHASEORDER_PROCESS_SRV` |
| **Hub** | https://api.sap.com/api/API_PURCHASEORDER_PROCESS_SRV/overview |
| **Path** | `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/` |
| **Key entities** | `A_PurchaseOrder`, `A_PurchaseOrderItem`, `A_PurchaseOrderItemConfirmation` |
| **R/W** | R; W (release/status) via PATCH with CSRF—workflow may block |
| **Auth** | `SAP_COM_0053` (typical PO integration scenario) |
| **Example** | `GET .../A_PurchaseOrder('4500000461')?$expand=to_Item/to_Confirmation&$format=json` |

### OData V4 (strategic)

| Field | Value |
|-------|-------|
| **Service** | `API_PURCHASEORDER_2` |
| **Hub** | https://api.sap.com/api/API_PURCHASEORDER_2/overview |
| **Path** | `/sap/opu/odata4/sap/api_purchaseorder_2/srvd_a2x/sap/purchaseorder/0001/` |
| **Key entities** | `PurchaseOrder`, `PurchaseOrderItem` |
| **R/W** | R; W with limits (e.g. partner functions may 405 on POST—check release) |
| **Example** | `GET .../PurchaseOrder('4500000000')` |

**Agent commands:** `po get`, `po list --supplier`, `po confirmations --number`.

---

## P0 — Journal entry / GL account queries (intercompany)

### Journal entry item (analytical)

| Field | Value |
|-------|-------|
| **Service** | `API_JOURNALENTRYITEMBASIC_SRV` |
| **Hub** | https://api.sap.com/api/API_JOURNALENTRYITEMBASIC_SRV/overview |
| **Path** | `/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV/` |
| **Entity** | `A_JournalEntryItemBasic` |
| **R/W** | R (analytical read); keys use generated `ID` |
| **IC fields** | `PartnerCompanyCode`, `CompanyCode`, `GLAccount`, `Ledger` |
| **Example** | `GET .../A_JournalEntryItemBasic?$filter=CompanyCode eq '1010' and PartnerCompanyCode ne ''&$top=100&$select=CompanyCode,PartnerCompanyCode,GLAccount,AmountInCompanyCodeCurrency` |

**Gotcha:** Do not address by `JournalEntry` alone—use filters or fetch `ID` from query results ([SAP Community 12540672](https://community.sap.com/t5/technology-q-a/invalid-analytical-id-could-not-be-processed-gt-api-journalentryitembasic/qaq-p/12540672)).

### Operational accounting document cube

| Field | Value |
|-------|-------|
| **Service** | `API_OPLACCTGDOCITEMCUBE_SRV` |
| **Hub** | https://api.sap.com/api/API_OPLACCTGDOCITEMCUBE_SRV/overview |
| **Path** | `/sap/opu/odata/sap/API_OPLACCTGDOCITEMCUBE_SRV/` |
| **Entity** | `A_OperationalAcctgDocItemCube` |
| **R/W** | R |
| **IC use** | Document/item-level GL with company code + fiscal year keys |
| **Example** | `GET .../A_OperationalAcctgDocItemCube(CompanyCode='4711',FiscalYear='2022',AccountingDocument='500000013',AccountingDocumentItem='1')` |

**Agent commands:** `je lines --company`, `je ic-partners --period`, `gl doc --id`.

---

## P1 — Intercompany billing and reconciliation

There is **no** dedicated `API_INTERCOMPANY_*` OData service. Reconciliation agents should combine:

| Source | Service | IC signal |
|--------|---------|-----------|
| Billing | `API_BILLING_DOCUMENT_SRV` | https://api.sap.com/api/API_BILLING_DOCUMENT_SRV/overview |
| Path | `/sap/opu/odata/sap/API_BILLING_DOCUMENT_SRV/` | Billing type, payer, company code |
| JE lines | `API_JOURNALENTRYITEMBASIC_SRV` | `PartnerCompanyCode` |
| PO accruals | `API_PURCHASEORDER_PROCESS_SRV` | Open GR/IR vs IC PO |

| Field | Value |
|-------|-------|
| **R/W** | Billing: R + cancel/PDF actions; process initiation often **Fiori/job** (Generate IC Billing Request) |
| **Auth** | `SAP_COM_0120` (billing integration) |
| **Agent workflow** | 1) List billing docs by company pair 2) Match JE lines by partner company 3) Flag unmatched amounts |

---

## P1 — Supplier invoice

| Field | Value |
|-------|-------|
| **Service** | `API_SUPPLIERINVOICE_PROCESS_SRV` |
| **Hub** | https://api.sap.com/api/API_SUPPLIERINVOICE_PROCESS_SRV/overview |
| **Path** | `/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/` |
| **R/W** | R + W (BAPI-backed); W requires CSRF |
| **Auth** | `SAP_COM_0057` |
| **IC/P2P** | Reference PO via `to_SuplrInvcItemPurOrdRef`; account assignment `to_SupplierInvoiceItmAcctAssgmt` must include **ProfitCenter** explicitly ([KBA 3377659](https://userapps.support.sap.com/sap/support/knowledge/en/3377659)) |

**Agent commands:** `sinv get`, `sinv create-from-po` (high risk—human approval).

---

## P1 — Sales order (IC order type)

| Field | Value |
|-------|-------|
| **Service** | `API_SALES_ORDER_SRV` (verify hub name for your release) |
| **Hub** | Search “Sales Order” on api.sap.com |
| **Path** | `/sap/opu/odata/sap/API_SALES_ORDER_SRV/` (typical) |
| **R/W** | R for inquiry; IC order type SO03 often created in Fiori |
| **Agent** | Read header/items for IC linkage to billing |

---

## P2 — Material master

| Field | Value |
|-------|-------|
| **Service** | `API_PRODUCT_SRV` / material OData (release-specific) |
| **Hub** | https://api.sap.com/ → search “Product” or “Material” |
| **Path** | `/sap/opu/odata/sap/API_PRODUCT_SRV/` (example) |
| **R/W** | R for agent catalog; W restricted |
| **IC** | Stock transfer IC (workspace PDF: stock transfers) |

---

## P2 — Cost center / profit center

| Profit center | |
|---------------|--|
| **Service** | `API_PROFITCENTER_SRV` |
| **Hub** | https://api.sap.com/api/API_PROFITCENTER_SRV/overview |
| **Scenario** | `SAP_COM_0087` |
| **R/W** | R |

| Cost center | |
|-------------|--|
| **Service** | `API_COSTCENTER_SRV` |
| **Hub** | Search on api.sap.com |
| **R/W** | R |

**Agent:** Validate coding block before posting supplier invoice lines.

---

## P2 — Customer invoice

Search hub for **Customer Invoice** OData (name varies by release). Use for AR side of IC pairs; same CSRF/auth patterns as other FI OData.

---

## P3 — Bank statement / payment runs

Bank APIs vary by **region, bank integration, and S/4 release** (e.g. Electronic Bank Statement). Discovery steps:

1. api.sap.com → search “Bank”, “Payment”, “House Bank”
2. Check Communication Scenario in Fiori for your tenant
3. Prefer **read-only** CLIs for statement lines before payment run creation

| Typical pattern | R/W | Auth |
|-----------------|-----|------|
| Bank statement items | R | FI cash management scenario |
| Payment run | W (batch) | Strict approvals; not for sandbox |

---

## Sandbox vs tenant testing

| Environment | Base URL | Writes | Auth |
|-------------|----------|--------|------|
| API Hub sandbox | `https://sandbox.api.sap.com/s4hanacloud/...` | **No** | Header `apikey` from hub profile |
| Customer Cloud tenant | `https://{tenant}.sap.{region}...` | Yes (with CSRF) | OAuth / comm. user |
| On-premise | `https://{host}:{port}` | Yes (with CSRF) | Basic / cert |

---

## Suggested agent CLI bundles (printing press)

| CLI slug | Services included | Phase |
|----------|-------------------|-------|
| `sap-s4hana-business-partner` | `API_BUSINESS_PARTNER` | 1 – catalog example |
| `sap-s4hana-purchase-order` | `API_PURCHASEORDER_PROCESS_SRV` or `_2` | 1 |
| `sap-s4hana-journal-entry` | `API_JOURNALENTRYITEMBASIC_SRV` | 1 – IC recon |
| `sap-s4hana-finance-read` | JE + OPLACCTGDOC + Billing read | 2 – merged spec |
| `sap-s4hana-supplier-invoice` | `API_SUPPLIERINVOICE_PROCESS_SRV` | 3 – writes |

Each bundle = **one catalog YAML** + **one vendored OpenAPI** under `catalog/specs/`.

---

## Workspace context (AgroFresh intercompany)

Local materials under `FW_ Intercompany Files/`:

- Intercompany transaction processing (triangular sales, matching & clearing, stock transfers, accrual allocations)
- AgroFresh P2P business requirements for intercompany

Map automation phases:

1. **Master data** — Business Partner, CO objects  
2. **Operational docs** — PO, goods movement (where API exists), billing  
3. **Financial reconciliation** — JE / operational accounting cube with `PartnerCompanyCode`  
4. **Exceptions** — Unmatched IC pairs exported for human review (agent does not auto-post without policy)

See [sap-s4hana-fiori-cli-printing-press.md](./sap-s4hana-fiori-cli-printing-press.md) for technical setup.
