# Kalodata API Contract Verification Report (Phase 0)

- **Document Path:** `docs/quality/kalodata-api-contract-verification.md`
- **Phase 0 Completion Status:** **PARTIALLY COMPLETE — NOT FULLY COMPLETE** (source-code & artifact audit finished; live upstream contract probe blocked)
- **Design Reference:** `docs/product-intelligence-v2-design-spec.md` (GitHub branch `docs/product-intelligence-v2-spec`, commit `c8f7fd2bccc2f84c4336c0426df5c0e3e4f738c4`)
- **Codebase Baseline Audited:** `main` (`55457854ee0248b95dbdd0bd83e0b6e39f1b90e4`) / `docs/product-intelligence-v2-spec` (`c8f7fd2bccc2f84c4336c0426df5c0e3e4f738c4`)
- **Execution Mode:** Strictly documentation-only / read-only codebase inspection (zero application source-code edits, zero scoring changes, zero database/env/secret changes)
- **Live API Execution Record:** **`0` live API requests executed; `0` Kalodata credits consumed.** No `KALODATA_API_KEY` is configured in `.env`, the process environment, or the running local server session (`/api/kalodata/status` returned `{"connected":false,"keySource":"none"}`), and Phase 0 restrictions prohibit modifying environment variables or secrets.

---

## Classification Legend

Every finding in this document is explicitly categorized under one of three evidence tiers:

1. **`VERIFIED FROM SOURCE CODE`** — Proven directly by inspecting repository implementation (`server/kalodata.ts`, `server/productService.ts`, `server.ts`, `server/scoreEngine.ts`, `src/App.tsx`, `src/lib/storage.ts`, `src/types.ts`). Proves what SiamVisual sends and how SiamVisual parses/stores data, **not** what Kalodata returns upstream.
2. **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** — Corroborated by committed UI session screenshots in `public/assets/aistudio/` (`Screenshot_2026-11-24-20-44-39...jpg`, `Screenshot_2026-11-25-00-38-58...jpg`, `Screenshot_2026-11-25-02-04-14...jpg`). Shows rendered outputs from an earlier user session, but cannot prove raw upstream JSON keys, absent field causes, or population rates across endpoints.
3. **`UNVERIFIED — REQUIRES LIVE API ACCESS`** — Upstream Kalodata API behavior, field coverage, units, edge cases, or billing rules that **cannot** be inferred from TypeScript interfaces, parser fallbacks, or UI screenshots alone and require live API probe responses.

---

## Executive Summary

- **Phase 0 Status:** **PARTIALLY COMPLETE (Blocked on Live API Key).**
- **What Is Done (`VERIFIED FROM SOURCE CODE`):** Complete audit of all 6 Kalodata endpoints implemented in `server/kalodata.ts`, request parameters and defaults, link/rank routing, credit guardrails, 10-minute server cache vs. client `forceRefresh: true` bypass, retry/error handling, parser coercions, hydration bugs, and all V2 compatibility gaps against `docs/product-intelligence-v2-design-spec.md`.
- **What Remains Blocked (`UNVERIFIED — REQUIRES LIVE API ACCESS`):** Zero live Kalodata API calls could be run (`0` requests, `0` credits consumed) because no `KALODATA_API_KEY` is configured. All 8 upstream contract questions (Section 5) remain open and must be answered via a gated 1–2 request live probe (`0.2–0.4 cr` budget) before finalizing Phase 1 unit parsers or multi-sort retrieval.

---

## 1. Verified Endpoint & Request Contract

### 1.1 Base URL, Authentication, and Headers (`VERIFIED FROM SOURCE CODE`)
- **Base URL (`server/kalodata.ts:84`):** `https://www.kalodata.com/openapi/v1` (allowlisted constant `KALODATA_BASE_URL`).
- **Headers (`server/kalodata.ts:515-519`):**
  - `Content-Type: application/json;charset=UTF-8`
  - `secret-key: <apiKey>`
  - `source-type: SKILL`
- **Key Resolution Priority (`server/kalodata.ts:226-238`):**
  1. In-memory `sessionKalodataApiKey` (set via `POST /api/kalodata/connect`, cleared via `DELETE /api/kalodata/connect` or server restart; never written to disk or `localStorage`).
  2. `process.env.KALODATA_API_KEY` (loaded via `import 'dotenv/config'` in `server.ts:1`).
- **Client-Expected JSON Envelope (`server/kalodata.ts:499, 524-561`):**
  - Success: `{ "success": true, "data": ... }`
  - Failure: `{ "success": false, "code": ..., "message": ... }` (or `msg`)
  - **64-bit ID Protection (`server/kalodata.ts:529-532`):** Before `JSON.parse`, 16–24 digit integer values for keys `product_id`, `id`, `item_id`, `shop_id`, `seller_id`, `video_id`, `creator_id` are rewritten to JSON strings to avoid IEEE-754 precision loss.

