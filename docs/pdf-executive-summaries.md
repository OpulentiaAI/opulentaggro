# AgroFresh Intercompany Process PDFs — Executive Summaries

**Client:** AgroFresh  
**Workspace:** `/Users/jeremyalston/Perfect/FW_  Intercompany Files/`  
**Document date:** 2026-05-28  
**Related:** [engagement-context-and-access-requirements.md](./engagement-context-and-access-requirements.md)

---

## Introduction

This document summarizes four **Visio-derived process flow PDFs** that describe AgroFresh’s SAP S/4HANA intercompany transaction processing. The PDFs are swimlane diagrams showing roles, SAP modules, workflow routing, and which steps are automated versus manual or offline.

| Attribute | Detail |
|-----------|--------|
| **Source format** | Exported from Microsoft Visio (`Visio-Intercompany Transaction Processing (*).vsdx`) |
| **Version** | v1 |
| **Creation date** | 2026-05-21 (per PDF metadata) |
| **Companion materials** | `AgroFresh P2P_Business_Requirements_Intercompany_v1_05202026.docx`, `AgroFresh P2P_Intecompany_Transactions_v1_05122026.docx` |
| **PDFs found** | 4 (see inventory below) |

The PDFs are visually oriented; text extraction is limited. Summaries below combine PDF swimlane labels with the business requirements and transaction map docx files for SAP transaction codes, tolerances, and role detail.

### PDF inventory

| # | File name |
|---|-----------|
| 1 | [Intercompany Transaction Processing (Stock Transfers)v1.pdf](../Intercompany%20Transaction%20Processing%20(Stock%20Transfers)v1.pdf) |
| 2 | [Intercompany Transaction Processing (Triangular Sales)v1.pdf](../Intercompany%20Transaction%20Processing%20(Triangular%20Sales)v1.pdf) |
| 3 | [Intercompany Transaction Processing (Acrrual Allocations)v1.pdf](../Intercompany%20Transaction%20Processing%20(Acrrual%20Allocations)v1.pdf) |
| 4 | [Intercompany Transaction Processing (Matching & Clearing)v1.pdf](../Intercompany%20Transaction%20Processing%20(Matching%20%26%20Clearing)v1.pdf) |

*Note: “Acrrual” is a typo in the source filename; content refers to accrual allocations.*

---

## 1. Stock Transfers

**File:** [Intercompany Transaction Processing (Stock Transfers)v1.pdf](../Intercompany%20Transaction%20Processing%20(Stock%20Transfers)v1.pdf)

### Executive summary

Stock transfer orders (STOs) move product between AgroFresh legal entities. A **Requestor** creates and codes the STO in SAP MM; approval follows **DoA (Delegation of Authority)** via SAP Workflow. On approval, the STO posts and routes to the **Sender/Supplier**, who confirms delivery and posts goods **in transit** (movement type **643**). SAP Workflow then auto-generates the intercompany invoice in SD and auto-posts IC accounts receivable and payable in FI.

The Requestor posts goods receipt, triggering an **automatic three-way match** among STO, GR, and IC invoice in FI. **MIRO** enforces quantity and price tolerances and GR/IR clearing. Matches within tolerance route to the IC match-and-clear process; failures open a **dispute** returned to Requestor and Sender via workflow. **Booking advice** (bill of lading) is distributed through workflow—not via SAP Logistics Execution.

This is the most workflow-dense IC process and the primary candidate for **Tier 1 read-path automation**: agents can trace STO → delivery (643) → IC billing → MIRO status without posting, while DoA and dispute resolution stay human-governed.

### Key process steps

- Create and code stock transfer order (STO) — SAP-MM
- Route STO for DoA approval via SAP Workflow (approve → post → notify Sender; reject → park → return to Requestor)
- Sender receives STO and confirms delivery; post goods **in transit** — SAP-MM/SD (movement type **643**)
- Auto-create IC invoice — SAP-SD via SAP Workflow
- Auto-post IC AR and IC AP (settlement) — SAP-FI via SAP Workflow
- Requestor posts goods receipt — SAP-MM
- **AUTO** three-way match (STO / GR / IC invoice) — SAP-FI
- MIRO checks quantity and price; GR/IR clearing enforced
- **Match (within tolerance)** → route to IC Match & Clear via workflow
- **No match** → dispute routed to Requestor and Sender for resolution via workflow
- Booking advice distributed via workflow

