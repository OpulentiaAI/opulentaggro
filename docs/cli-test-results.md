# SAP S/4HANA CLI & API — Test Results

**Workspace:** `/Users/jeremyalston/Perfect/FW_  Intercompany Files/` (note: **two spaces** after `FW_`)  
**Test date:** 2026-05-28  
**Tester:** Opulent delivery (automated discovery run)  
**Related docs:** [sap-s4hana-fiori-cli-printing-press.md](./sap-s4hana-fiori-cli-printing-press.md), [engagement-context-and-access-requirements.md](./engagement-context-and-access-requirements.md)

---

## Executive summary

Initial CLI/API discovery was run against the intercompany workspace to validate the path from **SAP Business Accelerator Hub** → **OpenAPI spec** → **cli-printing-press** → **sandbox OData smoke test**. Results are **partially blocked** by missing API Hub key, unvendored catalog spec (404), and **disk full** preventing `printing-press` installation.

| Test | Result | Blocker |
|------|--------|---------|
| A. Sandbox OData (no API key) | **Fail (expected)** | No `SAP_APIHUB_KEY` in environment |
| B. Hub metadata / spec download | **Partial** | Login required for official download |
| C. Catalog `spec_url` | **404** | Spec not yet on upstream repo |
| D. Public EDMX sample | **Pass** | ~564 KB from SAP-archive GitHub |
| E. cli-printing-press install | **Fail** | Disk full (~99% used) |
| F. OData → OpenAPI conversion | **Not completed** | Shell backend unavailable mid-run |

---

## 1. Discovery — what exists in the workspace

| Artifact | Path | Status |
|----------|------|--------|
| Technical setup doc | `docs/sap-s4hana-fiori-cli-printing-press.md` | Present |
| Use case matrix | `docs/sap-s4hana-use-cases.md` | Present |
| Catalog blueprint | `catalog/sap-s4hana-business-partner.yaml` | Present |
| Vendored OpenAPI specs | `catalog/specs/` | **Missing** |
| Generated CLI binaries | — | **Missing** |
| Go source / local clone | — | **Missing** |
| `printing-press` on PATH | — | **Not installed** |
| Local `cli-printing-press` clone | — | **Not found** |

The catalog entry references a placeholder `spec_url`:

```yaml
spec_url: https://raw.githubusercontent.com/mvanhorn/cli-printing-press/main/catalog/specs/sap-api-business-partner.openapi.json
```

This URL returns **HTTP 404** — the spec has not been committed to the upstream catalog yet.

---

## 2. Environment prerequisites checked

| Variable / tool | Status |
|-----------------|--------|
| `SAP_APIHUB_KEY` | **Not set** |
| `SAP_API_KEY` | **Not set** |
| `SAP_S4_BASE_URL` | **Not set** (expected — no tenant access yet) |
| `SAP_COMMUNICATION_USER` / `PASSWORD` | **Not set** |
| `curl` | Available |
| `go` | Available |
| `printing-press` | **Not on PATH** |
| `pdftotext` | Not available (PDF text extraction skipped) |
| Disk space | **~99% used** (~2.1 GiB free at test time) |

---

## 3. Test A — SAP Business Hub sandbox (GET, no API key)

**Purpose:** Validate public sandbox endpoint behavior without credentials.

**Command:**

```bash
curl -s -w "\nHTTP_CODE:%{http_code}\n" \
  "https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?\$top=1&\$format=json"
```

**Result:** **Fail (expected without key)**

