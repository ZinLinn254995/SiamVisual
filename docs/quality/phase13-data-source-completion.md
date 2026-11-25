# SiamVisual — Phase 13: Data Source Completion & Verification

**Date:** 2026-11-25  
**Repository:** `ZinLinn254995/SiamVisual`  
**Phase Type:** Data Source Investigation & Verification (Zero-Credit Audit — No Scoring Formula, Weight, Threshold, Eligibility Gate, or Ranking Changes)  
**Kalodata API Requests Executed in Phase 13:** **`0`**  
**Kalodata Credits Consumed in Phase 13:** **`0.00 credits`** (Remaining account balance preserved at **`8.70 credits`** from Phase 11)

---

## 1. Phase 12 Baseline & Direct File Audit

All Phase 0–12 source modules, tests, and prior live capture logs were inspected directly before writing this report (without trusting prior summaries blindly):

- **Core Modules Verified Directly:**
  - `src/lib/dataIntelligence.ts` — Six-state data intelligence taxonomy (`VERIFIED`, `DERIVED`, `UNVERIFIED`, `MISSING`, `UNAVAILABLE`, `INVALID`, `STALE`) plus deterministic fallback assessors (`assessCompetitionIntelligence`, `assessCustomerQualityIntelligence`, `auditProductDataIntelligence`).
  - `src/lib/scoringEngineV2.ts` — 4-dimension Commercial Opportunity V2 engine (Demand, Earning, Competition, Customer Quality), independent Conversion Evidence and Data Confidence, strict `isUsableScoringMetric` + unverified-semantic note guards, Gate 2 (`>= 3` verified dimensions required for composite score), and hard `NOT_MONETIZABLE` gate on `0%` commission.
  - `src/lib/productIntelligenceView.ts` — Provenance classification (`classifyMetricProvenance`) accurately distinguishing `unavailable` (`rating` on tested Kalodata endpoints) and `missing` (`/rank` absent fields) from `unverified` (`/detail` `creator_number`, `/detail` `product_review_count`, `/rank` `revenue_growth_rate`).
  - `src/lib/snapshotStore.ts` & `src/lib/storage.ts` — Local UTC-day append-only observation store (`LOCAL_OBSERVED` vs `IMPORTED_UNVERIFIED` trust boundary, per-metric observation timestamps, strict quarantine of `UNVERIFIED` creator counts and `SYNTHETIC` revenue).
  - `server/kalodata.ts` & `server.ts` — Kalodata Open Center v1 client (`https://www.kalodata.com/openapi/v1`, headers `secret-key` + `source-type: SKILL`), backend secret precedence (`process.env.KALODATA_API_KEY`), zero client key exposure, 10-minute search cache, 30-minute per-layer enrichment cache, and pre-spend credit guardrails.