### Roles & responsibilities

| Role | Responsibilities | SAP area |
|------|------------------|----------|
| **Requestor** | Create/code STO; post GR; resolve disputes | MM |
| **Sender / Supplier** | Receive STO; delivery confirmation; goods in transit (643); IC invoice trigger | MM / SD |
| **Accounts Payable** | MIRO tolerance handling; dispute participation | FI |
| **Accounting** | IC AR/AP auto-posting; settlement | FI |
| **Customer** | Swimlane placeholder (external party not primary in STO) | — |
| **Treasury** | Downstream match/clear and bank transfer (see Matching & Clearing PDF) | FI + bank |

### SAP touchpoints

| Area | Transactions / objects |
|------|------------------------|
| **MM** | STO creation/posting; goods receipt; movement type **643** (goods in transit) |
| **SD** | IC invoice creation (auto via workflow) |
| **FI** | IC AR/AP settlement; **MIRO** three-way match; GR/IR clearing |
| **Workflow** | DoA approval; auto IC invoice; auto settlement; dispute routing; booking advice |

### Automation vs manual highlights

| Automated (AUTO / Workflow) | Manual / human |
|----------------------------|----------------|
| IC invoice creation after delivery confirmation | STO creation and coding (Requestor) |
| IC AR/AP settlement posting | DoA approval/rejection decisions |
| Three-way match initiation | Goods receipt posting (Requestor) |
| MIRO tolerance check (system-enforced) | Dispute resolution when outside tolerance |
| Route to IC Match & Clear on successful match | Booking advice review/handling via workflow |

### Relevance to engagement

Stock transfers anchor the **Opulent OS / OData CLI** proof of concept. Tier 1 agents should read PO/STO status (`API_PURCHASEORDER_*`), trace billing documents (`API_BILLING_DOCUMENT_SRV`), and filter journal entries by `PartnerCompanyCode` (`API_JOURNALENTRYITEMBASIC_SRV`) to mirror this swimlane without mutating FI. MIRO exception queues and workflow task visibility are Tier 2 targets; F110 and treasury steps defer to the Matching & Clearing process.

---

## 2. Triangular Sales

**File:** [Intercompany Transaction Processing (Triangular Sales)v1.pdf](../Intercompany%20Transaction%20Processing%20(Triangular%20Sales)v1.pdf)

### Executive summary

Triangular sales occur when a **Seller** takes a customer order but fulfillment comes from a **Sender** plant in another country. The Seller creates a customer sales order in SAP SD with the **sending plant in another country** flagged. DoA workflow approves or rejects the SO; on approval, the SO auto-posts and the Sender is notified.

The Sender confirms delivery, posts goods **issued** in MM, and produces delivery documents. **Booking advice / BOL** is generated as PDF output from the delivery document (not via SAP LE module) and routed through workflow. The Seller issues the **customer invoice**; the Supplier/Sender side creates the **IC invoice**. IC AR/AP auto-post in FI, then the flow joins the shared **IC Match & Clear** path.

Coordination latency across Seller → Sender → dual invoicing is a stated pain point. Agents can provide an **observable fulfillment and billing spine**—SO status, delivery confirmation, billing document pairs—while DoA and customer-facing billing judgment remain with finance and sales operations.

### Key process steps

- Create customer sales order (SAP-SD) — indicate **sending plant in another country**
- Route SO for DoA review via SAP Workflow (approve → auto-post; reject → return to Seller)
- Notify Sender via SAP Workflow
- Sender confirms delivery and posts goods **issued** — SAP-MM
- Booking advice / BOL — PDF from delivery document; routed via workflow (not LE module)
- Seller creates and posts **customer invoice** — SAP-SD
- Create and post **IC invoice** — SAP-SD (Supplier/Sender side)
- Auto-post IC AR and IC AP — SAP-FI via SAP Workflow
- Route to **IC Match & Clear** via workflow

### Roles & responsibilities

