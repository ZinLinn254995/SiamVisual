# Kalodata API Contract Verification Report (Phase 0 — Live Verification)

- **Document Path:** `docs/quality/kalodata-api-contract-verification.md`
- **Verification Date:** `2026-11-25`
- **Phase 0 Completion Status:** **CORE LIVE VERIFICATION COMPLETE** (Backend Secret runtime, `/credit/balance`, `/tiktok/product/rank`, `/tiktok/product/detail`, invalid-key handling, units, and exact credit costs verified live; unprobed endpoints and seller-side accounting semantics explicitly kept `UNVERIFIED`).
- **Scope Guardrail:** Strictly Phase 0 Live Verification + Backend Secret / Error Handling hardening. Zero changes made to Scoring Engine, UI, or Product Ranking.
- **Runtime Secret Configuration (`VERIFIED LIVE`):**
  - `server.ts` reads `process.env.KALODATA_API_KEY` securely from Google AI Studio Backend Secrets (`keySource: "env"`).
  - `process.env.KALODATA_API_KEY` takes strict precedence over UI session keys (`verifyAndConnectKalodataKey` refuses overriding an active Backend Secret with HTTP `409`).
  - Browser responses (`/api/kalodata/status`), logs, and error messages never expose raw or partial API key characters (`maskedKey: null`, `sanitizeKalodataErrorText`, fixed messages on auth/rate-limit/credit errors).
  - `vite.config.ts` does not inject `KALODATA_API_KEY` into any client bundle (`src/` has zero references to `KALODATA_API_KEY`).

---

## Live API Execution & Credit Usage Summary

| Metric | Recorded Value |
| :--- | :--- |
| **Total Live Kalodata Upstream Requests Executed** | **9 requests** (2 `/api/kalodata/status` balance checks + 7 probe calls: 5 valid `GET /credit/balance`, 1 invalid-key `GET /credit/balance`, 1 `POST /tiktok/product/rank`, 1 `POST /tiktok/product/detail`) |
| **Starting Credit Balance** | `10.30 credits` (`mainRemain: 10.3`, `accountType: main`) |
| **Ending Credit Balance** | `9.90 credits` (`mainRemain: 9.9`, `accountType: main`) |
| **Total Credits Consumed** | **`0.40 credits`** |

### Per-Endpoint Live Request & Credit Log

| # | Endpoint | Parameters / Purpose | Result | Balance Before -> After | Verified Credit Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `GET /credit/balance` | Pre-hardening `/api/kalodata/status` check | `200 OK` (`connected: true, keySource: "env"`) | `10.30 -> 10.30` | `0.00 cr` |
| 2 | `GET /credit/balance` | Post-hardening `/api/kalodata/status` check (`maskedKey: null`) | `200 OK` | `10.30 -> 10.30` | `0.00 cr` |
| 3 | `GET /credit/balance` | Probe initial balance snapshot | `200 OK` | `10.30 -> 10.30` | `0.00 cr` |
| 4 | `GET /credit/balance` | Back-to-back balance cost check | `200 OK` | `10.30 -> 10.30` | **`0.00 cr` (`VERIFIED LIVE`)** |
| 5 | `GET /credit/balance` | Invalid dummy key test (`secret-key` rejected) | `401 KALODATA_INVALID_KEY` (zero key echoed) | `10.30 -> 10.30` | **`0.00 cr` (`VERIFIED LIVE`)** |
| 6 | `POST /tiktok/product/rank` | `region: TH`, `currency: THB`, `date_range: last7Day`, `page_number: 1`, `page_size: 20`, `sort_field: { revenue, DESC }`, `need_image: 1`, `is_affiliate: 1` | `200 OK` (bare array of `20` rows) | `10.30 -> 10.10` | **`0.20 cr` (`VERIFIED LIVE`)** |
| 7 | `GET /credit/balance` | Post-`/rank` balance check | `200 OK` | `10.10` | `0.00 cr` |
| 8 | `POST /tiktok/product/detail` | `product_id: "1731661332013680750"`, `region: TH`, `currency: THB`, `date_range: last7Day`, `need_extra: true`, `need_image: 1` | `200 OK` (single detail object) | `10.10 -> 9.90` | **`0.20 cr` (`VERIFIED LIVE`)** |
| 9 | `GET /credit/balance` | Post-`/detail` balance check | `200 OK` | `9.90` | `0.00 cr` |

### Unprobed Endpoint Credit Costs (`UNVERIFIED`)

