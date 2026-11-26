# SiamVisual — Phase 16: Live Probe P1 Verification (`last30Day` vs `last7Day` on `/tiktok/product/detail`)

**Date (UTC):** `2026-11-26`  
**Probe Timestamp (UTC):** `2026-11-26T11:57:41.024Z`  
**Repository:** `ZinLinn254995/SiamVisual`  
**User Authorization:** Explicitly approved single controlled probe (`Probe P1`, `~0.20 cr`)  
**Scoring Formulas / Weights / Eligibility Gates Changed:** **NO** (all Phase 1–15 formulas, weights, hard gates, and `INSUFFICIENT_DATA` protections remain untouched)

---

## 1. Credit & Cost Verification (Live Account Audit)

| Check | Timestamp (UTC) | Available Balance | Verified Cost |
| :--- | :--- | ---: | ---: |
| Balance Before (`GET /credit/balance`) | `2026-11-26T11:57:40.525Z` | **`8.50 credits`** | `0.00 cr` |
| **Single Paid Call:** `POST /openapi/v1/tiktok/product/detail` (`date_range: 'last30Day'`, `product_id: '1731299385569545105'`, `need_extra: true`, `need_image: 1`) | `2026-11-26T11:57:41.024Z` | — | **`0.20 credits`** |
| Balance After (`GET /credit/balance`) | `2026-11-26T11:57:41.158Z` | **`8.30 credits`** | `0.00 cr` |

- **Total Paid Calls Executed:** **`1`**
- **Total Credits Consumed:** **`0.20 credits`**
- **Remaining Account Balance:** **`8.30 credits`**
- **Unapproved Probes Executed (P2/P3/P4):** **`0`**

---

## 2. Side-by-Side Empirical Comparison (`last7Day` vs `last30Day`)

Target Product: **`1731299385569545105`** — *PAYDAY Solomon ที่นอนสปริงนุ่มเด้ง รุ่น Pyla Plus หนา 9 นิ้ว* (Region: `TH`, Currency: `THB`, Launch Date: `2024-11-17`).

| Field (`POST /tiktok/product/detail`) | Phase 11 Baseline (`last7Day`, `2026-11-25T16:50:49Z`) | Phase 16 Probe P1 (`last30Day`, `2026-11-26T11:57:41Z`) | Ratio / Delta | Empirical Conclusion |
| :--- | ---: | ---: | ---: | :--- |
| `revenue` (THB) | `6,929,653.68` | **`25,268,420.01`** | `3.65x` | **`VERIFIED`** — Window-scoped THB revenue |
| `video_revenue` (THB) | `5,276,828.00` | **`18,788,032.55`** | `3.56x` | **`VERIFIED`** — Window-scoped short-video revenue (`74.35%` share) |
| `live_revenue` (THB) | *(present)* | **`6,421,598.33`** | — | **`VERIFIED`** — Window-scoped livestream revenue (`25.41%` share) |
| `shopping_mall_revenue` (THB) | *(present)* | **`58,789.13`** | — | **`VERIFIED`** — Window-scoped mall/showcase revenue (`0.23%` share) |
| **Channel Sum Check** (`video + live + mall`) | Matches `revenue` | **`25,268,420.01`** | **`0.00 THB diff`** | **`VERIFIED`** — Exact additive reconciliation to 0.01 THB |
| `sales_volumn` (units) | `3,257` | **`12,071`** | `3.71x` | **`VERIFIED`** — Window-scoped unit sales |
| `unit_price` (THB) | `2,127.62` | **`2,093.32`** | `-1.61%` | **`VERIFIED`** — Exact match to `revenue / sales_volumn` (`2,093.3162`) |
| `commission_rate` (%) | `7` | **`7.000000000000001`** | `0%` | **`VERIFIED`** — Percentage points (`7%`); IEEE float noise trimmed cleanly |
| **`creator_number`** | **`343`** | **`860`** | **`2.51x` (`+517`)** | **`PARTIALLY_VERIFIED`** — **EMPIRICALLY PROVEN WINDOW-SCOPED** (NOT lifetime cumulative!). Posting vs. selling creator distinction still unconfirmed. |
| `video_number` | *(present)* | **`1,518`** | — | Window-scoped video count (`1.77` videos / creator in 30d) |
| `live_number` | *(present)* | **`5,237`** | — | Window-scoped livestream count |
| **`product_review_count`** | **`59,540`** | **`59,540`** | **`0` (identical)** | **`VERIFIED` SCOPE (CUMULATIVE LIFETIME)** — Window-invariant TikTok Shop PDP total review count. NOT star quality. |
| **`rating` / `product_rating`** | *(absent)* | **(absent)** | N/A | **`UNAVAILABLE`** — Confirmed absent on `/tiktok/product/detail` across both `last7Day` and `last30Day` even with `need_extra: true` |
| `revenue_growth_rate` | *(absent)* | **(absent)** | N/A | **`UNAVAILABLE` on `/detail`** (only returned on `/rank`), superseded by `revenue_trend` below |
| **`revenue_trend`** | `array[7]` | **`array[30]` (`number[]`)** | Exact window length | **`VERIFIED` DAILY THB ARRAY** — Sum = `25,268,420` THB vs `revenue` `25,268,420.01` THB (`0.01 THB` rounding diff!) |

---

## 3. Complete 25-Key Schema Audit (`POST /tiktok/product/detail`, `last30Day`, `need_extra: true`)

Exhaustive top-level keys returned in `envelope.data`:

`product_id`, `product_region`, `product_name`, `product_shop_id`, `pri_cate_id`, `sec_cate_id`, `ter_cate_id`, `max_price`, `min_price`, `revenue`, `video_revenue`, `live_revenue`, `sales_volumn`, `creator_number`, `video_number`, `live_number`, `delivery_type`, `shopping_mall_revenue`, `commission_rate`, `unit_price`, `product_review_count`, `launch_date`, `master_image_url`, `revenue_trend`, `product_description`.