| Role | Responsibilities | SAP area |
|------|------------------|----------|
| **Seller** | Customer SO; customer invoice; IC ship-from-plant indication | SD |
| **Sender / Supplier** | Fulfillment; delivery posting; BOL/booking advice; IC invoice | MM / SD |
| **Requestor / Receiver** | Swimlane aggregate (IC receiving entity context) | MM / FI |
| **Accounts Payable** | IC invoice / settlement support | FI |
| **Accounting** | Auto IC AR/AP posting | FI |
| **Customer** | External counterparty receiving goods and customer invoice | SD |
| **Treasury** | Downstream payment and clearing | FI + bank |

### SAP touchpoints

| Area | Transactions / objects |
|------|------------------------|
| **SD** | Customer sales order; customer invoice; IC invoice; billing documents |
| **MM** | Delivery confirmation; post goods issued |
| **FI** | IC AR/AP auto-settlement |
| **Workflow** | DoA; Sender notification; booking advice routing; match/clear handoff |
| **Documents** | Booking advice / BOL as PDF output from delivery (SharePoint archive target in blueprint) |

### Automation vs manual highlights

| Automated (AUTO / Workflow) | Manual / human |
|----------------------------|----------------|
| SO auto-post on approval | SO creation with correct cross-country plant |
| Sender notification | Seller revision on rejection |
| Delivery document production | Physical/logistical fulfillment |
| IC invoice and IC AR/AP auto-post | Customer invoice timing and commercial terms |
| IC Match & Clear routing | BOL receipt and archival via workflow |

### Relevance to engagement

Triangular sales exercise **cross-module reads** (SD sales order + MM delivery + dual billing documents). CLI priorities include `API_SALES_ORDER_SRV` and `API_BILLING_DOCUMENT_SRV` to correlate customer and IC billing pairs. Tier 2 SharePoint integration targets BOL/booking advice evidence. Agents should not auto-post customer or IC invoices in early tiers; they orchestrate visibility and exception classification across the Seller–Sender handoff.

---

## 3. Accrual Allocations

**File:** [Intercompany Transaction Processing (Acrrual Allocations)v1.pdf](../Intercompany%20Transaction%20Processing%20(Acrrual%20Allocations)v1.pdf)

### Executive summary

Accrual allocations distribute annual intercompany charges—**IC loans, royalties, management fees, interest payments, and R&D charges** (often cost-plus from other countries to the US)—across entities. The **Provider** captures IC accruals in SAP FI. The **Receiver** receives an IC allocation notification via workflow. The Provider prepares an **IC Accrual Allocation Adjustment** in SAP CO, routed through DoA for approval.

On approval, the adjustment and IC AR/AP auto-post in FI. Settlement may use an **IDoc interface** per the transaction map. The PDF also shows downstream **F110 payment run** and auto match/clear, plus Treasury steps: regional Finance determines funds **offline**, then Treasury executes bank transfers manually in the banking system. **Tax withholding** (VAT and other government charges) is manually determined by the Tax team—not automated in source materials.

This process is **annual and judgment-heavy** (tax, CO allocations). Automation should focus on accrual capture visibility, allocation notification tracking, and settlement document reads; tax and withholding remain expert-gated (Vertex enrichment in Tier 2).

### Key process steps

- Provider captures IC accruals — SAP-FI
- Receiver notified of allocation amount — SAP Workflow
- Provider creates IC Accrual Allocation Adjustment — SAP-CO
- Route adjustment for DoA approval — SAP Workflow
- Approve and post IC Accrual Allocation Adjustment — SAP-CO/FI via workflow
- Auto-post IC AR and IC AP (settlement) — SAP-FI (IDoc interface per transaction doc)
- Run IC payment run — SAP-FI **[F110]**
- **AUTO** match and clear payments on paying and receiving entities — SAP-FI
- Coordinate with regional Finance; **determine funds to be transferred (offline)**
- Transfer funds between bank accounts — **manual** in banking systems — Treasury

**Accrual types called out:** IC loans, royalties, management fees, interest payments, R&D charges. Process performed **annually at year end**.

### Roles & responsibilities