| Endpoint | Configured Estimate in Code | Status |
| :--- | :--- | :--- |
| `POST /tiktok/category/rank` | `0.2 cr` | **`UNVERIFIED`** (not called during this probe to conserve credits) |
| `POST /tiktok/product/analysis` | `0.5 cr` | **`UNVERIFIED`** (not called during this probe to conserve credits) |
| `POST /tiktok/product/comment/insight` | `1.0 cr` | **`UNVERIFIED`** (not called during this probe to conserve credits) |
| `POST /tiktok/product/rank` with `page_size > 20` or alternative `sort_field` | Unknown | **`UNVERIFIED`** (not called during this probe) |

---

## Verified Metric Dictionary & Field Semantics

Classification tiers used below:
- **`VERIFIED LIVE`**: Directly observed in live Kalodata JSON responses from this run.
- **`PARTIALLY VERIFIED LIVE`**: Key, type, and numeric scale observed live, while deeper business-accounting semantics remain unproven from API payloads alone.
- **`UNVERIFIED`**: Not present in tested responses or cannot be confirmed from a single snapshot.

| Metric | Live Key on `/tiktok/product/rank` (20 rows) | Live Key on `/tiktok/product/detail` (1 item) | Verified Unit & Data Type | Status & Exact Findings |
| :--- | :--- | :--- | :--- | :--- |
| **Revenue** | `revenue` (`20/20`, `number`)<br>e.g. `8335227.33` | `revenue` (`number`)<br>`8335227.33` | **Exact THB (decimal float, NOT satang)** | **`PARTIALLY VERIFIED LIVE`**: Matches identically across `/rank` and `/detail`. Exact channel sum verified: `video_revenue (7989690.74) + live_revenue (345313.72) + showcase_revenue/shopping_mall_revenue (222.87) = 8335227.33`. `revenue / sales_volumn = 134.7739 ≈ unit_price (134.77)`. Gross GMV vs. net-of-refunds remains **`UNVERIFIED`**. |
| **Video Revenue** | `video_revenue` (`20/20`, `number`)<br>e.g. `7989690.74` | `video_revenue` (`number`)<br>`7989690.74` | **Exact THB (decimal float)** | **`VERIFIED LIVE`** (values match identically between `/rank` and `/detail`, sums cleanly into `revenue`). |
| **Live Revenue** | `live_revenue` (`20/20`, `number`)<br>e.g. `345313.72` | `live_revenue` (`number`)<br>`345313.72` | **Exact THB (decimal float)** | **`VERIFIED LIVE`** (values match identically between `/rank` and `/detail`, sums cleanly into `revenue`). |
| **Showcase / Mall Revenue** | `showcase_revenue` (`20/20`, `number`)<br>e.g. `222.87` | `shopping_mall_revenue` (`number`)<br>`222.87` | **Exact THB (decimal float)** | **`VERIFIED LIVE`**: Note key rename between `/rank` (`showcase_revenue`) and `/detail` (`shopping_mall_revenue`) with identical value (`222.87`). |
| **Sales Volume** | `sales_volumn` (`20/20`, `number`)<br>e.g. `61846`, `19280`, `3257` | `sales_volumn` (`number`)<br>`61846` | **Integer unit count** | **`PARTIALLY VERIFIED LIVE`**: Canonical key on both endpoints is `sales_volumn` (Kalodata spelling). Matches identically across `/rank` and `/detail`. Gross orders vs. net-of-cancellations/returns remains **`UNVERIFIED`**. |
| **Product Price** | `unit_price` (`20/20`, `number`)<br>e.g. `134.77`, `427.23`, `2127.62` | `unit_price` (`134.77`), `min_price` (`144.55`), `max_price` (`144.55`) (`number`) | **Exact THB (decimal float)** | **`VERIFIED LIVE`**: `unit_price` equals realized average price (`revenue / sales_volumn`), while `/detail` additionally provides listing `min_price` and `max_price`. |
| **Commission Rate** | `commission_rate` (`20/20`, `number`)<br>e.g. `10`, `10`, `7`, `7`, `15` | `commission_rate` (`number`)<br>`10` | **Percentage points (`10` = `10%`, NOT `0.10`)** | **`PARTIALLY VERIFIED LIVE`**: Confirmed percentage-point scale (`10` = `10%`) on both `/rank` and `/detail`. Representation of `0%` or `<1%` rates (none appeared in top-20 `is_affiliate: 1`) and open-plan vs. targeted-plan semantics remain **`UNVERIFIED`**. |
| **Revenue Growth Rate** | `revenue_growth_rate` (`20/20`, `number`)<br>e.g. `-44.25`, `17.75`, `-11.76`, `-48.67`, `-41.27` | **NOT RETURNED** (absent on `/detail`) | **Percentage points (`17.75` = `+17.75%`, `-44.25` = `-44.25%`)** | **`PARTIALLY VERIFIED LIVE`**: Confirmed percentage-point scale on `/rank` (`20/20` rows) and confirmed **absent on `/detail`**. Exact comparison baseline period (presumed previous 7d vs. current 7d) and zero-baseline encoding remain **`UNVERIFIED`**. |
| **Creator Count** | **NOT RETURNED** (`0/20` rows on `/rank`) | **`creator_number`** (`number`)<br>`1824` (alongside `video_number: 4548`, `live_number: 2859`) | **Integer count** | **`PARTIALLY VERIFIED LIVE` (KEY MISMATCH DISCOVERED)**: Absent on `/rank`. Present on `/detail` under key **`creator_number`** (NOT `creator_count` / `affiliate_count` / `influencer_count`). Exact definition (creators posting in `last7Day` vs. creators with `>=1` sale vs. lifetime affiliates) remains **`UNVERIFIED`**. |
| **Review Count** | **NOT RETURNED** (`0/20` rows on `/rank`) | **`product_review_count`** (`number`)<br>`44372` | **Integer count** | **`PARTIALLY VERIFIED LIVE` (KEY MISMATCH DISCOVERED)**: Absent on `/rank`. Present on `/detail` under key **`product_review_count`** (NOT `review_count` / `comment_count`). Whether count is cumulative lifetime PDP reviews vs. window-scoped reviews remains **`UNVERIFIED`**. |
| **Product Rating** | **NOT RETURNED** (`0/20` rows on `/rank`) | **NOT RETURNED** (absent on `/detail` even with `need_extra: true`) | Unknown | **`UNVERIFIED` (ABSENT ON TESTED `/rank` & `/detail`)**: Neither `/rank` nor `/detail` returned `rating` or `product_rating`. Availability on other endpoints and unrated-item encoding remain **`UNVERIFIED`**. |
| **Category Fields** | `pri_category`, `sec_category`, `ter_category` (`20/20`, objects `{ category_id, category_name }`) | `pri_cate_id`, `sec_cate_id`, `ter_cate_id` (flat ID strings, no names) | String IDs + English names | **`VERIFIED LIVE` (KEY MISMATCH DISCOVERED)**: `/rank` returns nested `{ category_id, category_name }` objects (`pri_category`, `sec_category`, `ter_category`), whereas current `parseRawProductRow` only checked flat `pri_cate_id` / `pri_cate_name` / `categories[]`. |
| **Shop / Seller Fields** | `seller_id: null`, `seller_name: null`, `sku_count: null` (`0/20` non-null) | `product_shop_id` (string), `delivery_type: "local"`, `product_region: "th"` | String IDs | **`VERIFIED LIVE`**: Neither `/rank` nor `/detail` returned `shop_name` or populated `seller_name`. |
| **Trend & Launch Metadata** | `launch_date` (`20/20`, `YYYY-MM-DD` string) | `launch_date` (`YYYY-MM-DD`), `revenue_trend` (array length `7`), `product_description` (rich-text array) | Date string + 7-day array | **`VERIFIED LIVE`**: `/detail` returns a 7-element `revenue_trend` array (internal element schema not expanded further; period timestamps remain **`UNVERIFIED`**). |