### 1.2 Upstream Endpoints Implemented in `server/kalodata.ts`

| Upstream Path | Method | Timeout | App Route / Trigger | Request Payload & Defaults (`VERIFIED FROM SOURCE CODE`) | Upstream Contract Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/credit/balance` | `GET` | `10000ms` | `GET /api/kalodata/status`, `GET /api/kalodata/balance`, `POST /api/kalodata/connect`, pre/post credit guardrails (`kalodata.ts:628-634`) | `body: undefined`. Reads `data.totalRemain`, `data.mainRemain`, `data.subRemain`. | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** (Screenshot 1 displays `14.6 credits` and `Main Key`). |
| `/tiktok/category/rank` | `POST` | `20000ms` | `POST /api/kalodata/categories/sync` (`kalodata.ts:797-812`) | `region: 'TH'`, `language: 'en-US'`, `currency: 'THB'`, `date_range: 'last7Day'`, `category_level: 1`, `page_number: 1`, `page_size: 20`, `sort_field: { field: 'revenue', type: 'DESC' }`. | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** (Screenshot 1 renders 20 live TH L1 categories). |
| `/tiktok/product/rank` | `POST` | `25000ms` | `POST /api/products/search` when input is not a product link/ID (`kalodata.ts:998-1027`) | `region: 'TH'`, `language: 'en-US'`, `currency: 'THB'`, `date_range: 'last7Day'`, `page_number: 1`, `page_size: 20`, `sort_field: { field: 'revenue', type: 'DESC' }`, `need_image: 1`, `is_affiliate: 1`.<br>If `cateIds.length > 0`: sends `category_ids`, `cate_ids`, and (when length `=== 1`) `category_id`.<br>If `query` non-empty: sends `keyword`. | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** (No live `/rank` payload inspected; alternative sort fields, page sizes, and field coverage unconfirmed). |
| `/tiktok/product/detail` | `POST` | `20000ms` (search) / `14000ms` (enrich) | `POST /api/products/search` (`single_link`, `kalodata.ts:893-907`) and `POST /api/products/enrich` (`includeDetails: true`, `kalodata.ts:1119-1133`) | `region: 'TH'`, `language: 'en-US'`, `currency: 'THB'`, `date_range: 'last7Day'`, `product_id: cleanId`, `need_extra: true`, `need_image: 1`. | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** (Screenshot 3 shows rendered `7d Units Sold`, `7d Total/Video/Live Revenue` after detail fetch; raw JSON not captured). |
| `/tiktok/product/analysis` | `POST` | `18000ms` | `POST /api/products/enrich` (`includeSpecs: true`, `kalodata.ts:1163-1173`) | `product_id: cleanProductId`, `region: 'TH'`, `language: 'en-US'`. Parses `highlights` or `selling_points` (max 10). | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** (Screenshot 3 renders 5 `Selling Highlights` items). |
| `/tiktok/product/comment/insight` | `POST` | `22000ms` | `POST /api/products/enrich` (`includeComments: true`, `kalodata.ts:1214-1223`) | `product_id: cleanProductId`, `country_code: 'th'` (no `region`/`language`). Parses `pain_points` & `usage_scenarios` (max 6 each). | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** (Screenshot 3 renders 1 Thai `Buyer Pain Points` item). |

### 1.3 Request Flows, Pagination, Sorting, Affiliate Filter & Date Range
- **Product Rank vs. Detail Flow (`VERIFIED FROM SOURCE CODE`):**
  - `parseProductLinkInput(query)` (`kalodata.ts:166-224`, `productService.ts:455-540`) detects raw 12–24 digit IDs or `tiktok.com`/`kalodata.com` URLs. Valid ID -> `/tiktok/product/detail` (`single_link`); short links (`vt.tiktok.com` / `vm.tiktok.com`) without embedded ID -> `KALODATA_INVALID_LINK` (400); text/category queries -> `/tiktok/product/rank` (`rank`).
- **Pagination & Page-Size Limitations:**
  - `VERIFIED FROM SOURCE CODE`: `page_number: 1` and `page_size: 20` are hardcoded (`kalodata.ts:1003-1004`), and `productService.ts:529` slices `.slice(0, 20)`. No UI pagination or cursor exists.
  - `UNVERIFIED — REQUIRES LIVE API ACCESS`: Maximum supported `page_size`, pagination metadata (`total`), and whether larger pages incur extra credit cost.
- **Sorting Options:**
  - `VERIFIED FROM SOURCE CODE`: `sort_field: { field: 'revenue', type: 'DESC' }` is hardcoded in `kalodata.ts:808, 1005`. Dead types `SearchSortBy = 'revenue' | 'growth'` and `SearchDateRange = 'last7Day' | 'last30Day'` exist in `src/types.ts:4-5` with zero references elsewhere.
  - `UNVERIFIED — REQUIRES LIVE API ACCESS`: Which `sort_field.field` keys (e.g., `revenue_growth_rate`, `sales_volumn`, `video_revenue`, `commission_rate`, `creator_count`) are accepted by `/tiktok/product/rank`.
- **Affiliate Filtering:**
  - `VERIFIED FROM SOURCE CODE`: `/tiktok/product/rank` always sends `is_affiliate: 1` (`kalodata.ts:1007`); `/tiktok/product/detail` omits `is_affiliate` (`kalodata.ts:896-904, 1122-1130`).
  - `UNVERIFIED — REQUIRES LIVE API ACCESS`: Whether `is_affiliate: 1` strictly excludes `0%`/null-commission products or only flags affiliate-program eligibility.
- **Date Range:**
  - `VERIFIED FROM SOURCE CODE`: `'last7Day'` is hardcoded in all 4 product/category requests (`kalodata.ts:804, 900, 1002, 1126`) and parser (`kalodata.ts:401`); `/analysis` and `/comment/insight` send no `date_range`.
  - `UNVERIFIED — REQUIRES LIVE API ACCESS`: Support for `'last30Day'` or custom windows and whether all returned metrics on a row share the exact same aggregation window.

### 1.4 Credit Accounting, Caching, Forced Refresh, Retry & Error Handling (`VERIFIED FROM SOURCE CODE`)
- **Credit Guardrails & Post-Spend Accounting (`kalodata.ts:704-778`):**
  - Pre-spend (`checkGuardrailsBeforeSpend`): checks client-supplied `maxSpendRemaining >= estCost - 0.0001`, calls `GET /credit/balance`, and verifies `available - estCost >= minBalanceReserve - 0.0001`. If `fetchKalodataCreditBalance` fails with a non-`KALODATA_INVALID_KEY` error, `balanceBefore` stays `null` and reserve enforcement is bypassed (`kalodata.ts:727-731`).
  - Post-spend (`computePostSpendDiff`): calls `GET /credit/balance` a second time and calculates `actualCreditsUsed = Math.round((before - after) * 100) / 100`.
- **Cache vs. Forced Refresh (`kalodata.ts:148-156, 871-885, 976-990`, `src/App.tsx:892`):**
  - Server maintains an in-memory `searchCache` (10-minute TTL, max 40 rank entries) and `inFlightSearches` deduplication map.
  - **Cache Bypass:** `src/App.tsx:892` unconditionally passes `forceRefresh: true` on every `runProductSearch()` request, completely bypassing both `searchCache` and `inFlightSearches`.
- **Retry & Error Handling (`kalodata.ts:541-613, 1152-1261`):**
  - **Zero automatic HTTP retries** inside `kalodataRequest` (prevents accidental double-billing).
  - Maps `401`/`403` / `code === '501'` (`"the key..."`) -> `KALODATA_INVALID_KEY` (401); `402` / insufficient credit strings -> `KALODATA_INSUFFICIENT_CREDITS` (402); `429` / rate-limit strings -> `KALODATA_RATE_LIMITED` (429).
  - `enrichSingleKalodataProduct` (`kalodata.ts:1152, 1203, 1259`) silently catches sub-request errors on `/detail`, `/analysis`, and `/comment/insight`, making failed sub-calls indistinguishable from legitimately absent product data.

---

## 2. Verified Metric Dictionary

> **Guardrail (`docs/product-intelligence-v2-design-spec.md` & Phase 0 Rule 6):** TypeScript properties in `src/types.ts` and coalesced fallback keys in `server/kalodata.ts` prove **client expectations only**, never upstream field availability, meaning, or units.

| Metric | App Type & Parser Location (`VERIFIED FROM SOURCE CODE`) | Candidate Upstream Key(s) in `kalodata.ts` | Upstream Verification Status | Detailed Verification Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Revenue** | `kalodataMetrics.revenueThb7d: number \| null` (`kalodata.ts:387`), `KalodataRawProduct.revenueThb7d: number` (`kalodata.ts:375-380`) | `row.revenue` (`kalodata.ts:364`) | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** | **Code (`VERIFIED`):** Requests `currency: 'THB'`, `date_range: 'last7Day'`. If `row.revenue` is missing/negative, `KalodataRawProduct` synthesizes `Math.round(rawSalesVol * priceThb)` while `kalodataMetrics.revenueThb7d` stays `null`.<br>**Evidence (`PARTIAL`):** Screenshot 3 renders `7d Total Revenue: ฿1,780,423` alongside `13,853` units at `฿129` (`~฿128.52/unit`), consistent with 7d THB GMV for that item. Raw JSON key/currency metadata remain unconfirmed. |
| **Sales volume** | `kalodataMetrics.salesVolume7d: number \| null` (`kalodata.ts:386`), `KalodataRawProduct.salesVolume7d: number` (`kalodata.ts:374`) | `row.sales_volumn ?? row.sales_volume ?? row.sale_count ?? row.item_sold` (`kalodata.ts:361-363`) | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** | **Code (`VERIFIED`):** Rounded integer; `null`/negative coerced to `0` on `KalodataRawProduct`.<br>**Evidence (`PARTIAL`):** Screenshot 3 renders `7d Units Sold: 13,853`.<br>**Unverified:** Which of the 4 candidate keys Kalodata returns on `/rank` vs `/detail`, and whether counts represent paid vs net-of-refund orders. |
| **Video revenue** | `kalodataMetrics.videoRevenueThb7d: number \| null` (`kalodata.ts:389`), `KalodataRawProduct.videoRevenueThb7d: number` (`kalodata.ts:381-382`) | `row.video_revenue` (`kalodata.ts:365`) | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** | **Code (`VERIFIED`):** `null`/negative coerced to `0` on `KalodataRawProduct`.<br>**Evidence (`PARTIAL`):** Screenshot 3 renders `7d Video Revenue: ฿1,743,604` (`97.9%` of total revenue).<br>**Unverified:** Period alignment with `revenue` across all `/rank` items and whether `0` vs `null` is cleanly distinguished upstream. |
| **Live revenue** | `kalodataMetrics.liveRevenueThb7d: number \| null` (`kalodata.ts:390-391`) | `row.live_revenue` (`kalodata.ts:366`) | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** | **Code (`VERIFIED`):** Never passed to `RawKalodataMetrics` or V1 `scoreEngine.ts`.<br>**Evidence (`PARTIAL`):** Screenshot 3 renders `7d Live Revenue: ฿36,819` (`1,743,604 + 36,819 = 1,780,423`).<br>**Unverified:** General `/rank` population rate and period alignment. |
| **Revenue growth** | `kalodataMetrics.revenueGrowthRate: number \| null` (`kalodata.ts:392`), `KalodataRawProduct.revenueGrowthRate: number` (`kalodata.ts:383`) | `row.revenue_growth_rate` (`kalodata.ts:367`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** | **Code (`VERIFIED`):** `null` coerced to `0` on `KalodataRawProduct`; 2-dec rounded on `kalodataMetrics`. **Internal unit contradiction:** `scoreEngine.ts:95` assumes ratio (`> 0.2`), while `VideoStudioView.tsx:74` & `aiChatPromptBuilder.ts:6` assume `<= 3` is ratio (`*100`) and `> 3` is `%`.<br>**Evidence:** Not rendered in Screenshot 3 after `/detail` fetch (cause unverified without raw JSON). |
| **Creator count** | `kalodataMetrics.creatorCount: number \| null` (`kalodata.ts:393-394`) | `row.creator_count ?? row.affiliate_count ?? row.influencer_count` (`kalodata.ts:368-370`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** | **Code (`VERIFIED`):** Never passed to `RawKalodataMetrics` or V1 `scoreEngine.ts`.<br>**Evidence:** Not rendered in Screenshot 3 after `/detail` fetch.<br>**Unverified:** Exact upstream key, population rate on `/rank` vs `/detail`, and whether it counts lifetime affiliates, creators posting in period, or creators with >= 1 sale. |
| **Commission rate** | `ProductItem.commissionRate: number \| null` (`kalodata.ts:352-359`) | `row.commission_rate` (`kalodata.ts:352`) | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** | **Code (`VERIFIED`):** `parsePositiveOrNull` drops `0` to `null`; `0 < raw < 1` multiplies by `100` (conflating `0.5%` with `50%`); `>= 1` hard-capped at `60`.<br>**Evidence (`PARTIAL`):** Screenshot 2 renders `10%`.<br>**Unverified:** Raw upstream scale (decimal vs `%`) and open-affiliate vs targeted-plan semantics. |
| **Product price** | `ProductItem.priceThb: number \| null` (`kalodata.ts:345-350`) | `row.unit_price ?? row.avg_price ?? row.min_price ?? row.price` (`kalodata.ts:345-349`) | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** | **Code (`VERIFIED`):** `parseFiniteNumber` (`kalodata.ts:274`) strips `[^0-9.-]`, causing `"199-299"` or `"199.00-299.00"` to become `199` (silently truncating the upper bound) and rounding via `Math.round`. `<= 0` dropped to `null`.<br>**Evidence (`PARTIAL`):** Screenshot 2 renders `฿129` (consistent with `฿1,780,423 / 13,853 ≈ ฿128.52` in Screenshot 3). |
| **Rating** | `kalodataMetrics.rating: number \| null` (`kalodata.ts:395-398`) | `row.product_rating ?? row.rating` (`kalodata.ts:371`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** | **Code (`VERIFIED`):** Enforces `0 < rawRating <= 5`, 1-decimal rounded; `0` dropped to `null`; unused in V1 scoring.<br>**Evidence:** Not rendered in Screenshot 3 after `/detail` fetch.<br>**Unverified:** Upstream scale confirmation, `/rank` vs `/detail` availability, and unrated sentinel (`null` vs `0`). |
| **Review count** | `kalodataMetrics.reviewCount: number \| null` (`kalodata.ts:399-400`) | `row.review_count ?? row.comment_count` (`kalodata.ts:372`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** | **Code (`VERIFIED`):** Rounded non-negative integer; unused in V1 scoring.<br>**Evidence:** Not rendered in Screenshot 3 after `/detail` fetch.<br>**Unverified:** Upstream key (`review_count` vs `comment_count`), `/rank` vs `/detail` availability, and whether it represents cumulative PDP reviews vs 7d reviews vs video comments. |
| **Commission THB** | `ProductItem.commissionThb: number \| null` | Computed locally (`productService.ts:241, 387`) | **`NOT AVAILABLE` (upstream) / `VERIFIED FROM SOURCE CODE` (synthetic)** | Not fetched from Kalodata; derived as `Math.max(1, Math.round((priceThb * commissionRate) / 100))`. Synthetic `฿1` floor inflates sub-฿1 commissions. |
| **Category** | `ProductItem.category`, `categoryLabel`, `kalodataCategoryId` | `pri_cate_id`/`first_cate_id`/`category_id`, `pri_cate_name`/`category_name`/`categories[]` (`kalodata.ts:421-475`) | **`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`** | Screenshot 1 confirms `/tiktok/category/rank` returned 20 live TH L1 categories. Product-row category field presence on `/rank` vs `/detail` is unverified; missing hints fall back to `'home'` (`kalodata.ts:331`). |
| **Date range** | `kalodataMetrics.dateRange: string` | Hardcoded in parser (`kalodata.ts:401`) | **`VERIFIED FROM SOURCE CODE` (client) / `UNVERIFIED — REQUIRES LIVE API ACCESS` (upstream)** | Hardcoded to `'last7Day'`; does not validate upstream response period metadata. |
| **Timestamps** | None on `/rank` item; `deepInsights.fetchedAt` on enrich | Local clock `new Date().toISOString()` (`kalodata.ts:1107`, `productService.ts:290`) | **`NOT AVAILABLE` (upstream) / `VERIFIED FROM SOURCE CODE` (gap)** | No upstream snapshot timestamp is parsed; `/rank` products carry no `fetchedAt` timestamp at all. |

---

## 3. Observed Artifact Examples & Expected Envelope (Sensitive Data Removed)

### 3.1 Live Probe Status (`UNVERIFIED — REQUIRES LIVE API ACCESS`)
- **Live requests made:** `0`
- **Credits spent:** `0`
- **Blocker:** No `KALODATA_API_KEY` present in environment, `.env`, or running Express session (`GET /api/kalodata/status` -> `connected: false`). Raw Kalodata JSON response examples for `/tiktok/product/rank` and `/tiktok/product/detail` could **not** be captured without an active key.

### 3.2 Sanitized Historical UI Observations (`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`)
Derived solely from committed mobile screenshots in `public/assets/aistudio/` (no key values exposed; masked ID shown as in UI):

- **Artifact 1 — Balance & Live Category Sync (`Screenshot_2026-11-24-20-44-39...jpg`):**
  - Connected display: `6e84••••c12f (Main Key)`, balance `14.6 credits`.
  - Rendered 20 live TH L1 categories from `/tiktok/category/rank` (`Beauty & Personal Care`, `Womenswear & Underwear`, `Food & Beverages`, `Home Supplies`, `Phones & Electronics`, `Automotive & Motorcycle`, `Health`, `Menswear & Underwear`, `Sports & Outdoor`, `Home Improvement`, `Fashion Accessories`, `Pet Supplies`, `Baby & Maternity`, `Household Appliances`, `Luggage & Bags`, `Shoes`, `Tools & Hardware`, `Kitchenware`, `Textiles & Soft Furnishings`, `Furniture`).
- **Artifact 2 — Single Product Detail & Deep Enrichment Display (`Screenshot_2026-11-25-00-38-58...jpg` & `Screenshot_2026-11-25-02-04-14...jpg`):**
  ```json
  {
    "_evidence_type": "UI screenshot transcription (NOT raw Kalodata HTTP JSON)",
    "product_id": "173755248421",
    "rendered_price_thb": 129,
    "rendered_commission": "10% (฿13 per sale)",
    "rendered_deep_metrics": {
      "7d Units Sold": 13853,
      "7d Total Revenue": 1780423,
      "7d Video Revenue": 1743604,
      "7d Live Revenue": 36819,
      "7d Growth Rate": null,
      "Active Creators": null,
      "Rating / Review Count": null
    },
    "rendered_shop_name": "TikTok Shop TH",
    "rendered_selling_highlights": 5,
    "rendered_pain_points": 1,
    "rendered_seller_description": "Fetched — seller has not provided a text description on TikTok Shop."
  }
  ```
  - **Strict Interpretation Note:** `VideoStudioView.tsx:874-920` renders `revenueGrowthRate`, `creatorCount`, `rating`, and `reviewCount` whenever they are finite numbers. Their absence in Screenshot 3 shows those 4 fields resolved to `null` after that `/detail` run, **but does not prove** whether `/tiktok/product/rank` populates them or whether Kalodata returned them under unmapped field names.

### 3.3 Client-Expected Envelope Schema (`VERIFIED FROM SOURCE CODE` in `server/kalodata.ts:499-562, 685-702`)
```json
{
  "success": true,
  "data": "Array<Row> | { data|list|items|records: Row[] } | DetailObject"
}
```
```json
{
  "success": false,
  "code": "<string|number>",
  "message": "<string>"
}
```

---

## 4. Credit-Cost Observations

| Endpoint | Configured Estimate (`VERIFIED FROM SOURCE CODE`) | Observed Evidence / Status |
| :--- | :--- | :--- |
| `GET /credit/balance` | `0` assumed (not gated) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** (Called twice per billable search/sync/enrich in `kalodata.ts:725, 758`; actual credit cost / rate limit unverified). |
| `POST /tiktok/category/rank` | `0.2 cr` (`kalodata.ts:794`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** (Exact per-call deduction unverified in isolation). |
| `POST /tiktok/product/rank` | `0.2 cr` (`kalodata.ts:995`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** (Cost for `page_size: 20` vs `> 20` and non-revenue `sort_field`s unverified). |
| `POST /tiktok/product/detail` | `0.2 cr` (`kalodata.ts:890, 1089`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** |
| `POST /tiktok/product/analysis` | `0.5 cr` (`kalodata.ts:1090`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** |
| `POST /tiktok/product/comment/insight` | `1.0 cr` (`kalodata.ts:1091`) | **`UNVERIFIED — REQUIRES LIVE API ACCESS`** |

- **Session Balance Observation (`PARTIALLY VERIFIED FROM EXISTING EVIDENCE`):** Screenshots record balance `14.6 credits` at `20:44` (Screenshot 1) and `11.6 cr` at `02:04` (Screenshot 3) across category sync, product searches, and deep enrichment (`detail + specs + comments`). Per-endpoint cost attribution cannot be isolated from screenshots alone.
- **Phase 0 Spend:** `0` API calls made, `0` credits consumed.

---

## 5. Unresolved API Questions (`UNVERIFIED — REQUIRES LIVE API ACCESS`)

The following 8 upstream contract questions remain unresolved and **must be verified by live API probes before finalizing V2 parsers and retrieval**:

1. **Revenue and sales-volume units:** Does Kalodata always return `revenue` in exact requested `currency` (`THB`) without scaling (e.g., satang vs baht), which exact key (`sales_volumn`, `sales_volume`, `sale_count`, or `item_sold`) is canonical across `/rank` and `/detail`, and are units gross orders or net-of-returns?
2. **Revenue growth unit and comparison period:** Does `revenue_growth_rate` return a decimal ratio (`0.25` = `+25%`) or percentage (`25` = `+25%`), is the comparison always against the immediately preceding equal-length window (e.g., previous 7 days), and how are infinite/zero-baseline growths represented?
3. **Creator count definition:** Which field key (`creator_count`, `affiliate_count`, `influencer_count`, or another key) does Kalodata return, is it populated on `/tiktok/product/rank` vs `/tiktok/product/detail`, and does it mean lifetime affiliated creators, creators who posted content in `date_range`, or creators who generated >= 1 sale in `date_range`?
4. **Commission rate decimal versus percentage representation:** Does `commission_rate` return decimal (`0.15` for 15%), percentage (`15` for 15%), or string (`"15%"`), how are true `<1%` rates represented, and does it represent open-affiliate commission vs targeted/shop-plan max rate?
5. **Rating scale and review-count meaning:** Is `product_rating`/`rating` consistently on a `0–5` scale, is it populated on `/rank` vs `/detail`, how are unrated products encoded (`null` vs `0`), and does `review_count`/`comment_count` mean cumulative lifetime PDP reviews, period reviews, or video comments?
6. **Supported sorting fields:** Besides `{ field: 'revenue', type: 'DESC' }`, does `/tiktok/product/rank` support sorting by `sales_volumn`, `revenue_growth_rate`, `video_revenue`, `commission_rate`, or `creator_count`?
7. **Maximum supported page size:** What is the maximum `page_size` accepted by `/tiktok/product/rank` (`20`, `50`, `100`?), does pagination beyond `page_number: 1` return non-overlapping items, and is total row count exposed?
8. **Actual credit cost per endpoint:** What is the exact credit deduction (via before/after `/credit/balance` diff) for `/tiktok/product/rank` (`page_size=20` vs larger), `/tiktok/product/detail`, `/tiktok/category/rank`, `/tiktok/product/analysis`, `/tiktok/product/comment/insight`, and `/credit/balance`?

---

## 6. Compatibility Issues with Product Intelligence V2 (`VERIFIED FROM SOURCE CODE`)

Comparing the codebase against `docs/product-intelligence-v2-design-spec.md`:

1. **`null` Coerced to `0` (`server/kalodata.ts:374-383`):** Destroys Layer 1 distinction between `ZERO` and `MISSING` on `KalodataRawProduct` for `salesVolume7d`, `revenueThb7d`, `videoRevenueThb7d`, and `revenueGrowthRate`.
2. **Valid `0` Dropped to `null` (`server/kalodata.ts:352, 396`):** `0%` commission (`parsePositiveOrNull`) and `0` rating (`rawRating > 0`) become `null`, breaking V2's `ZERO` vs `MISSING` and `NOT_MONETIZABLE` gate.
3. **Unmarked Synthetic Revenue (`server/kalodata.ts:375-380`):** Synthesizes `salesVol * priceThb` on `KalodataRawProduct.revenueThb7d` while keeping `kalodataMetrics.revenueThb7d = null`, violating Layer 1 & Layer 2.1 provenance rules.
4. **Ambiguous `<1` Commission Heuristic & `60%` Cap (`server/kalodata.ts:354-359`):** Multiplies any `0 < raw < 1` by `100`, risking 100x inflation of genuine sub-1% rates, and truncates above `60%`.
5. **Synthetic `฿1` Commission Floor (`server/productService.ts:241, 387`):** `Math.max(1, ...)` violates V2 Rule 2.2 / Acceptance Test #16 (forces `฿0.58` -> `฿1`).
6. **Price-Range Truncation (`server/kalodata.ts:274`):** `replace(/[^0-9.-]/g, '')` + `parseFloat` silently turns `"199-299"` or `"199.00-299.00"` into `199`, violating Layer 1 Rule #6 / Acceptance Test #7.
7. **Growth Unit Contradiction (`server/scoreEngine.ts:95` vs `VideoStudioView.tsx:74` & `aiChatPromptBuilder.ts:6`):** Scorer vs UI apply incompatible thresholds (`> 0.2` vs `<= 3 ? *100 : raw`).
8. **Unused Commercial Metrics & Sparse `/detail` Evidence (`server/scoreEngine.ts:13-24`, Screenshot 3):** `creatorCount`, `liveRevenueThb7d`, `rating`, and `reviewCount` are omitted from `RawKalodataMetrics`. Moreover, Screenshot 3 suggests `/detail` may omit `creatorCount`/`rating`/`reviewCount` on at least some items, creating high `INSUFFICIENT_DATA` risk for Strategies 1, 2, 3, and 7 if `/rank` also omits them.
9. **Timestamp-Blind Metric Merging & Missing `/rank` `fetchedAt` (`server/kalodata.ts:385-402`, `src/lib/storage.ts:364-380, 567`):** `mergeKalodataMetrics` mixes fields across different fetch times using `??` without per-metric timestamps, violating Layer 1 Rules #7–#8.
10. **Stale `ai_explanations_v1` Override & No Re-Score on Enrich (`src/lib/storage.ts:582`, `src/App.tsx:1085-1091`):** Old cached `scoreBreakdown` overwrites fresh scores; updating `kalodataMetrics` in Studio does not recompute scores (violates Acceptance Test #19).
11. **Unconditional `forceRefresh: true` (`src/App.tsx:892`):** Bypasses the 10-minute server `searchCache` and `inFlightSearches` deduplication, contradicting Design Spec Section 5 Rule #2.
12. **Top-20 `revenue DESC` Selection Bias (`server/kalodata.ts:1003-1005`):** Restricting retrieval to top 20 by revenue excludes emerging low-creator/underserved products outside top-20 GMV.

---

## 7. Recommendations for Phase 1 (and Pre-Phase-1 Gate)

1. **Pre-Phase-1 Gate — Execute Budgeted Live Probe When API Key Is Available (`0.2–0.4 cr`):**
   - Configure `KALODATA_API_KEY` via secure session/runtime secret (never commit keys).
   - Execute at most **2 targeted requests**:
     1. `POST /tiktok/product/rank` (`region: 'TH'`, `currency: 'THB'`, `date_range: 'last7Day'`, `page_number: 1`, `page_size: 20`, `sort_field: { field: 'revenue', type: 'DESC' }`, `is_affiliate: 1`).
     2. `POST /tiktok/product/detail` for one `product_id` returned by Probe 1 (`need_extra: true`, `need_image: 1`, `date_range: 'last7Day'`).
   - Save redacted raw JSON fixtures and `/credit/balance` before/after diffs to resolve all 8 questions in Section 5 before finalizing growth/commission unit math or multi-pass retrieval.
2. **Phase 1 Work Safe Immediately (No Upstream Guesswork Required):**
   - Implement Layer 1 `ValidatedMetric<T>` (`OK | ZERO | MISSING | UNAVAILABLE | INVALID | STALE`, `provenance: 'SOURCE' | 'SYNTHETIC'`, `fetchedAt`, `dateRange`) additively alongside legacy `scoreBreakdown`.
   - Preserve `0%` commission and `0` rating as `ZERO` instead of `null`; preserve `null` metrics as `MISSING` instead of `0`.
   - Remove unmarked synthetic `salesVol * priceThb` revenue fallback and `Math.max(1, ...)` `฿1` commission floor.
   - Parse price ranges explicitly (`minPrice`, `maxPrice`, note) instead of stripping delimiters.
   - Add `fetchedAt` to `/rank` metrics, replace timestamp-blind `mergeKalodataMetrics` field blending with coherent snapshot replacement, stop stale `ai_explanations_v1` score overrides, and fix `App.tsx` `forceRefresh: true` so the 10-minute server cache works for repeated identical searches.
3. **Keep Disabled Until Live Probe Resolves Units & Coverage:**
   - Exclude `revenueGrowthRate` from numeric Demand scoring and keep Strategies 4 (`Fast Rising Products`) & 8 (`Trend Timing Opportunity`) blocked.
   - Do not modify `page_size`, `sort_field`, or multi-pass retrieval until upstream support and credit cost are empirically verified.

---

## 8. Phase 0 Exit Checklist

| Phase 0 Verification Item | Status | Evidence / Blocker |
| :--- | :--- | :--- |
| Audit all Kalodata endpoints, headers, timeouts, and payloads in codebase | **VERIFIED FROM SOURCE CODE** | `server/kalodata.ts:84, 496-1277`, `server.ts:191-357` |
| Audit request routing (`rank` vs `detail`), pagination, sorting, `is_affiliate`, `date_range` | **VERIFIED FROM SOURCE CODE** | `server/kalodata.ts:166-224, 893-1027`, `server/productService.ts:448-541`, `src/types.ts:4-5` |
| Audit credit guardrails, balance diff, cache TTL, `forceRefresh: true`, retries & error mapping | **VERIFIED FROM SOURCE CODE** | `server/kalodata.ts:148-156, 541-778`, `src/App.tsx:892` |
| Inventory parser defects, coercions, synthetic values & hydration bugs | **VERIFIED FROM SOURCE CODE** | `server/kalodata.ts:271-494`, `server/productService.ts:237-256`, `src/lib/storage.ts:364-585` |
| Cross-check prior session UI screenshots for rendered category/product outputs | **PARTIALLY VERIFIED FROM EXISTING EVIDENCE** | `public/assets/aistudio/Screenshot_2026-11-24-20-44-39...jpg`, `...00-38-58...jpg`, `...02-04-14...jpg` |
| Capture live `/tiktok/product/rank` & `/tiktok/product/detail` raw JSON payloads (`0.2–0.4 cr`) | **BLOCKED — UNVERIFIED — REQUIRES LIVE API ACCESS** | Missing `KALODATA_API_KEY` (`0` requests made, `0` credits consumed) |
| Verify exact upstream units/meanings (`revenue`, `sales_volumn`, `revenue_growth_rate`, `commission_rate`, `creator_count`, `rating`, `review_count`) | **BLOCKED — UNVERIFIED — REQUIRES LIVE API ACCESS** | Requires live `/rank` + `/detail` JSON responses for the same product(s) |
| Verify `/tiktok/product/rank` alternative `sort_field` support, max `page_size`, and exact endpoint credit costs | **BLOCKED — UNVERIFIED — REQUIRES LIVE API ACCESS** | Requires live probe + `/credit/balance` before/after measurements |