| Field | Value |
|-------|-------|
| HTTP status | **401 Unauthorized** |
| Response body (redacted) | `"Failed to resolve API Key variable request.header.apikey"` |
| Conclusion | Sandbox requires `apikey` header from [API Hub profile](https://api.sap.com/profile/showApiKey) |

**Expected pass command (after key obtained):**

```bash
export SAP_APIHUB_KEY="{from_hub_profile}"
curl -s -H "apikey: $SAP_APIHUB_KEY" \
  "https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner?\$top=1&\$format=json"
```

**Note:** Hub sandbox is **GET-only** — POST/PATCH/DELETE will fail CSRF or policy checks even with a valid key.

---

## 4. Test B — Hub metadata and spec pages

**Purpose:** Determine whether OpenAPI/EDMX can be downloaded without authentication.

| URL | HTTP | Notes |
|-----|------|-------|
| `https://api.sap.com/api/API_BUSINESS_PARTNER/overview` | **200** | Public HTML overview page |
| `https://api.sap.com/api/API_BUSINESS_PARTNER/resource` | **302 → OAuth** | Spec download requires SAP ID login |
| Catalog `spec_url` (raw GitHub) | **404** | Placeholder — spec not vendored |

**Conclusion:** Official spec download requires **logged-in SAP ID**. Unauthenticated programmatic download is not available for production specs.

---

## 5. Test C — Catalog `spec_url` validation

**Purpose:** Confirm whether the blueprint catalog entry can generate a CLI today.

**URL tested:**

```text
https://raw.githubusercontent.com/mvanhorn/cli-printing-press/main/catalog/specs/sap-api-business-partner.openapi.json
```

**Result:** **HTTP 404 Not Found**

**Implication:** `printing-press generate` cannot succeed until:

1. OpenAPI JSON is downloaded from hub (logged in), **or**
2. EDMX is converted via `odata-openapi`, **and**
3. File is committed to `catalog/specs/sap-api-business-partner.openapi.json` with updated `spec_url`

---

## 6. Test D — Public EDMX sample download

**Purpose:** Validate fallback path for OData → OpenAPI conversion.

**URL:**

```text
https://raw.githubusercontent.com/SAP-archive/teched2020-IIS360/main/app/test-resources/api-hub/API_BUSINESS_PARTNER.edmx
```

**Result:** **Pass**

| Field | Value |
|-------|-------|
| HTTP status | **200** |
| File size | ~564 KB |
| Format | OData V2 EDMX (XML) |

**Conclusion:** EDMX acquisition works via public archive sample. Hub-downloaded EDMX (release-accurate) still requires login. Conversion to OpenAPI 3.0 was **not completed** in this run.

**Planned conversion command:**

```bash
npx -y odata-openapi3 API_BUSINESS_PARTNER.edmx \
  --host sandbox.api.sap.com \
  --scheme https \
  --basePath /s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER \
  -o catalog/specs/sap-api-business-partner.openapi.json
```

---

## 7. Test E — cli-printing-press installation

**Purpose:** Install generator CLI for smoke test.

**Command attempted:**

```bash
go install github.com/mvanhorn/cli-printing-press/cmd/printing-press@latest
```

**Result:** **Fail — no space left on device**

| Field | Value |
|-------|-------|
| Error | `no space left on device` |
| Disk usage at test time | ~99% (~2.1 GiB free) |
| `printing-press --help` | **Not run** (binary not installed) |
| `printing-press generate` dry-run | **Not run** |

**Alternative install paths (not attempted):**

- Download release binary from [cli-printing-press releases v4.19.0](https://github.com/mvanhorn/cli-printing-press/releases/tag/v4.19.0)
- Clone repo to external volume with sufficient space

---

## 8. Test F — @sap/apihub-service-provider (programmatic hub)

**Purpose:** Explore npm package for hub API listing.

**Command:**

```bash
npx @sap/apihub-service-provider
```

**Result:** **N/A — library only, no CLI executable**

Package `@sap/apihub-service-provider` v5.0.5 exists on npm but provides programmatic APIs (`getListODataServices()`, `getMetadata()`), not a standalone CLI. Useful for discovery scripts; not a substitute for spec download.

---

## 9. Skipped tests (blocked by prerequisites)

| Test | Reason skipped |
|------|----------------|
| Sandbox OData with valid API key | No `SAP_APIHUB_KEY` |
| `printing-press generate` from catalog | Binary not installed + spec 404 |
| `printing-press --help` | Binary not installed |
| Tenant OData with comm user | No `SAP_S4_BASE_URL` or credentials |
| CSRF fetch + POST smoke | Requires tenant; sandbox rejects writes |
| Full EDMX → OpenAPI conversion | Shell backend unavailable mid-run |
| `@sap/apihub-service-provider` script | Not prioritized after disk failure |

---

## 10. Blockers summary

| # | Blocker | Impact | Owner |
|---|---------|--------|-------|
| 1 | **No SAP API Hub key** | Cannot pass sandbox smoke test | Engineering — register at api.sap.com |
| 2 | **Catalog spec 404** | Cannot run `printing-press generate` | Opulent — vendor OpenAPI in repo |
| 3 | **Disk full** | Cannot `go install printing-press` | Local dev — free disk space |
| 4 | **No tenant access** | Cannot test real IC data | AgroFresh Basis — see engagement doc §6 |
| 5 | **Hub login for specs** | Cannot get release-accurate OpenAPI | Engineer SAP ID |

---

## 11. Recommended next steps

### Step 1 — Obtain API Hub key (same day)

1. Register / log in at [https://api.sap.com/](https://api.sap.com/)
2. Navigate to [Profile → Show API Key](https://api.sap.com/profile/showApiKey)
3. `export SAP_APIHUB_KEY="{key}"`
4. Re-run sandbox curl (Test A expected pass command above)
5. Confirm JSON response with `A_BusinessPartner` entity

### Step 2 — Free disk space and install printing-press

1. Free sufficient disk space on dev machine (target ≥5 GiB free)
2. Install via release binary **or** `go install github.com/mvanhorn/cli-printing-press/cmd/printing-press@latest`
3. Verify: `printing-press --help`

### Step 3 — Vendor OpenAPI spec

**Option A (preferred):** Hub login → API_BUSINESS_PARTNER → API Specification → JSON → save as `catalog/specs/sap-api-business-partner.openapi.json`

**Option B:** Download EDMX (hub or public archive) → convert with `odata-openapi3` → commit to `catalog/specs/`

Update `catalog/sap-s4hana-business-partner.yaml`:

```yaml
spec_url: https://raw.githubusercontent.com/{org}/{repo}/main/catalog/specs/sap-api-business-partner.openapi.json
```

### Step 4 — Generate and smoke-test CLI

```bash
printing-press generate sap-s4hana-business-partner --from-catalog
# Or:
printing-press generate https://raw.githubusercontent.com/{org}/{repo}/main/catalog/specs/sap-api-business-partner.openapi.json

export SAP_APIHUB_KEY="{key}"
# Run generated CLI list/get against sandbox
```

### Step 5 — Request AgroFresh tenant access

Per [engagement-context-and-access-requirements.md](./engagement-context-and-access-requirements.md):

- Dev/QA `SAP_S4_BASE_URL`
- Communication User + arrangements for `SAP_COM_0008`, `SAP_COM_0053`
- Sample STO/SO document numbers for IC trace tests

### Step 6 — Expand P0 catalog entries

After Business Partner CLI passes sandbox + QA smoke, repeat spec vendoring for:

| CLI slug | Service |
|----------|---------|
| `sap-s4hana-purchase-order` | `API_PURCHASEORDER_PROCESS_SRV` or `API_PURCHASEORDER_2` |
| `sap-s4hana-journal-entry` | `API_JOURNALENTRYITEMBASIC_SRV` |

---

## 12. Test matrix (planned re-run)

| ID | Test | Prerequisite | Expected result |
|----|------|--------------|-----------------|
| A′ | Sandbox GET with key | `SAP_APIHUB_KEY` | 200 + JSON entity |
| B′ | Hub OpenAPI download | SAP ID login | Local `.json` file |
| C′ | Catalog spec_url | Vendored spec in repo | 200 from raw GitHub |
| D′ | EDMX → OpenAPI | `npx odata-openapi3` | Valid OpenAPI 3.0 file |
| E′ | `printing-press generate` | Steps C′ + E install | CLI binary produced |
| F′ | Generated CLI sandbox call | A′ + E′ | Same as A′ via CLI |
| G | QA tenant read | AgroFresh comm user | 200 + real BP/PO |
| H | CSRF fetch (QA) | G + write scope approved | Token + cookie captured |

---

*Re-run this test suite after Steps 1–3 complete and update this document with pass/fail timestamps.*