---

## Sanitized Live Response Examples (Zero Secrets Included)

### 1. `/tiktok/product/rank` Envelope & Row #1 (Sanitized)
- `envelope.data` root type: **Bare JSON Array** (`length: 20`; no `total` or cursor pagination fields returned inside `data`).
```json
{
  "product_id": "1731661332013680750",
  "product_name": "[1แถม2] วิตามินซี อเซโรล่า เชอร์รี่ Vitamin C ACEROLA CHERRY ตรา inzent [A3]",
  "revenue": 8335227.33,
  "commission_rate": 10,
  "revenue_growth_rate": -44.25,
  "sales_volumn": 61846,
  "unit_price": 134.77,
  "live_revenue": 345313.72,
  "video_revenue": 7989690.74,
  "showcase_revenue": 222.87,
  "launch_date": "2025-01-21",
  "master_image_url": "https://p16-oec-sg.ibyteimg.com/...",
  "seller_id": null,
  "seller_name": null,
  "sku_count": null,
  "pri_category": { "category_id": "700645", "category_name": "Health" },
  "sec_category": { "category_id": "700646", "category_name": "Nutrition & Wellness" },
  "ter_category": { "category_id": "700650", "category_name": "Vitamins, Minerals & Wellness Supplements" }
}
```

### 2. `/tiktok/product/detail` for Same Product `1731661332013680750` (Sanitized)
```json
{
  "product_id": "1731661332013680750",
  "product_region": "th",
  "product_name": "[1แถม2] วิตามินซี อเซโรล่า เชอร์รี่ Vitamin C ACEROLA CHERRY ตรา inzent [A3]",
  "product_shop_id": "7495330267184007278",
  "pri_cate_id": "700645",
  "sec_cate_id": "700646",
  "ter_cate_id": "700650",
  "max_price": 144.55,
  "min_price": 144.55,
  "revenue": 8335227.33,
  "video_revenue": 7989690.74,
  "live_revenue": 345313.72,
  "sales_volumn": 61846,
  "creator_number": 1824,
  "video_number": 4548,
  "live_number": 2859,
  "delivery_type": "local",
  "shopping_mall_revenue": 222.87,
  "commission_rate": 10,
  "unit_price": 134.77,
  "product_review_count": 44372,
  "launch_date": "2025-01-21",
  "master_image_url": "https://p16-oec-sg.ibyteimg.com/...",
  "revenue_trend": "[array len=7]",
  "product_description": "[array len=8]"
}
```