| Role | Responsibilities | SAP area |
|------|------------------|----------|
| **Provider** | Capture accruals; create CO allocation adjustment | FI / CO |
| **Receiver** | Receive IC allocation notification | FI / CO |
| **Accounting** | Auto IC AR/AP; settlement monitoring | FI |
| **Tax** | Withholding / VAT determination (manual) | Tax / Vertex (Tier 2) |
| **Treasury** | F110 payment run; manual bank transfer | FI + bank |
| **Regional Finance** | Offline cash-needs determination | Offline |

### SAP touchpoints

| Area | Transactions / objects |
|------|------------------------|
| **FI** | Accrual capture; IC AR/AP posting; **F110** payment run |
| **CO** | IC accrual allocation adjustment |
| **FI (settlement)** | IDoc interface for IC settlement (per transaction map) |
| **Workflow** | Allocation notification; DoA on CO adjustment |
| **Tax** | Manual withholding preparation (Vertex in Tier 2 blueprint) |

### Automation vs manual highlights

| Automated (AUTO / Workflow) | Manual / human |
|----------------------------|----------------|
| IC allocation notification | Accrual accumulation and classification (Provider) |
| Auto-post CO adjustment on approval | Tax/VAT withholding determination |
| Auto IC AR/AP settlement | Regional Finance cash-needs analysis (offline) |
| F110 payment run execution (Treasury in SAP) | Bank account transfers in banking portal |
| Auto match/clear on paying/receiving entities | DoA approval on allocation adjustment |

### Relevance to engagement

Accrual allocations are **Tier 2+** for meaningful automation: CO posting may be workflow-only, IDoc monitoring is read-first, and tax requires Vertex plus human approval. Agents can read profit/cost center master data (`API_PROFITCENTER_SRV`, `API_COSTCENTER_SRV`) and journal entries to validate posted allocations against notifications. F110 preparation may be supported in Tier 3; execution and bank release stay treasury-governed.

---

## 4. Matching & Clearing

**File:** [Intercompany Transaction Processing (Matching & Clearing)v1.pdf](../Intercompany%20Transaction%20Processing%20(Matching%20%26%20Clearing)v1.pdf)

### Executive summary

Matching and clearing net intercompany AR/AP balances across paying and receiving entities. Unlike the operational IC processes (STO, triangular, accruals), this flow is **treasury-centric** and driven by **cash needs** determined offline by Finance, Treasury, and regional teams—not fully represented in SAP OData today.

Treasury runs the **IC payment run (F110)** in SAP FI. The system **automatically matches and clears** IC AP on the paying entity and IC AR on the receiving entity. Actual **fund movement between bank accounts** is executed **manually** by Treasury in external banking systems (CitiConnect / HSBC per engagement blueprint). This PDF is the convergence point for all upstream IC processes once invoices settle and cash movement is required.

Automation here must respect **explicit treasury release governance**: agents can read open IC items and prepare F110 parameters in later tiers, but payment execution and bank portal release remain human-approved until Tier 3.

### Key process steps

- Matching and clearing of IC AR/AP based on **cash needs** — Finance / Treasury / Region (**offline**)
- Determine funds to be transferred — **offline**
- Run IC payment run — SAP-FI **[F110]** — Treasury
- **AUTO** match and clear payments on paying and receiving entities — SAP-FI
- Transfer funds between bank accounts — **manual** — Treasury (banking systems)

### Roles & responsibilities

| Role | Responsibilities | SAP area |
|------|------------------|----------|
| **Finance / Regional** | Cash-needs analysis; fund transfer decisions | Offline |
| **Treasury** | F110 payment run in SAP; manual bank transfers | FI + bank |
| **Accounting** | IC AR/AP clearing validation; reconciliation support | FI |
| **Sender / Provider** | Upstream IC invoice origin (contextual swimlane) | SD / FI |
| **Accounts Payable** | IC AP side of clearing | FI |
| **Customer** | Not primary actor in this process | — |

### SAP touchpoints

| Area | Transactions / objects |
|------|------------------------|
| **FI** | **F110** (payment run); auto clear IC AP (paying) and IC AR (receiving) |
| **Bank systems** | Manual fund transfer (CitiConnect / HSBC; ISO 20022 in Tier 3 blueprint) |
| **Offline** | Cash-needs determination; central IC reconciliation (separate Process 5) |

### Automation vs manual highlights