- **Automated Baseline Entering Phase 13:** `14` test suites, `114 / 114` tests passing, `tsc --noEmit` (`0` errors), Vite production build clean.
- **Direct-Inspection Corrections to Phase 12 Report (Evidence-First Audit):**
  Direct re-reading of `docs/quality/kalodata-api-contract-verification.md` (Phase 0 live capture), `docs/quality/phase9-real-product-validation.md`, and `docs/quality/phase11-live-discovery-historical-validation.md` caught four factual inaccuracies in the Phase 12 summary table that are corrected in this report:
  1. **`POST /tiktok/product/rank` verified cost is `0.20 credits`** (proven live in Phase 0: `10.30 -> 10.10`, Phase 9: `0.20 cr`, and Phase 11: `9.10 -> 8.90`), **not** `0.10 cr`.
  2. **`video_revenue`, `live_revenue`, and `shopping_mall_revenue` ARE returned on `POST /tiktok/product/detail`** (proven live in Phase 0 capture for `1731661332013680750`: exact match to `/rank`'s `video_revenue`, `live_revenue`, and `showcase_revenue`), not absent on `/detail`.
  3. **Three additional live `/detail` fields already observed in Phase 0** were previously omitted from the Phase 12 matrix: `video_number` (`4548`), `live_number` (`2859`), and `revenue_trend` (`[array len=7]`).
  4. **Exact captured Product IDs** from Phase 0 / 9 / 11 are `1731299385569545105` (Solomon Mattress: `creator_number: 343`, `product_review_count: 59,540`), `1731661332013680750` (INZENT Vit C [A3]: `creator_number: 1,824`, `product_review_count: 44,372`, `video_number: 4,548`, `live_number: 2,859`), and `1732462917435950190` (INZENT Vit C + Gluta [A10]: `creator_number: 1,028`, `product_review_count: 19,236`).

---

## 2. Endpoints Investigated (Zero-Credit Investigation)

Base URL verified in `server/kalodata.ts`: `https://www.kalodata.com/openapi/v1` (headers: `Content-Type: application/json;charset=UTF-8`, `secret-key`, `source-type: SKILL`).

| Endpoint Path | HTTP Method | Integrated in `server/kalodata.ts`? | Live Probed in Phases 0–11? | Verified Credit Cost | Key Parameters Investigated |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `/credit/balance` | `GET` | Yes (`L812`) | **Yes** (Phases 0, 9, 11) | **`0.00 cr`** (Live-Verified) | None |
| `/tiktok/product/rank` | `POST` | Yes (`L1224`) | **Yes** (Phases 0, 9, 11) | **`0.20 cr`** (`page_size: 20`, Live-Verified) | `region: 'TH'`, `currency: 'THB'`, `date_range: 'last7Day'`, `page_number`, `page_size`, `sort_field`, `is_affiliate: 1`, `need_image: 1`, `cate_ids`/`category_ids`, `keyword` |
| `/tiktok/product/detail` | `POST` | Yes (`L1086`, `L1360`) | **Yes** (Phases 0, 9, 11) | **`0.20 cr`** (`need_extra: true`, Live-Verified) | `region: 'TH'`, `language: 'en-US'`, `currency: 'THB'`, `date_range: 'last7Day'`, `product_id`, `need_extra: true`, `need_image: 1` |
| `/tiktok/category/rank` | `POST` | Yes (`L990`) | **No** | **`UNKNOWN`** *(code guardrail estimates `0.2`, unverified)* | `region`, `language`, `currency`, `date_range`, `category_level`, `page_number`, `page_size`, `sort_field` |
| `/tiktok/product/analysis` | `POST` | Yes (`L1436`) | **No** | **`UNKNOWN`** *(code guardrail estimates `0.5`, unverified)* | `product_id`, `region: 'TH'`, `language: 'en-US'` |
| `/tiktok/product/comment/insight` | `POST` | Yes (`L1516`) | **No** | **`UNKNOWN`** *(code guardrail estimates `1.0`, unverified)* | `product_id`, `country_code: 'th'` *(note param naming differs from `region: 'TH'` — unverified live)* |
| `/tiktok/product/comments` | `POST` | No | **No** | **`UNKNOWN`** | Referenced in third-party summaries for reviews/ratings; **existence, exact path, request schema, and return of aggregate star rating on OpenAPI v1 are UNCONFIRMED** |
| `/tiktok/creator/rank` | `POST` | No | **No** | **`UNKNOWN`** | Public docs describe global/category creator ranking (`region`, `date_range`, `sort_field`); **whether `product_id` filtering is supported is UNCONFIRMED** |
| `/tiktok/creator/detail` | `POST` | No | **No** | **`UNKNOWN`** | Creator-level profile & sales metrics (`creator_id`); not a product-level creator list |
| `/tiktok/product/creator` *(candidate name)* | `POST` | No | **No** | **`UNKNOWN`** | Mentioned in secondary web summaries for product-to-creator lookup; **exact OpenAPI v1 route path, availability, schema, and cost are UNCONFIRMED** |
| `/tiktok/video/rank` | `POST` | No | **No** | **`UNKNOWN`** | Video ranking module; **whether `product_id` filtering returns per-video creator IDs & attributed video revenue is UNCONFIRMED** |
| `/tiktok/livestream/rank` | `POST` | No | **No** | **`UNKNOWN`** | Livestream ranking module; **product-level filtering UNCONFIRMED** |

---

## 3. Creator Intelligence Findings

### 3.1 Investigation Summary
Can SiamVisual reliably calculate **Creator Competition** (active creators in window, selling creators, creator-level revenue, Revenue per Creator, or creator revenue concentration) today from verified evidence? **NO.**

- **On `/tiktok/product/rank` (`20/20` live Thailand rows):** Zero creator fields are returned (`0/20`).
- **On `/tiktok/product/detail` (`need_extra: true`, 3 live Thailand products captured across Phases 0, 9, 11):**
  - `creator_number` IS returned (`1,824` on `1731661332013680750`; `343` on `1731299385569545105`; `1,028` on `1732462917435950190`), alongside `video_number` (`4,548`) and `live_number` (`2,859`).
  - **Critical Semantic Blocker:** Neither Kalodata's public documentation nor our single-window (`last7Day`) live captures prove whether `creator_number` represents:
    1. Creators who posted at least one tagged video/live for the product during `date_range` (`last7Day`),
    2. Only creators who generated `>= 1` attributed sale during `date_range`, or
    3. Cumulative/lifetime creators who have ever promoted the product.
  - Because `adjustedRpcThb = revenueThb7d / (creatorCount + 5)` requires the numerator (`last7Day` revenue) and denominator (`creatorCount`) to share a verified, matching time window and definition, treating `creator_number` as active selling creators would risk catastrophic RPC distortion.
- **On `/tiktok/creator/rank`, `/tiktok/product/creator`, and `/tiktok/video/rank`:**
  - Public Kalodata Open API overviews confirm a `Creator` module (`/tiktok/creator/rank`, `/tiktok/creator/detail`) and a `Video` module (`/tiktok/video/rank`).
  - However, **no primary Kalodata Open Center v1 OpenAPI schema is publicly accessible without authenticated Open Center docs**, so it is **UNCONFIRMED** whether `/tiktok/creator/rank` accepts a `product_id` filter returning product-specific selling creators + per-creator product GMV (which would enable true active selling creator count, true RPC, and Top-1/Top-5 creator revenue concentration), or whether a dedicated `/tiktok/product/creator` route exists on v1.

### 3.2 Candidate Creator Fields & Endpoints Audit Table

| Candidate Signal / Field | Exact Endpoint | Request Parameters | Response Field | Data Type & Unit | Time-Window Semantics | Product-Specific? | Active vs. Selling Creators? | Verification Status | API Credit Cost | Safe for Competition Scoring? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| Product creator count | `POST /tiktok/product/detail` | `region: 'TH'`, `currency: 'THB'`, `date_range: 'last7Day'`, `product_id`, `need_extra: true` | `creator_number` | Integer (`COUNT` unconfirmed scope) | **UNCONFIRMED** (`last7Day` vs lifetime unproven) | **Yes** | **UNCONFIRMED** (posting vs selling vs lifetime unknown) | **`UNVERIFIED`** | **`0.20 cr`** (Live-Verified) | **NO** (quarantined) |
| Product video count | `POST /tiktok/product/detail` | Same as above | `video_number` | Integer (raw count) | **UNCONFIRMED** (`last7Day` vs lifetime unproven) | **Yes** | Neither — counts videos, not distinct creators | **`UNVERIFIED`** | Included in `/detail` (`0.20 cr`) | **NO** |
| Product live session count | `POST /tiktok/product/detail` | Same as above | `live_number` | Integer (raw count) | **UNCONFIRMED** | **Yes** | Neither — counts livestreams, not creators | **`UNVERIFIED`** | Included in `/detail` (`0.20 cr`) | **NO** |
| Creator count on Rank | `POST /tiktok/product/rank` | `region: 'TH'`, `currency: 'THB'`, `date_range: 'last7Day'`, `page_size: 20`, `is_affiliate: 1` | *(absent in 20/20 rows)* | N/A | N/A | N/A | N/A | **`UNAVAILABLE`** | `0.20 cr` | **NO** |
| Product-filtered creator ranking / per-creator revenue | `POST /tiktok/creator/rank` *(candidate)* | `region`, `currency`, `date_range`, `product_id` *(filter support UNCONFIRMED)* | Unconfirmed (`creator_id`, `revenue`, `sales_volumn`?) | Unconfirmed | Unconfirmed | **UNCONFIRMED** | **UNCONFIRMED** | **`UNVERIFIED`** | **`UNKNOWN`** | **NO** |
| Product-to-creator breakdown | `POST /tiktok/product/creator` *(candidate path)* | Unconfirmed (`product_id`, `region`, `date_range`?) | Unconfirmed | Unconfirmed | Unconfirmed | **UNCONFIRMED** (endpoint existence itself unconfirmed on v1) | **UNCONFIRMED** | **`UNAVAILABLE`** *(unconfirmed endpoint)* | **`UNKNOWN`** | **NO** |
| Product-filtered video creators / video revenue concentration | `POST /tiktok/video/rank` *(candidate)* | `region`, `date_range`, `product_id` *(filter support UNCONFIRMED)* | Unconfirmed (`creator_id`, `revenue`, `views`?) | Unconfirmed | Unconfirmed | **UNCONFIRMED** | **UNCONFIRMED** | **`UNVERIFIED`** | **`UNKNOWN`** | **NO** |
| Revenue per Creator (RPC) & Creator Concentration (Top-1 / Top-5 share) | Derived from verified `revenue` + verified active creators / per-creator GMV | N/A (derived) | N/A | `THB / creator` & `RATIO` | Requires matching verified window | Yes (when inputs verified) | Depends on verified creator input | **`UNAVAILABLE`** *(upstream inputs unverified/missing)* | N/A | **NO** (withheld) |

---

## 4. Customer Quality Findings

Can SiamVisual reliably calculate **Customer Quality** (verified star rating + verified review depth) today? **NO.**

### 4.1 Explicit Investigation of Rating, Reviews & Comments Endpoints

1. **Product Star Rating (`rating` / `product_rating`):**
   - **Live Verified Absence on Tested Endpoints:** Returned on **`0 / 20`** rows of `POST /tiktok/product/rank` and **`0 / 3`** live products on `POST /tiktok/product/detail` (even with `need_extra: true`).
   - **`POST /tiktok/product/comments` Investigation:** Third-party summaries reference `/tiktok/product/comments` as a review/comment retrieval route, distinct from `/tiktok/product/comment/insight`. However, **no primary Kalodata Open Center v1 schema confirms** whether `/tiktok/product/comments` is an active OpenAPI v1 endpoint, whether it returns an aggregate product average star rating (`0–5`), whether it returns star rating distributions (`1★–5★`), or its credit cost (`UNKNOWN`).
   - **`POST /tiktok/product/comment/insight` Investigation:** Already referenced in `server/kalodata.ts:1516` (`{ product_id, country_code: 'th' }`), never probed live (cost **`UNKNOWN`**; code guardrail estimates `1.0 cr`). Even if probed, its documented/coded payload (`pain_points`, `usage_scenarios`) is **qualitative text insight**, NOT an aggregate star rating, star distribution, or verified refund/return rate. Qualitative pain points **must never** be substituted for numeric product ratings.
2. **Product Review Count (`product_review_count`):**
   - **Absent** on `/tiktok/product/rank` (`0/20`).
   - **Present** on `/tiktok/product/detail` (`need_extra: true`): `59,540` (Solomon Mattress, vs. `3,257` 7d sales), `44,372` (INZENT [A3], vs. `61,846` 7d sales), `19,236` (INZENT [A10], vs. `29,324` 7d sales).
   - **Cumulative vs. Time-Window Scope:** The magnitude (`59,540` reviews on a mattress selling `3,257` units in 7 days) strongly points to cumulative lifetime TikTok Shop PDP review count rather than 7-day incremental reviews, **but this remains `UNVERIFIED`** without an official field definition or a `last7Day` vs. `last30Day` live comparison probe.
3. **Product Attribution & Stability:**
   - `product_review_count` on `/detail` is strictly keyed to the exact `product_id`, whereas `/tiktok/product/comments` and `/tiktok/product/comment/insight` have not been live-tested for attribution accuracy, pagination bias, or rating completeness.
4. **Policy Enforcement:**
   - `rating` MUST remain `state: 'UNAVAILABLE'`, `value: null`, classified as `'unavailable'`.
   - `product_review_count` MUST remain `unit: 'UNVERIFIED'`, excluded from `scoreCustomerQualityDimension`.
   - Customer Quality MUST remain `INSUFFICIENT_DATA` (`score: null`), never substituting pain points, descriptions, sales volume, or `0` for missing ratings.

---

## 5. Revenue Growth Verification Findings

Can SiamVisual reliably interpret **`revenue_growth_rate`** as a verified period-over-period growth rate today? **NO** (unit is verified, comparison period and edge cases are **UNVERIFIED**).

1. **`revenue_growth_rate` on `POST /tiktok/product/rank`:**
   - Returned on **`20 / 20`** live Thailand rows (e.g., `+17.75`, `+41.11`, `+897.79`, `-11.76`, `-44.25`, `-67.47`), confirming percentage-point scale (`PERCENT`, **not** decimal ratios).
   - **Absent** on `POST /tiktok/product/detail` (`0/3` live products).
   - **Unverified Comparison Baseline:** No primary Kalodata OpenAPI v1 documentation or multi-day live reconciliation proves whether `date_range: 'last7Day'` compares against the immediately preceding 7 days (`[T-14, T-8]`), a 7-day moving baseline, or calendar weeks.
   - **Unverified Zero-Baseline Behavior:** None of the 20 top-revenue live products had `0` prior-period revenue, so how Kalodata encodes division-by-zero for newly launched products (`null`, `0`, `100`, `999.99`, or capped sentinel) is **`UNVERIFIED`**.
   - **`last7Day` vs. `last30Day` Availability:** `server/kalodata.ts` currently only queries `date_range: 'last7Day'`. While `last30Day` is referenced in Kalodata docs and SiamVisual's types (`SearchDateRange = 'last7Day' | 'last30Day'`), `last30Day` has **not been live-probed** to verify whether `revenue_growth_rate` is returned and how its baseline behaves.
2. **Historical Revenue Array (`revenue_trend`) on `POST /tiktok/product/detail` (Important Phase 13 Finding):**
   - Phase 0 live capture (`docs/quality/kalodata-api-contract-verification.md`, line 128) confirmed that `/tiktok/product/detail` (`date_range: 'last7Day'`) ALREADY returns a 7-element **`revenue_trend`** array!
   - `server/kalodata.ts` currently **ignores** `revenue_trend` (does not inspect or store it), and the Phase 0 log sanitized it as `"[array len=7]"` without recording the inner element schema (e.g., whether elements are raw daily THB numbers or `{ date, revenue }` objects, and whether they sum to `revenue`).
   - Inspecting the exact schema of `revenue_trend` (and comparing `last7Day` vs `last30Day`) during a single approved `/detail` probe is a **high-value, zero-extra-endpoint opportunity** for verifying within-window revenue trajectory!
3. **SiamVisual Local Historical Snapshots (`src/lib/snapshotStore.ts`):**
   - Local daily snapshots (`LOCAL_OBSERVED`) remain the **only** fully auditable, mathematically defined growth source SiamVisual controls directly (`DERIVED` delta across distinct UTC days with exact timestamps). Currently only **1 real UTC day** (`2026-11-25`) has been captured live; multi-day verified growth requires `>= 2–3` distinct UTC days of real captures.
4. **Safety Invariant Preserved:** Missing or unverified `revenue_growth_rate` is **never** converted into `0%` verified growth (`growthStatus` stays `'MISSING'` or `'UNVERIFIED'`, and verified growth boost remains `0`).

---

## 6. Source Reliability Matrix

Allowed status values only: `VERIFIED`, `DERIVED`, `UNVERIFIED`, `MISSING`, `UNAVAILABLE`, `INVALID`. Undocumented prices are strictly marked `UNKNOWN`.

| Signal | Candidate Endpoint | Verified? | Time Scope | Unit | Credit Cost | Scoring Eligibility |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Product Revenue (7d)** (`revenue`) | `POST /tiktok/product/rank` & `/tiktok/product/detail` | **`VERIFIED`** | `last7Day` (matches requested window) | `THB` (decimal float) | `0.20 cr` (`/rank` 20 rows) or `0.20 cr` (`/detail` 1 item) | **Eligible** — Demand Score V2 & RPC denominator *(gross vs net-of-refunds noted)* |
| **Sales Volume (7d)** (`sales_volumn`) | `POST /tiktok/product/rank` & `/tiktok/product/detail` | **`VERIFIED`** | `last7Day` | `COUNT` (integer units) | Included in `/rank` (`0.20 cr`) & `/detail` (`0.20 cr`) | **Eligible** — Demand Score V2 |
| **Realized Unit Price** (`unit_price`) | `POST /tiktok/product/rank` & `/tiktok/product/detail` | **`VERIFIED`** | `last7Day` | `THB` (decimal float) | Included in `/rank` & `/detail` | **Eligible** — Earning payout calculation |
| **Commission Rate (`0` & `1–100`)** (`commission_rate`) | `POST /tiktok/product/rank` & `/tiktok/product/detail` | **`VERIFIED`** *(unit scale; `0 < x < 1` stays `UNVERIFIED`)* | Current snapshot | `PERCENT` (percentage points) | Included in `/rank` & `/detail` | **Eligible** — Earning Score V2 & hard `NOT_MONETIZABLE` gate (`0%`) |
| **Est. Commission Payout / Sale** (`commissionThb`) | Computed (`priceThb * commissionRate / 100`) | **`DERIVED`** | Snapshot | `THB` (no artificial floor) | `0.00 cr` (local computation) | **Eligible** — Earning Score V2 (explicitly tagged `SYNTHETIC` / `DERIVED`) |
| **Video Revenue (7d)** (`video_revenue`) | `POST /tiktok/product/rank` & `/tiktok/product/detail` | **`VERIFIED`** | `last7Day` | `THB` (decimal float) | Included in `/rank` & `/detail` | **Conversion Evidence only** (never Commercial Opportunity) |
| **Live Revenue (7d)** (`live_revenue`) | `POST /tiktok/product/rank` & `/tiktok/product/detail` | **`VERIFIED`** | `last7Day` | `THB` (decimal float) | Included in `/rank` & `/detail` | **Conversion Evidence only** |
| **Showcase / Mall Revenue (7d)** (`showcase_revenue` / `shopping_mall_revenue`) | `POST /tiktok/product/rank` & `/tiktok/product/detail` | **`VERIFIED`** | `last7Day` | `THB` (decimal float) | Included in `/rank` & `/detail` | **Conversion Evidence & channel sum reconciliation** |
| **Video Revenue Share** (`video_revenue / revenue`) | Computed locally | **`DERIVED`** | `last7Day` | `RATIO` / `PERCENT` | `0.00 cr` | **Conversion Evidence & Preliminary Video Shortlist only** |
| **Creator Count (Rank)** | `POST /tiktok/product/rank` | **`UNAVAILABLE`** | N/A | N/A | `0.20 cr` | **Excluded** (`INSUFFICIENT`) |
| **Creator Count (Detail)** (`creator_number`) | `POST /tiktok/product/detail` (`need_extra: true`) | **`UNVERIFIED`** | Unconfirmed (`last7Day` vs lifetime) | Raw integer (unverified semantics) | `0.20 cr` / product | **Excluded** — Quarantined until active/selling window semantics verified |
| **Video / Live Count** (`video_number`, `live_number`) | `POST /tiktok/product/detail` (`need_extra: true`) | **`UNVERIFIED`** | Unconfirmed | Raw integer | Included in `/detail` (`0.20 cr`) | **Excluded** — Not distinct creator count |
| **Active / Selling Creators & Per-Creator GMV** | `POST /tiktok/creator/rank` or `/tiktok/product/creator` *(unconfirmed)* | **`UNVERIFIED`** | Unconfirmed | Unconfirmed | **`UNKNOWN`** | **Excluded** — Endpoint filter & schema unverified |
| **Revenue per Creator (RPC) & Creator Concentration** | Derived from verified `revenue` + verified creator metrics | **`UNAVAILABLE`** | Requires matching verified window | `THB / creator` & `RATIO` | `UNKNOWN` (depends on upstream endpoint) | **Excluded** — Upstream inputs unverified/missing |
| **Product Star Rating** | Absent on `/rank` & `/detail`; candidate `POST /tiktok/product/comments` | **`UNAVAILABLE`** | N/A on tested endpoints | `RATING_5` (unavailable) | **`UNKNOWN`** (`/comments` unprobed) | **Excluded** — Never fabricated or defaulted to `0` |
| **Review Count (Rank)** | `POST /tiktok/product/rank` | **`MISSING`** | N/A | N/A | `0.20 cr` | **Excluded** |
| **Review Count (Detail)** (`product_review_count`) | `POST /tiktok/product/detail` (`need_extra: true`) | **`UNVERIFIED`** | Likely cumulative lifetime (unconfirmed) | Raw integer | `0.20 cr` / product | **Excluded** — Quarantined; insufficient without verified rating & scope |
| **Review Sentiment / Pain Points** (`pain_points`, `usage_scenarios`) | `POST /tiktok/product/comment/insight` | **`UNVERIFIED`** | Unconfirmed | Qualitative text (`TEXT`) | **`UNKNOWN`** *(unprobed; code guardrail `1.0`)* | **Excluded from Scoring** — Creative/Video Studio context only |
| **Revenue Growth Rate** (`revenue_growth_rate`) | `POST /tiktok/product/rank` (absent on `/detail`) | **`UNVERIFIED`** *(unit verified; baseline & zero-base unverified)* | Unconfirmed comparison period | `PERCENT` | Included in `/rank` (`0.20 cr`) | **Excluded from Verified Growth Boost** (`growthStatus: 'UNVERIFIED'`) |
| **In-Window Daily Trend** (`revenue_trend`) | `POST /tiktok/product/detail` (`need_extra: true`) | **`UNVERIFIED`** | `len=7` observed on `last7Day`; schema uninspected | Unverified | Included in `/detail` (`0.20 cr`) | **Excluded** — Schema & date alignment unverified |
| **Multi-Day Local Snapshot Trend** | Client `snapshotStore` (`LOCAL_OBSERVED`) | **`DERIVED`** *(only 1 live day captured so far; engine verified)* | Multi-UTC-day (`>=2–3` days required) | `PERCENT` | `0.20 cr` / day of `/rank` | **Eligible ONLY once `>=2–3` genuine `LOCAL_OBSERVED` days exist** |
| **Invalid / Out-of-Range / Malformed Inputs** (e.g. `"199-299"`, `commission > 100`, `rating > 5`, negative counts, future timestamps) | Any endpoint / backup import | **`INVALID`** | Rejected | Rejected | N/A | **Strictly Blocked** |

### Evidence Supporting Every `VERIFIED` Row
- **`revenue`, `video_revenue`, `live_revenue`, `showcase_revenue` / `shopping_mall_revenue`:** Live-verified across `20/20` rows on `/rank` and `3/3` products on `/detail` (Phases 0, 9, 11). Exact additive identity confirmed on `1731661332013680750`: `7,989,690.74 (video) + 345,313.72 (live) + 222.87 (showcase/mall) = 8,335,227.33 (revenue)`, with `/rank` and `/detail` matching to `0.01 THB`.
- **`sales_volumn` & `unit_price`:** Live-verified across `20/20` rows on `/rank` and `3/3` on `/detail`. Exact multiplicative identity confirmed: `8,335,227.33 / 61,846 = 134.7739 ≈ unit_price (134.77)`.
- **`commission_rate` (`0` and `1–100`):** Live-verified percentage-point scale across `20/20` rows on `/rank` (`0`, `1`, `5`, `6`, `7`, `8`, `10`, `13`, `15`, `18`, `20`) and identical on `/detail` (`7`, `10`, `20`). Zero-commission listings (`0%` on AirPods 5, TD Ring 1g, iPad A16) observed live and strictly blocked.

---

## 7. API Cost and Credit Safety

### 7.1 Current Credit Ledger (Zero Credits Spent in Phase 13)
- **Starting Balance (end of Phase 11):** `8.70 credits`
- **Phase 12 Spend:** `0.00 credits` (`0` requests)
- **Phase 13 Spend:** **`0.00 credits`** (`0` requests)
- **Current Account Balance:** **`8.70 credits`** (preserved intact)
- **Secret Hygiene:** `KALODATA_API_KEY` remains strictly server-side (`process.env.KALODATA_API_KEY`); zero changes to secrets or key exposure paths.

### 7.2 Documented vs. `UNKNOWN` Endpoint Credit Costs
- **Live-Verified Costs:**
  - `GET /credit/balance`: **`0.00 cr`**
  - `POST /tiktok/product/rank` (`page_size: 20`): **`0.20 cr`**
  - `POST /tiktok/product/detail` (`need_extra: true`): **`0.20 cr`**
- **Undocumented / Unprobed Costs (`UNKNOWN` — Do NOT Assume):**
  - `POST /tiktok/category/rank`: **`UNKNOWN`**
  - `POST /tiktok/product/analysis`: **`UNKNOWN`**
  - `POST /tiktok/product/comment/insight`: **`UNKNOWN`**
  - `POST /tiktok/product/comments`: **`UNKNOWN`**
  - `POST /tiktok/creator/rank`: **`UNKNOWN`**
  - `POST /tiktok/product/creator`: **`UNKNOWN`**
  - `POST /tiktok/video/rank`: **`UNKNOWN`**

### 7.3 Prioritized Minimal Live Probes (For Future User Approval ONLY — NOT Executed)

All probes below require explicit user approval before running, and every probe MUST wrap the call with free `GET /credit/balance` before and after to record exact verified credit cost:

| Priority | Probe Name | Exact Request | Known / Expected Cost | Exact Question Answered |
| :---: | :--- | :--- | :--- | :--- |
| **P1** | **Detail `last30Day` vs `last7Day` Semantic Probe** | 1x `POST /tiktok/product/detail` on `1731299385569545105` (Solomon Mattress, already captured at `last7Day`: `creator_number: 343`, `product_review_count: 59,540`) with `date_range: 'last30Day'`, `need_extra: true`; **also inspect full `revenue_trend` element schema** | **`0.20 cr`** *(same endpoint as verified `last7Day` `/detail`; exact `last30Day` surcharge if any will be verified by balance diff)* | (1) Does `creator_number` scale between 7d and 30d (proving window-scoped vs lifetime)? (2) Does `product_review_count` stay identical (proving cumulative PDP count)? (3) What is the exact schema of `revenue_trend`? |
| **P2** | **Creator Competition Endpoint Discovery Probe** | 1x `POST /tiktok/creator/rank` (`region: 'TH'`, `currency: 'THB'`, `date_range: 'last7Day'`, `page_size: 5`, testing `product_id: '1731299385569545105'`) | **`UNKNOWN`** *(recommend checking Open Center docs first before calling!)* | Determines whether `/tiktok/creator/rank` supports `product_id` filtering, returns per-creator product revenue, and enables active selling creator count + concentration. |
| **P3** | **Product Rating / Comments Endpoint Probe** | 1x `POST /tiktok/product/comments` (only AFTER verifying exact OpenAPI v1 path in Kalodata Open Center docs) on `1731299385569545105` | **`UNKNOWN`** *(check Open Center docs first to avoid a 404 or high-cost surprise)* | Determines whether aggregate product star rating (`0–5`) and star distribution are available via Kalodata OpenAPI v1 and at what exact credit cost. |
| **P4** | **Growth Baseline Reconciliation (`last7Day` Rank + `revenue_trend` or 2-Day Capture)** | 1x `POST /tiktok/product/rank` (`date_range: 'last30Day'` OR 2 additional UTC-day `last7Day` `/rank` captures at `0.20 cr/day`) | **`0.20 cr` / call** (`0.40 cr` for 2 extra days) | (1) Verifies `last30Day` `/rank` growth behavior, AND (2) builds genuine 3-day `LOCAL_OBSERVED` snapshot series to unlock verified local `fast_rising_products` trends independent of Kalodata's unverified `revenue_growth_rate`. |

---

## 8. Integration Readiness Assessment

Strict readiness labels: `READY_FOR_INTEGRATION`, `READY_AFTER_LIVE_PROBE`, `DOCUMENTATION_REQUIRED`, `UNSUPPORTED`, `NOT_SAFE_FOR_SCORING`.

| Signal | Integration Readiness | Rationale |
| :--- | :--- | :--- |
| **Demand (`revenue`, `sales_volumn`)** | **`READY_FOR_INTEGRATION`** *(Already Integrated)* | Live-verified units & window across `/rank` and `/detail`; already safely powering Demand Score V2. |
| **Affiliate Earnings (`unit_price`, `commission_rate` `0` & `1–100`, derived `commissionThb`)** | **`READY_FOR_INTEGRATION`** *(Already Integrated)* | Live-verified percentage-point unit and THB scale; `0%` hard-blocked; `0 < x < 1` safely quarantined. |
| **Channel Conversion Evidence (`video_revenue`, `live_revenue`, `showcase_revenue` / `shopping_mall_revenue`)** | **`READY_FOR_INTEGRATION`** *(Already Integrated)* | Live-verified exact additive sum; strictly separated from Commercial Opportunity. |
| **Local Multi-Day Snapshot Trend (`snapshotStore.ts`)** | **`READY_FOR_INTEGRATION`** *(Engine Integrated; Needs Multi-Day Captures)* | Trust boundary (`LOCAL_OBSERVED` vs `IMPORTED_UNVERIFIED`) and per-metric timestamps verified; requires `>= 2–3` distinct UTC-day live captures. |
| **Detail `revenue_trend` (7-element array)** | **`READY_AFTER_LIVE_PROBE`** | Confirmed present on `/detail` (`len=7`) in Phase 0, but inner element schema (`number[]` vs `{ date, revenue }[]`) must be inspected in P1 before parsing. |
| **Detail `creator_number` (Competition)** | **`READY_AFTER_LIVE_PROBE`** *(plus Vendor Docs for Selling vs. Posting)* | P1 (`last7Day` vs `last30Day`) will test window scoping; **however, vendor docs or a per-creator endpoint are still required to distinguish active posting creators from selling creators (`>= 1` sale)**. Until then: `NOT_SAFE_FOR_SCORING`. |
| **Product-Filtered Creator List / Per-Creator GMV / Concentration (`/tiktok/creator/rank`, `/tiktok/product/creator`)** | **`DOCUMENTATION_REQUIRED`** | Exact OpenAPI v1 path, `product_id` filter support, schema, and credit cost are undocumented in public sources; check Kalodata Open Center docs before spending credits. |
| **Detail `video_number` & `live_number`** | **`NOT_SAFE_FOR_SCORING`** | Count content pieces rather than unique creators and lack verified window scope; cannot substitute for creator competition. |
| **Product Star Rating (`rating`)** | **`DOCUMENTATION_REQUIRED`** *(Currently `UNSUPPORTED` on `/rank` & `/detail`)* | Confirmed absent on `/rank` and `/detail` (`need_extra: true`). Whether `/tiktok/product/comments` exists on OpenAPI v1 and provides aggregate star rating requires official Open Center API docs first; otherwise `UNSUPPORTED`. |
| **Detail `product_review_count`** | **`NOT_SAFE_FOR_SCORING`** | Scope (cumulative vs. windowed) unverified, and review volume alone without verified star rating cannot measure customer quality. |
| **Comment Insights (`pain_points`, `usage_scenarios` via `/tiktok/product/comment/insight`)** | **`NOT_SAFE_FOR_SCORING`** | Qualitative text for Video Studio copy/angles only; never valid as a quantitative Customer Quality rating substitute. |
| **Upstream `revenue_growth_rate` (Rank)** | **`DOCUMENTATION_REQUIRED`** | Percentage-point unit is verified, but comparison baseline period and zero-baseline edge encoding are undocumented; must stay quarantined from verified Demand growth boosts until proven. |

---

## 9. Remaining Blockers

1. **No Public Primary Kalodata OpenAPI v1 Field Contract:** Public web pages list module names (`Category`, `Shop`, `Creator`, `Product`, `Video`, `Livestream`), but exact parameter schemas, field semantic definitions (`creator_number`, `revenue_growth_rate`, `product_review_count`), and per-endpoint credit pricing live inside the authenticated **Kalodata Open Center developer documentation** portal.
2. **Creator Competition Unverifiable Without Scope Proof:** `creator_number` on `/detail` cannot enter Competition scoring until (a) window-scoping (`last7Day` vs lifetime) and (b) activity definition (posting vs selling creators) are verified, or a per-product creator breakdown endpoint is verified.
3. **Customer Star Rating Unavailable on Integrated Endpoints:** Neither `/rank` nor `/detail` returns star ratings, keeping Customer Quality honestly `INSUFFICIENT_DATA` and Gate 2 (`>= 3` verified dimensions) blocking composite `commercialOpportunityScore` on live Kalodata rows.
4. **Upstream Growth Baseline Unconfirmed & Only 1 Live Snapshot Day Captured:** `revenue_growth_rate` remains quarantined, and local `snapshotStore` only has 1 real UTC day (`2026-11-25`) so far (`>= 2–3` days needed for verified local momentum).

---

## 10. Recommended Phase 14 Plan

1. **Step 1 — Authenticated Kalodata Open Center Docs Check (0 Credits):**
   Have the account holder export or share the official Kalodata Open Center v1 API documentation (endpoint list, parameters, field definitions, and credit table) for:
   - `POST /tiktok/product/detail` (`creator_number`, `product_review_count`, `revenue_trend`)
   - `POST /tiktok/product/rank` (`revenue_growth_rate` formula & zero-baseline rule)
   - Creator & Comment endpoints (`/tiktok/creator/rank`, any `/tiktok/product/creator*`, and `/tiktok/product/comments`)
2. **Step 2 — User-Approved Minimal Live Verification Probe (`P1`: `0.20 cr`):**
   With explicit user approval, run **Probe P1** (`POST /tiktok/product/detail` on `1731299385569545105` with `date_range: 'last30Day'`, wrapped in free `/credit/balance` checks) to empirically verify:
   - Whether `creator_number` changes between `last7Day` and `last30Day`,
   - Whether `product_review_count` is lifetime-invariant,
   - The exact structure and sum of `revenue_trend`.
3. **Step 3 — Conditional P2 / P3 Probes (Only After Docs Confirmation + User Approval):**
   Only call `/tiktok/creator/rank` (with `product_id` filter) or `/tiktok/product/comments` if Open Center docs confirm those exact v1 endpoints exist, support `product_id`, and have acceptable credit cost.
4. **Step 4 — Begin Controlled Multi-Day Local Snapshot Accumulation (`0.20 cr/day` for 2–3 additional UTC days):**
   Capture 2–3 additional UTC days of `TH / THB / last7Day` `/rank` snapshots into `snapshotStore` so SiamVisual achieves genuine, locally verified multi-day Demand & Video Revenue growth trajectories without relying on Kalodata's unverified `revenue_growth_rate`.
5. **Step 5 — Guarded Integration Only for Newly Verified Signals:**
   Only promote a metric from `UNVERIFIED` / `UNAVAILABLE` into verified V2 scoring if Phase 14 produces hard contract + live-probe proof; if Kalodata does not offer star rating on OpenAPI v1, formally mark `rating` as `UNSUPPORTED` on Kalodata and evaluate explicit, honest architectural options in a dedicated future phase (without ever fabricating ratings).