**Confirmed Absent on `/tiktok/product/detail`:**
- No `rating`, `product_rating`, `star_rating`, `score`, or review distribution (`1★–5★`).
- No `revenue_growth_rate`.
- No per-creator breakdown, top-creator revenue share, or selling-creator vs. posting-creator split.
- Note: `launch_date` (`"2024-11-17"`) and `delivery_type` (`"local"`) are also present and clean.

---

## 4. Major Discovery: `revenue_trend` Exact Schema & Daily Reconciliation

`revenue_trend` on `POST /tiktok/product/detail` (`date_range: 'last30Day'`) is a flat JSON array of **`30` non-negative integers** representing **daily product revenue in THB**, ordered **chronologically from oldest day (`index 0`) to most recent day (`index 29`)**.

### Mathematical & Cross-Day Proof
1. **Exact Sum Identity:**
   - `sum(revenue_trend[0..29])` = **`25,268,420` THB**
   - `data.revenue` = **`25,268,420.01` THB**
   - Difference = **`0.01` THB** (`0.00000004%`, purely daily integer rounding).
2. **Chronological Ordering Proof (Cross-Validated Against Phase 11 `last7Day` Capture):**
   - Sum of first 7 elements (`revenue_trend[0..6]`): **`4,305,683` THB** (`-37.9%` away from Phase 11's `2026-11-25` 7-day revenue of `6,929,653.68` THB).
   - Sum of last 7 elements (`revenue_trend[23..29]`): **`6,700,166` THB** (within `-3.3%` of Phase 11's `2026-11-25` 7-day revenue, matching a 1-day rolling window advance from `2026-11-25` to `2026-11-26`).
   - Therefore: **`revenue_trend[0]` is oldest (`Day -30`) and `revenue_trend[29]` is newest (`Day -1`).**
3. **Derived In-Window Growth & Stability (Zero Extra Credits):**
   - **Last 7 days (`[23..29]`):** `6,700,166` THB
   - **Previous 7 days (`[16..22]`):** `5,955,086` THB
   - **Derived 7d-over-Previous-7d Revenue Growth:** **`+12.51%`** (`+745,080` THB)
   - **Second 15 days vs First 15 days:** `13,396,298` THB vs `11,872,122` THB (**`+12.84%`**)
   - **Daily Range:** Min `฿418,998` · Max `฿1,375,192` (zero zero-revenue days; sustained demand across all 30 days)

**Strategic Impact for SiamVisual:**
A single `0.20 cr` `last30Day` `/tiktok/product/detail` call provides **30 verified daily THB revenue data points** immediately — enabling mathematically exact, auditable 7d-vs-previous-7d revenue growth (`DERIVED`) and 30-day revenue trend consistency **on Day 1**, without waiting 7–14 calendar days to accumulate local snapshots!

---

## 5. Updated Verification & Integration Readiness Verdict

| Signal | Pre-Probe Status (Phase 13) | Post-Probe P1 Status | Safe Integration Recommendation |
| :--- | :--- | :--- | :--- |
| **`revenue_trend` (30d daily THB array)** | `UNVERIFIED` (inner schema unknown) | **`VERIFIED`** (`number[30]`, THB, chronological oldest→newest, exact sum match) | **`READY_FOR_INTEGRATION`** — Can immediately power auditable `DERIVED` 7d-over-prev-7d growth & 30d daily trend classification on `/detail` (`last30Day`) |
| **`creator_number` on `/detail`** | `UNVERIFIED` (window vs lifetime unknown) | **`PARTIALLY_VERIFIED`** — **Time-window scope `VERIFIED`** (`343` on `last7Day` vs `860` on `last30Day`), but posting-vs-selling creator definition & creator concentration remain unconfirmed | **`READY_FOR_TRANSPARENT_DISPLAY` / `CAUTIOUS_SCORING_DESIGN`** — Safe to display as verified window-scoped Active Creators (`860` in 30d / `343` in 7d) + Revenue-per-Active-Creator (`฿29.4K` / `฿20.2K`). For full Competition scoring with selling-creator count & top-creator concentration, optional **Probe P2** (`/tiktok/creator/rank` with `product_id`) is still needed. |
| **`product_review_count` on `/detail`** | `UNVERIFIED` (cumulative vs windowed unknown) | **`VERIFIED` SCOPE (Cumulative Lifetime PDP Count)** (`59,540` identical across `last7Day` & `last30Day`) | **`READY_FOR_TRANSPARENT_DISPLAY_ONLY`** — Safe to label accurately as cumulative lifetime PDP review count; **NOT** sufficient alone for Customer Quality score without star rating. |
| **Product Star Rating (`rating`)** | `UNAVAILABLE` on `last7Day` | **`UNAVAILABLE` CONFIRMED** on both `last7Day` & `last30Day` `/detail` | **`READY_AFTER_LIVE_PROBE` (Probe P3)** — Must test `POST /tiktok/product/comments` (or TikTok PDP source) if star rating is required; otherwise Customer Quality stays strictly `INSUFFICIENT_DATA` (`null`). |

---

## 6. Clean Code Changes Made During Phase 16

- **`server/kalodata.ts` (`fetchSingleKalodataProductById`) & `server/productService.ts`:** Forwarded `dateRange?: 'last7Day' | 'last30Day'` cleanly through single-link product detail lookup with isolated `single|${dateRange}|${id}` and `detail|${dateRange}|${id}` cache keys.
- **No scoring formulas, weights, thresholds, or eligibility gates were modified.**