| Automated (AUTO) | Manual / offline |
|-----------------|------------------|
| Match and clear IC AP/AR on paying/receiving entities after F110 | Determine funds to transfer (Finance/Treasury/Region offline) |
| F110 payment run processing in SAP (Treasury-initiated) | Bank account transfers in external banking portal |
| — | Treasury release approval and bank gateway credentials (Tier 3) |

### Relevance to engagement

Matching & clearing defines the **Tier 3 boundary** for the Opulent engagement. Tier 1 agents use `API_JOURNALENTRYITEMBASIC_SRV` and open-item reads to surface uncleared IC pairs filtered by `PartnerCompanyCode`. Tier 3 may generate ISO 20022 payment files and F110 prep, but **bank release stays manual** until AgroFresh signs off on treasury automation. Offline cash-needs logic should be documented as an explicit human gate—not inferred or auto-decided by agents.

---

## Cross-PDF themes

The four process flows share a consistent operating model that informs the AgroFresh intercompany automation blueprint:

### Shared swimlane architecture

All PDFs use the same role columns: **Requestor / Seller / Receiver**, **Sender / Supplier / Provider**, **Accounts Payable**, **Accounting**, **Customer**, and **Treasury**. This reflects that IC is inherently **cross-functional**—no single SAP module owns the end-to-end flow.

### SAP Workflow as the automation engine

Steps labeled **AUTO** in business requirements are triggered by **SAP Workflow**, not ad hoc OData posts. IC invoice creation, IC AR/AP settlement, three-way match initiation, and match/clear routing are workflow-driven. Agent design must **prepare and observe** state transitions; it must not bypass DoA or workflow posting rules.

### Common FI settlement pattern

Stock transfers, triangular sales, and accrual allocations all converge on:

1. IC invoice or allocation document  
2. Auto IC AR/AP posting (SAP-FI)  
3. Handoff to **Matching & Clearing** (F110 + auto clear)

Agents should treat **PartnerCompanyCode** on journal entry lines as the primary reconciliation signal across all four processes.

### Offline treasury and finance gates

**Cash-needs determination** and **bank transfers** appear in both the Accrual Allocations and Matching & Clearing PDFs as explicitly **offline/manual** steps. This is the largest OData gap for full automation and defines the Tier 1–3 phasing boundary.

### Document evidence outside SAP

**Booking advice / BOL** appears in Stock Transfers and Triangular Sales as PDF outputs from delivery documents, routed via workflow—not stored in SAP LE. The blueprint targets **SharePoint archival** (Tier 2) for audit evidence.

### Human judgment preserved

| Domain | Where it appears |
|--------|------------------|
| **DoA approvals** | All operational processes (STO, SO, CO adjustment) |
| **MIRO tolerances** | Stock transfers — dispute routing when outside qty/price bands |
| **Tax withholding** | Accrual allocations — manual Tax team; Vertex in Tier 2 |
| **Treasury release** | Matching & clearing — F110 in SAP; bank portal manual |

### Automation opportunity matrix (engagement view)

| Theme | Read-first (Tier 1) | Orchestrated (Tier 2) | Governed write (Tier 3) |
|-------|---------------------|----------------------|-------------------------|
| Trace IC document chains | PO/STO, SO, billing, JE reads | MIRO exception queues | — |
| Workflow visibility | Task/inbox status | Dispute classification | — |
| Evidence | — | SharePoint BOL archive | — |
| Tax | — | Vertex enrichment | Human approval on withhold |
| Treasury | Open IC item export | F110 prep/read | Bank gateway + release gate |

### Module span summary

| Process | MM | SD | FI | CO | Workflow | Offline |
|---------|----|----|----|----|----------|---------|
| Stock Transfers | ● | ● | ● | — | ● | BOL via workflow |
| Triangular Sales | ● | ● | ● | — | ● | BOL PDF |
| Accrual Allocations | — | — | ● | ● | ● | Cash needs; tax |
| Matching & Clearing | — | — | ● | — | — | Cash needs; bank |

---

*Summaries derived from PDF text extraction (pypdf), PDF metadata, and cross-reference with AgroFresh P2P business requirements and intercompany transaction map (May 2026). Update if AgroFresh provides revised Visio/PDF versions or tenant-specific transaction variants.*