---

## Backend Security & Error-Handling Verification (`VERIFIED`)

| Scenario | Error Code | HTTP Status | Safeguard Verified |
| :--- | :--- | :--- | :--- |
| **Missing API Key** (neither Backend Secret nor session key set) | `KALODATA_NOT_CONNECTED` | `503` | Distinct from invalid-key `401`; never exposes env internals. |
| **Invalid API Key** (`401`/`403`/Kalodata `code 501` key rejection) | `KALODATA_INVALID_KEY` | `401` | Live-verified with dummy key (`0` credits); returns fixed safe message and never echoes upstream key text. |
| **Rate Limit** (HTTP `429` JSON or non-JSON, or QPS/rate-limit message) | `KALODATA_RATE_LIMITED` | `429` | Distinct code & status; zero automatic retries to prevent double-billing. |
| **Insufficient Credits** (HTTP `402` JSON or non-JSON) | `KALODATA_INSUFFICIENT_CREDITS` | `402` | Distinct code & status. |
| **Request Timeout** (`AbortError`) | `KALODATA_TIMEOUT` | `504` | Distinct from generic upstream failure. |
| **Other Upstream / Network API Error** | `KALODATA_UPSTREAM_ERROR` | `502` | Passes upstream text through `sanitizeKalodataErrorText` to redact any key/token patterns. |
| **UI Key vs. Backend Secret Isolation** | `409 Conflict` on UI override | `409` | `process.env.KALODATA_API_KEY` always takes strict precedence; UI connect cannot overwrite Backend Secrets; `maskedKey` is always `null`. |

---

## Remaining `UNVERIFIED` Items (Explicitly Preserved for Future Follow-Up)

1. **Exact semantic definitions:**
   - Whether `revenue` / `sales_volumn` represent gross paid orders or net-of-returns/cancellations.
   - Whether `creator_number` on `/detail` counts creators active in `last7Day`, creators with `>= 1` sale in `last7Day`, or lifetime affiliated creators.
   - Whether `product_review_count` on `/detail` is cumulative lifetime reviews vs. period-scoped reviews.
   - Exact baseline window and zero-baseline edge cases for `revenue_growth_rate`.
   - Encoding of `0%` or `<1%` `commission_rate` and open-plan vs. max targeted-plan semantics.
2. **Product Rating source:** Absent on both `/tiktok/product/rank` and `/tiktok/product/detail` (`need_extra: true`).
3. **Unprobed endpoints & options:** Credit cost and schemas of `/tiktok/category/rank`, `/tiktok/product/analysis`, `/tiktok/product/comment/insight`, alternative `sort_field` keys on `/rank`, `date_range: 'last30Day'`, and maximum `page_size`.
4. **Parser follow-up (deferred out of Phase 0 — Scoring/Ranking/UI intentionally untouched):**
   - `server/kalodata.ts` and `src/lib/metricFoundation.ts` do not yet map `creator_number`, `product_review_count`, `pri_category.category_id` / `pri_category.category_name`, or percentage-point `revenue_growth_rate` / `commission_rate` directly — those updates belong to a separate parser/scoring follow-up after reviewing this Phase 0 report.
