# Phase 11 — Live Product Discovery Validation & Historical Intelligence

**Repository:** `ZinLinn254995/SiamVisual`  
**Phase:** Phase 11 (Live Product Discovery Validation & Historical Intelligence)  
**Validation Date (UTC):** `2026-11-25`  
**Live Discovery Capture Timestamp (UTC):** `2026-11-25T16:50:12.320Z` (`/tiktok/product/rank`)  
**Live Detail Enrichment Timestamp (UTC):** `2026-11-25T16:50:49.298Z` (`/tiktok/product/detail` on #1 candidate `1731299385569545105`)  
**Commercial Scoring Formula / Eligibility Gates Modified:** **NO** (all Phase 1–10.1 formulas, weights, and hard gates preserved untouched)

---

## Standardized Status Vocabulary Used in This Report

| Status Tag | Meaning |
| --- | --- |
| `VERIFIED` | Directly confirmed from live Kalodata API responses with verified units, semantics, and window (`last7Day`, THB, TH) |
| `PARTIALLY_VERIFIED` | Confirmed in part (e.g., raw numeric field returned live, or single-day live snapshot verified while multi-day live window is still pending) |
| `UNVERIFIED` | Raw field exists on a Kalodata endpoint, but its semantic window/scope (e.g., active vs. lifetime creators, exact growth comparison baseline, lifetime vs. recent review count) is not yet contract-verified, so scoring & strategies intentionally exclude it |
| `UNAVAILABLE` | Metric is not returned by tested Kalodata endpoints (e.g., `rating` absent on both `/rank` and `/detail`; `creator_number` and `product_review_count` absent on `/rank`) |
| `PRELIMINARY` | Useful commercial shortlist candidate based on verified Demand, Affiliate Earnings, and Video Revenue, **before** verified Competition and Quality evidence is available |
| `INSUFFICIENT_DATA` | Official `scoringEngineV2` eligibility status when required core commercial dimensions (Competition, Customer Quality) lack verified evidence — commercial composite score is withheld (`null`) rather than fabricated |

---

## 1. Live Discovery Results

### 1.1 Controlled Live Search Parameters

One controlled live discovery search was executed through the real application pipeline (`POST /api/products/search` -> `server/productService.ts` -> `POST /tiktok/product/rank`), followed by an identical repeat call to verify server cache reuse, and one targeted detail enrichment (`POST /api/products/enrich` -> `POST /tiktok/product/detail`, `includeDetails: true` only) on the top preliminary candidate (`1731299385569545105`):

- **Region / Market:** `TH` (TikTok Shop Thailand)
- **Currency:** `THB`
- **Date Range:** `last7Day`
- **Page Size:** `20`
- **Affiliate Filter:** `is_affiliate: 1`
- **Cache Verification:** Request 1 (`fromCache: false`, `creditsUsed: 0.2`) -> Request 2 (`fromCache: true`, `creditsUsed: 0`, identical 20 products). Detail Enrichment Request 1 (`creditsUsed: 0.2`) -> Request 2 (`creditsUsed: 0`, cache hit).

### 1.2 Key Commercial & Gate Findings

1. **Zero fabricated winners (`0 / 20` `ELIGIBLE`):** Because Kalodata `/tiktok/product/rank` does not return verified creator competition or product rating (and `/detail` `creator_number` / `product_review_count` remain `UNVERIFIED` scope), `scoringEngineV2` honestly classified `17 / 20` products as `INSUFFICIENT_DATA` (`dataConfidence: 42/100`, `LOW`) and `3 / 20` as `NOT_MONETIZABLE`. No product was falsely upgraded to a complete commercial winner.
2. **Hard affiliate monetization gate caught upstream `0%` leaks:** Even with `is_affiliate: 1`, Kalodata returned 3 high-revenue products with `commission_rate = 0%`:
   - `#18` **Airpods 5** (`1737449944001578194`, ฿4.13M 7d revenue, `0%` commission -> `NOT_MONETIZABLE`)
   - `#19` **TD Ring 1g** (`1738545545522218819`, ฿3.55M 7d revenue, `0%` commission -> `NOT_MONETIZABLE`)
   - `#20` **iPad A16 Gen 11** (`1732077377460865234`, ฿5.01M 7d revenue, `0%` commission -> `NOT_MONETIZABLE`)
   All 3 were strictly blocked from earning scores and preliminary shortlist qualification.
3. **Channel differentiation prevents false video recommendations:** Products with high total revenue driven primarily by Live or Mall sales — such as `#6 Whitelab Astaxanthin` (4.6% video, ฿3.32M live), `#8 Teashell Niacinamide` (0.2% video, ฿3.80M mall), and `#12 เม็ดปักพี่ฝน` (2.0% video, ฿3.17M mall / ฿2.38M live) — were accurately excluded from `STRONG_DEMAND_STRONG_VIDEO_SALES`.

### 1.3 Real-World Preliminary Shortlist (TikTok Shop Thailand — `last7Day`, Captured `2026-11-25T16:50:12.320Z`)

> **Mandatory Commercial Disclaimer (`PRELIMINARY` / `INSUFFICIENT_DATA`):**  
> None of the products below are guaranteed to generate sales from user-created videos, and none qualify as complete commercial winners (`commercialStatus: INSUFFICIENT_DATA`, `dataConfidence: 42/100 LOW`). **Verified creator competition and verified customer rating/quality are unavailable/unverified** across all 20 products. High existing short-video revenue proves historical market conversion via video, **not** low creator saturation or future personal conversion certainty.

#### Group A — Verified Demand + Earning Candidates (`PRELIMINARY` — 8 Products)

Products matching `STRONG_AFFILIATE_EARNINGS` (either as primary classification or secondary signal alongside `STRONG_DEMAND_STRONG_VIDEO_SALES`), ordered by SiamVisual Earning Score & Commission Payout:

| Rank | Product ID | Product Title (TH/EN) | Category | Price (THB) | Comm. Rate | Est. Comm./Sale | 7d Revenue (THB) | 7d Sales | Demand / Earning | Video Share (7d) | Shortlist Tag(s) | Key Limitation |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- | --- |
| 1 | `1731299385569545105` | Solomon Pyla Plus 9" Spring Mattress | Furniture | ฿2,127.62 | 7% | **฿148.93** | ฿6,929,654 | 3,257 | `80 / 70` | 76.2% (฿5.28M) | `STRONG_DEMAND_STRONG_VIDEO_SALES` + `STRONG_AFFILIATE_EARNINGS` | Competition (`creator_number: 343` on `/detail`) `UNVERIFIED`; Rating `UNAVAILABLE` |
| 2 | `1732462917435950190` | INZENT Vitamin C + Gluta Collagen [A10] | Health | ฿141.99 | 20% | **฿28.40** | ฿4,163,665 | 29,324 | `80 / 59` | 95.5% (฿3.98M) | `STRONG_DEMAND_STRONG_VIDEO_SALES` + `STRONG_AFFILIATE_EARNINGS` | Competition `UNAVAILABLE`; Quality `UNAVAILABLE` |
| 3 | `1732232621014943924` | Panda&Ele 5-Ply Facial Tissue (20 Packs) | Home Supplies | ฿468.96 | 10% | **฿46.90** | ฿5,526,746 | 11,785 | `80 / 58` | 48.9% (฿2.70M) | `STRONG_AFFILIATE_EARNINGS` | Video share just below 50% strong cutoff (mixed video/live); Competition & Quality `UNAVAILABLE` |
| 4 | `1736401558606284552` | NAWANNA Ginseng + Turmeric Bright Cream | Beauty & Personal Care | ฿146.37 | 18% | **฿26.35** | ฿3,519,141 | 24,042 | `80 / 57` | 96.6% (฿3.40M) | `STRONG_DEMAND_STRONG_VIDEO_SALES` + `STRONG_AFFILIATE_EARNINGS` | Competition & Quality `UNAVAILABLE`; raw growth `-38.19%` (`UNVERIFIED` window) |
| 5 | `1730650840970135613` | Bemingtop643 BMG Knit Cardigan (S–XL) | Womenswear & Underwear | ฿427.23 | 10% | **฿42.72** | ฿8,236,928 | 19,280 | `80 / 56` | 63.1% (฿5.20M) | `STRONG_DEMAND_STRONG_VIDEO_SALES` + `STRONG_AFFILIATE_EARNINGS` | Competition & Quality `UNAVAILABLE`; Pre-order 30-day SKU note in title |
| 6 | `1734215429336433667` | Whitelab Astaxanthin + Vitamin E 60 Softgels | Health | ฿358.10 | 10% | **฿35.81** | ฿3,485,400 | 9,733 | `80 / 54` | 4.6% (฿160.7K) | `STRONG_AFFILIATE_EARNINGS` | **Live-driven** (฿3.32M live vs. 4.6% video); weak short-video proof; Competition & Quality `UNAVAILABLE` |
| 7 | `1733023593329296909` | OUKEYA Classy Matte Cushion | Beauty & Personal Care | ฿143.37 | 15% | **฿21.51** | ฿5,202,741 | 36,290 | `80 / 52` | 90.5% (฿4.71M) | `STRONG_DEMAND_STRONG_VIDEO_SALES` + `STRONG_AFFILIATE_EARNINGS` | Competition & Quality `UNAVAILABLE` |
| 9 | `1738398029387761617` | Dr.PONG GPI FIT498 with Probiotic | Health | ฿1,001.36 | 5% | **฿50.07** | ฿3,665,979 | 3,661 | `80 / 50` | 91.7% (฿3.36M) | `STRONG_DEMAND_STRONG_VIDEO_SALES` + `STRONG_AFFILIATE_EARNINGS` | Lower % rate (5%) offset by higher ticket (฿50.07/sale); Competition & Quality `UNAVAILABLE` |

#### Group B — Products with Strong Existing Video Sales Evidence (`PRELIMINARY` — 11 Products)

All monetizable products meeting `STRONG_DEMAND_STRONG_VIDEO_SALES` (`Demand >= 60`, verified `videoRevenueThb7d >= ฿100,000`, `videoRevenueShare >= 50%`), ordered by verified 7d Video Revenue:

| Rank (Pool) | Product ID | Product Title (Short) | Category | 7d Video Revenue (THB) | Video Share of 7d Rev | 7d Total Revenue | Comm. Rate & Payout | Overlap with Group A? | Missing Evidence |
| ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 13 | `1731661332013680750` | INZENT Vitamin C Acerola Cherry [A3] | Health | **฿7,989,691** | **95.9%** | ฿8,335,227 | 10% · ฿13.48 | No (lower THB/sale) | Competition & Quality `UNAVAILABLE` |
| 14 | `1729437530297568140` | Maybelline SuperStay Vinyl Ink | Beauty & Personal Care | **฿5,662,323** | **83.6%** | ฿6,770,659 | 7% · ฿13.37 | No (lower THB/sale) | Competition & Quality `UNAVAILABLE` |
| 10 | `1738529120155961009` | Love Story Love Pink Perfume | Beauty & Personal Care | **฿5,296,672** | **89.8%** | ฿5,896,820 | 15% · ฿14.82 | No (lower THB/sale) | Competition & Quality `UNAVAILABLE` |
| 1 | `1731299385569545105` | Solomon Pyla Plus 9" Spring Mattress | Furniture | **฿5,276,828** | **76.2%** | ฿6,929,654 | 7% · **฿148.93** | **Yes** | Competition `UNVERIFIED` (`343` raw); Quality `UNAVAILABLE` |
| 5 | `1730650840970135613` | Bemingtop643 BMG Knit Cardigan | Womenswear & Underwear | **฿5,197,440** | **63.1%** | ฿8,236,928 | 10% · **฿42.72** | **Yes** | Competition & Quality `UNAVAILABLE` |
| 7 | `1733023593329296909` | OUKEYA Classy Matte Cushion | Beauty & Personal Care | **฿4,706,157** | **90.5%** | ฿5,202,741 | 15% · **฿21.51** | **Yes** | Competition & Quality `UNAVAILABLE` |
| 2 | `1732462917435950190` | INZENT Vitamin C + Gluta [A10] | Health | **฿3,978,071** | **95.5%** | ฿4,163,665 | 20% · **฿28.40** | **Yes** | Competition & Quality `UNAVAILABLE` |
| 16 | `1735933480387970400` | Ness Mini Brightening Oil Set | Beauty & Personal Care | **฿3,604,042** | **97.4%** | ฿3,702,302 | 10% · ฿4.89 | No (micro-payout) | Competition & Quality `UNAVAILABLE` |
| 4 | `1736401558606284552` | NAWANNA Ginseng Turmeric Cream | Beauty & Personal Care | **฿3,399,069** | **96.6%** | ฿3,519,141 | 18% · **฿26.35** | **Yes** | Competition & Quality `UNAVAILABLE` |
| 9 | `1738398029387761617` | Dr.PONG GPI FIT498 Probiotic | Health | **฿3,362,255** | **91.7%** | ฿3,665,979 | 5% · **฿50.07** | **Yes** | Competition & Quality `UNAVAILABLE` |
| 15 | `1729424092832893836` | Maybelline SuperStay Matte Ink | Beauty & Personal Care | **฿3,019,915** | **85.3%** | ฿3,541,047 | 7% · ฿12.77 | No (lower THB/sale) | Competition & Quality `UNAVAILABLE` |

*Top dual-signal candidates (both Group A & Group B, 6 products total):* `#1 Solomon Pyla Plus Mattress`, `#2 INZENT Vit C + Gluta [A10]`, `#4 NAWANNA Ginseng Cream`, `#5 Bemingtop643 Knit Cardigan`, `#7 OUKEYA Matte Cushion`, and `#9 Dr.PONG GPI FIT498`. Every one remains strictly **`PRELIMINARY`** pending verified creator competition, customer rating, and multi-day historical tracking.

---

## 2. Product Counts and Data Completeness

| Metric / Pipeline Count | Observed Count | Share of Pool | Status / Notes |
| --- | ---: | ---: | --- |
| Total products returned (`/tiktok/product/rank`) | **20** | 100% | `page_size: 20`, `TH`, `THB`, `last7Day`, `is_affiliate: 1` |
| Unique products after deduplication | **20** | 100% | `0` duplicate product IDs |
| Products with usable Demand data (`demandScore.status === 'SCORED'`) | **20** | 100% | `revenueThb7d` & `salesVolume7d` `VERIFIED` on all 20 |
| Products with usable Earning data (`earningScore.status === 'SCORED'`) | **17** | 85% | `3` blocked due to `0%` commission |
| Products rejected as `NOT_MONETIZABLE` (`commission_rate === 0%`) | **3** | 15% | `#18 Airpods 5`, `#19 TD Ring 1g`, `#20 iPad A16 Gen 11` |
| Products with verified Video Revenue (`videoRevenueThb7d > 0`) | **19** | 95% | `#19 TD Ring 1g` had `฿0` (`state: ZERO`) |
| Products with verified Competition data (`competitionScore.status === 'SCORED'`) | **0** | 0% | `UNAVAILABLE` on `/rank`; `creator_number: 343` on `/detail` is `UNVERIFIED` scope |
| Products with verified Customer Quality data (`customerQualityScore.status === 'SCORED'`) | **0** | 0% | `rating` `UNAVAILABLE` on both endpoints; `product_review_count` `UNVERIFIED` scope |
| Products with complete Commercial Opportunity eligibility (`ELIGIBLE`) | **0** | 0% | `17` `INSUFFICIENT_DATA` (`42/100 LOW`), `3` `NOT_MONETIZABLE` |
| Products surfaced in preliminary discovery shortlist (`primaryClassification !== 'INSUFFICIENT_EVIDENCE'`) | **13** | 65% | `11` `STRONG_DEMAND_STRONG_VIDEO_SALES` + `2` `STRONG_AFFILIATE_EARNINGS`; `7` in `INSUFFICIENT_EVIDENCE` (`4` monetizable below threshold + `3` non-monetizable) |
| Products qualifying for any of the 8 V2 Strategies | **0** | 0% | All 8 strategies (`early_market_opportunity` .. `trend_timing_opportunity`) returned `0 / 20` due to missing verified competition, quality, or multi-day local history |

---

## 3. Six-Category Discovery Shortlist Validation

All six classifications defined in `src/lib/discoveryShortlist.ts` (`DISCOVERY_SHORTLIST_THRESHOLDS`) were validated against both the live 20-product pool and strict synthetic boundary tests in `tests/phase11LiveDiscoveryHistoricalValidation.test.ts`:

| Discovery Category | Exact Eligibility Conditions (Unchanged) | Live Pool Count (Primary / Total Incl. Secondary) | Guard Verification Result |
| --- | --- | ---: | --- |
| `STRONG_DEMAND_STRONG_VIDEO_SALES` | Monetizable (`commissionRate > 0`), `demandScore >= 60`, verified `videoRevenueThb7d >= ฿100,000`, `videoRevenueShare >= 50%` | **11 / 11** | `VERIFIED` — excludes 0% commission (#18), live-driven (#6), mall-driven (#8, #12), and <50% video share (#3 at 48.9%, #11 at 48.0%) |
| `STRONG_DEMAND_LOW_COMPETITION` | Monetizable, `demandScore >= 60`, verified `competitionScore >= 70` (requires verified active `creatorCount`) | **0 / 0** | `VERIFIED` — remains honestly `0` when competition is missing or `UNVERIFIED`; triggers accurately in synthetic verified-competition fixture |
| `STRONG_AFFILIATE_EARNINGS` | Monetizable, `demandScore >= 50`, `earningScore >= 50` (and `commissionRate >= 10%` or `commissionThb >= ฿40`) | **2 / 8** (`6` overlap as secondary under Strong Video Sales) | `VERIFIED` — blocks 0% commission, negative/invalid rates (`>100%`), and low-payout items |
| `EMERGING_OPPORTUNITY` | Monetizable, `demandScore >= 50`, verified `competitionScore >= 55`, plus verified positive momentum (verified `revenueGrowthRate >= 15%` or verified multi-day local trend) | **0 / 0** | `VERIFIED` — does **not** trigger from unverified raw `revenue_growth_rate` alone or imported snapshots; triggers only when verified competition + verified momentum are present |
| `HIGH_DEMAND_HIGH_COMPETITION` | Monetizable, `demandScore >= 70`, verified `competitionScore <= 35` (high verified creator saturation) | **0 / 0** | `VERIFIED` — remains honestly `0` without verified competition; flags accurately when verified high creator saturation is supplied |
| `INSUFFICIENT_EVIDENCE` | Non-monetizable (`0%` comm), invalid/stale/missing core metrics, or monetizable items not meeting any strong shortlist threshold | **7 / 7** (`4` monetizable below threshold + `3` non-monetizable) | `VERIFIED` — catches missing, `UNAVAILABLE`, `STALE` (>24h), `INVALID` (`commissionRate: 150`, `creatorCount: -5`), `UNVERIFIED`, and `0%` commission items |

---

## 4. Product-Level Evidence Findings & UI Clarity Improvements

To help creators quickly evaluate why a product appears in SiamVisual without cluttering `ProductCard.tsx` (respecting the clean visual card layout introduced earlier), Phase 11 added a dedicated pure evidence breakdown builder and integrated it into the Score Breakdown dialog:

- **`src/lib/productEvidenceSummary.ts` (`buildProductEvidenceSummary`)**: Produces a strict 4-bucket bilingual (`en` + `my`) breakdown for any product + optional local snapshot history:
  1. **Verified Facts (`verifiedFacts`)**: Fresh `EXACT_METRIC` / `VERIFIED` Kalodata values only (price, commission rate, 7d revenue, 7d sales volume, 7d video/live/mall revenue, and verified competition/quality if ever supplied).
  2. **Derived Calculations (`derivedCalculations`)**: Deterministic values computed from verified facts (e.g., estimated THB commission per sale, video revenue share %, revenue per creator when competition is verified, preliminary Demand/Earning sub-scores).
  3. **Unavailable / Unverified Evidence (`unavailableEvidence`)**: Explicit separation of `UNAVAILABLE` fields (e.g., product rating, `/rank` creator count), `UNVERIFIED` scope fields (e.g., `/detail` `creator_number`, `product_review_count`, raw `revenue_growth_rate` comparison window), and historical observation gap status (local verified days vs. imported unverified backup rows).
  4. **Creative Heuristics (`heuristicSignals`)**: Clearly labeled non-commercial content guidance (Video Suitability / silent-video hook cues), isolated from commercial scoring so visual appeal is never mistaken for sales proof.
- **`src/components/ScoreDetailDialog.tsx` & `src/i18n.ts` & `src/App.tsx`**: Renders the compact 4-section Evidence Breakdown inside the detail modal in both English and Myanmar, passing `productSnapshots[scoreDialogProduct.id]` from `App.tsx`. `ProductCard.tsx` remains clean and scannable with zero added text clutter.

---

## 5. Historical Snapshot Validation & Multi-Day Accumulation Procedure

### 5.1 Automated & Live Snapshot Validation Results

Using the real captured `/rank` (`2026-11-25T16:50:12.320Z`) and `/detail` (`2026-11-25T16:50:49.298Z`) payloads alongside `tests/phase11LiveDiscoveryHistoricalValidation.test.ts`:

1. **First live search recording:** Recorded `20` genuine local snapshots (`added: 20`, `updated: 0`, `deduplicated: 0`), each tagged `sourceOrigin: 'LOCAL_OBSERVED'`.
2. **Repeat same-day search deduplication:** Identical search on the same UTC day (`2026-11-25`) recorded `added: 0`, `updated: 0`, `deduplicated: 20` — preventing artificial snapshot inflation or fabricated growth.
3. **Live `/rank` + `/detail` merge & per-metric timestamp preservation:** Enriching `#1 Solomon Mattress` (`1731299385569545105`) merged `/detail` fields onto the same UTC-day snapshot in place (`updated: 1`, snapshot count stayed `1` for Day 2) while strictly preserving per-metric timestamps and verification states:
   - `revenueGrowthRate`: `fetchedAt = '2026-11-25T16:50:12.320Z'`, `sourceEndpoint = 'rank'`, `revenueGrowthVerified = false`
   - `creatorCountUnverifiedRaw` (`343`): `fetchedAt = '2026-11-25T16:50:49.298Z'`, `sourceEndpoint = 'detail'`, `creatorCountVerified = null`
   - `revenueThb` (`6929653.68`): `fetchedAt = '2026-11-25T16:50:49.298Z'`, `sourceEndpoint = 'detail'`
4. **Reload persistence:** Serialized storage reloaded identically via `loadProductSnapshotsFromStorage(storage)` with all local observations and verification flags intact.
5. **Backup export/restore trust boundary:** Restoring snapshots from a backup JSON marks unknown/imported observations as `IMPORTED_UNVERIFIED` and strips spoofed verified flags (`creatorCountVerified -> null`, `revenueGrowthVerified -> false`), ensuring tampered backups can never unlock historical strategies while preserving existing local genuine records.

### 5.2 Controlled Multi-Day Observation Accumulation Procedure (No Manufactured History)

Because real multi-day longitudinal trends **cannot** be honestly validated within a single calendar day (`2026-11-25`), SiamVisual uses the following low-credit operational protocol to build genuine historical intelligence:

1. **Cadence:** Run **1 controlled discovery search per UTC calendar day** (`region: TH`, `currency: THB`, `date_range: last7Day`, `page_size: 20`, `is_affiliate: 1` -> `0.20 credits/day`) for **at least 3–5 distinct UTC days** (total budget `0.60–1.00 credits` across 3–5 days).
2. **Same-day safety:** Any repeat searches on the same UTC day hit the server cache (`0 credits`) and deduplicate cleanly by UTC day in `snapshotStore.ts`.
3. **Optional detail enrichment:** Only enrich shortlisted Group A+B candidates (`0.20 credits/product`) when needed; `/rank` timestamps remain isolated from `/detail` timestamps.
4. **Trend unlock threshold:** `fast_rising_products` and `trend_timing_opportunity` remain honestly blocked (`INSUFFICIENT_DATA`) until at least **2–3 distinct UTC-day `LOCAL_OBSERVED` snapshots** exist for the same product with verified demand acceleration (and verified competition for `trend_timing_opportunity`).
5. **Audit discipline:** Never backfill synthetic past dates into production `localStorage` or claim a multi-day trend is live-validated before real multi-day observations have accumulated.

---

## 6. Historical Strategy Validation (`fast_rising_products` & `trend_timing_opportunity`)

Both historical strategies in `src/lib/strategyEngineV2.ts` were validated across all **8 required longitudinal scenarios** in `tests/phase11LiveDiscoveryHistoricalValidation.test.ts` (Subtest 3) without modifying any gates or formulas:

| # | Test Scenario | `fast_rising_products` Result | `trend_timing_opportunity` Result | Status |
| ---: | --- | --- | --- | --- |
| 1 | **Single-day snapshot only** (current live baseline) | Blocked (`INSUFFICIENT_DATA`) | Blocked (`INSUFFICIENT_DATA`) | `VERIFIED` |
| 2 | **Multiple snapshots on same UTC day** (deduplicated) | Blocked (`INSUFFICIENT_DATA`, 1 unique day) | Blocked (`INSUFFICIENT_DATA`) | `VERIFIED` |
| 3 | **Multi-day rising demand (`>=3` days, strong verified revenue/sales acceleration) + verified manageable competition** | **Qualified** (`ELIGIBLE`) | **Qualified** (`ELIGIBLE`) | `VERIFIED` |
| 4 | **Multi-day flat or declining demand** | Not Qualified (fails growth gate) | Not Qualified (fails trend acceleration gate) | `VERIFIED` |
| 5 | **Multi-day rising demand + high verified creator competition / rapid saturation** | Evaluated strictly on momentum/earning gates (unaffected if monetizable, or flagged by saturation) | Blocked / Not Qualified (fails low/moderate creator crowding gate) | `VERIFIED` |
| 6 | **Multi-day rising demand + `0%` commission (`NOT_MONETIZABLE`)** | Blocked (`NOT_MONETIZABLE`) | Blocked (`NOT_MONETIZABLE`) | `VERIFIED` |
| 7 | **Imported / unverified backup snapshots (`IMPORTED_UNVERIFIED`)** | Blocked (`INSUFFICIENT_DATA` — imported rows excluded from verified trend math) | Blocked (`INSUFFICIENT_DATA`) | `VERIFIED` |
| 8 | **Mixed local + imported snapshots (insufficient genuine local days, e.g., 1 local + 2 imported)** | Blocked (`INSUFFICIENT_DATA` — does not combine unverified backup rows to fabricate a 3-day trend) | Blocked (`INSUFFICIENT_DATA`) | `VERIFIED` |

*Live Pool Status (`2026-11-25`, single UTC day):* Both `fast_rising_products` (`0 / 20`) and `trend_timing_opportunity` (`0 / 20`) remain honestly **unqualified** in live data. Multi-day historical trends are **NOT** claimed as live-validated yet — only the historical engine logic, gating, and single-day live snapshot capture are verified.

---

## 7. API Calls and Credit Consumption Ledger

No secrets or API keys were logged, exposed to the client, or written to disk.

| Step | Endpoint (App -> Upstream) | Cache Status | Balance Before | Balance After | Actual Credits Used | Timestamp (UTC) |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Pre-check | `GET /api/kalodata/balance` -> `/credit/balance` | Live | `9.10` | `9.10` | `0.00` | `2026-11-25T16:50:11.966Z` |
| Request 1 | `POST /api/products/search` -> `POST /tiktok/product/rank` (`TH`, `THB`, `last7Day`, `page_size: 20`, `is_affiliate: 1`) | **MISS** (Live) | `9.10` | `8.90` | **0.20** | `2026-11-25T16:50:12.320Z` |
| Request 2 | `POST /api/products/search` (identical params) | **HIT** (App Cache) | `8.90` | `8.90` | `0.00` | `2026-11-25T16:50:12.xxxZ` |
| Request 3 | `POST /api/products/enrich` -> `POST /tiktok/product/detail` (`1731299385569545105`, `includeDetails: true` only) | **MISS** (Live) | `8.90` | `8.70` | **0.20** | `2026-11-25T16:50:49.298Z` |
| Request 4 | `POST /api/products/enrich` (identical params) | **HIT** (App Cache) | `8.70` | `8.70` | `0.00` | `2026-11-25T16:50:49.xxxZ` |
| Post-check | `GET /api/kalodata/balance` -> `/credit/balance` | Live | `8.70` | `8.70` | `0.00` | `2026-11-25T16:50:49.507Z` |
| **Total** | **2 Paid Upstream Requests + 2 App Cache Hits** | — | **`9.10`** | **`8.70`** | **`0.40`** | — |

> *Billing Note:* Requests 2 and 4 incurred `0.00` credits solely because SiamVisual's server-side cache intercepted identical requests; this does **not** mean Kalodata upstream endpoints are zero-cost.

---

## 8. Files Changed in Phase 11

| File Path | Type | Purpose |
| --- | --- | --- |
| `src/lib/productEvidenceSummary.ts` | New | Deterministic bilingual (`en`/`my`) product evidence builder strictly separating Verified Facts, Derived Calculations, Unavailable/Unverified Evidence, and Creative Heuristics, plus historical snapshot trust summary |
| `src/i18n.ts` | Modified | Added `v2.dialog.evidenceSummary` translations for both Myanmar (`my`) and English (`en`) |
| `src/components/ScoreDetailDialog.tsx` | Modified | Integrated compact 4-bucket Evidence Breakdown into the Score Breakdown dialog without adding clutter to `ProductCard.tsx`; accepts optional `snapshots` prop |
| `src/App.tsx` | Modified | Passed `productSnapshots[scoreDialogProduct.id]` into `<ScoreDetailDialog>` |
| `tests/phase11LiveDiscoveryHistoricalValidation.test.ts` | New | Comprehensive Phase 11 automated suite covering all 6 discovery categories & guards, snapshot accumulation/dedup/merge/reload/backup trust, all 8 longitudinal strategy cases, and bilingual evidence separation |
| `docs/quality/phase11-live-discovery-historical-validation.md` | New | Complete Phase 11 validation report, real-world Group A & Group B shortlists, credit ledger, and multi-day accumulation procedure |

*(Unchanged by design: `src/lib/scoringEngineV2.ts`, `src/lib/strategyEngineV2.ts`, `src/lib/discoveryShortlist.ts`, `src/components/ProductCard.tsx`.)*

---

## 9. Test & Verification Results

### 9.1 Automated Tests, Typecheck & Production Build

- **Full Automated Test Suite (`npx tsx --test tests/*.test.ts`):** **103 / 103 passing** across **13 test suites** (`0` failures, `0` skipped), including `4 / 4` in `tests/phase11LiveDiscoveryHistoricalValidation.test.ts`.
- **TypeScript Static Check (`npm run lint` / `tsc --noEmit`):** **0 errors**.
- **Production Build (`npm run build` / `compile_applet`):** **Succeeded cleanly**.

### 9.2 Browser Automation Honesty Note

Headless browser automation (`chromium`, `chromium-browser`, `google-chrome`, `playwright`) is **not installed** in this sandbox environment. Therefore:
- **Performed & Verified:** Live backend API integration against real Kalodata endpoints, full Node/`tsx` scoring/shortlist/snapshot/strategy test suites, TypeScript compilation, and Vite production bundling.
- **Not Performed:** Automated headless browser rendering, live DOM mobile screenshot captures, or interactive click-through automation.

---

## 10. Verified and Unverified Metrics Matrix

| Metric / Signal | Source Endpoint(s) | Status | Scoring / Strategy Treatment |
| --- | --- | --- | --- |
| `unit_price` (`priceThb`) | `/rank`, `/detail` | `VERIFIED` | Used in Earning calculation (`commissionThb`) & Verified Facts |
| `commission_rate` (`commissionRate`) | `/rank`, `/detail` | `VERIFIED` | Hard monetization gate (`0%` -> `NOT_MONETIZABLE`); Earning sub-score |
| `revenue` (`revenueThb7d`, `last7Day`, THB) | `/rank`, `/detail` | `VERIFIED` | Demand sub-score, video share denominator, local snapshot history |
| `sales_volumn` (`salesVolume7d`, `last7Day`) | `/rank`, `/detail` | `VERIFIED` | Demand sub-score, local snapshot history |
| `video_revenue` (`videoRevenueThb7d`, `last7Day`, THB) | `/rank`, `/detail` | `VERIFIED` | Conversion Evidence & `STRONG_DEMAND_STRONG_VIDEO_SALES` shortlist |
| `live_revenue` (`liveRevenueThb7d`, `last7Day`, THB) | `/rank`, `/detail` | `VERIFIED` | Channel mix context (distinguishes live-driven vs. video-driven demand) |
| `showcase_revenue` / `shopping_mall_revenue` (`shoppingMallRevenueThb7d`) | `/rank`, `/detail` | `VERIFIED` | Channel mix context (distinguishes mall-driven vs. video-driven demand) |
| `creator_number` (`creatorCount`) | Absent on `/rank`; raw `343` on `/detail` | `UNAVAILABLE` (`/rank`) / `UNVERIFIED` (`/detail`) | Excluded from Competition score & low-competition shortlist until active-window semantics are verified |
| `product_review_count` (`reviewCount`) | Absent on `/rank`; raw `59540` on `/detail` | `UNAVAILABLE` (`/rank`) / `UNVERIFIED` (`/detail`) | Excluded from Customer Quality score until scope/freshness is verified |
| `rating` (`productRating`) | Absent on `/rank` & `/detail` | `UNAVAILABLE` | Excluded from Customer Quality score (`MISSING` / `UNAVAILABLE`) |
| `revenue_growth_rate` (`revenueGrowthRate`) | Returned on `/rank`; absent on `/detail` | `UNVERIFIED` | Excluded from verified momentum/strategies because comparison baseline window is unverified |
| Multi-day local revenue/sales trend | Client `snapshotStore` (`LOCAL_OBSERVED`) | `PARTIALLY_VERIFIED` | Engine + single-day live capture verified; **multi-day live series not yet accumulated** (`1` real calendar day captured so far) |
| Video Suitability / Creative Hook cues | Local creative heuristics | `UNVERIFIED` (Heuristic) | Strictly isolated from commercial scoring and labeled as Creative Heuristics |

---

## 11. Remaining Limitations

1. **No verified creator competition or customer rating in tested Kalodata endpoints:** All 17 monetizable live products remain `INSUFFICIENT_DATA` (`42/100 LOW`) for complete commercial ranking and `0 / 20` for V2 strategy qualification.
2. **Single-day live history only:** Only one UTC day (`2026-11-25`) of live observations exists so far. Multi-day live acceleration cannot be claimed as validated until genuine snapshots are collected across `>= 3` calendar days.
3. **Browser-local snapshot persistence (`localStorage`):** Historical snapshots persist cleanly across browser reloads and export/import safely, but are tied to the user's browser profile until a server-backed persistent store is introduced.
4. **No browser automation in sandbox:** Visual layout verification on physical Android viewports (`320px–430px`) requires manual device/browser inspection outside the sandbox.

---

## 12. Recommended Next Phase (Phase 12)

**Phase 12 — Multi-Day Live Longitudinal Accumulation & Competition Semantics Verification**

1. **Execute the 3–5 day controlled accumulation cadence** (`1` search/day, `0.20 cr/day`) on `TH / THB / last7Day / is_affiliate: 1` to capture genuine multi-day `LOCAL_OBSERVED` trajectories for real products and live-validate `fast_rising_products`.
2. **Verify Kalodata competition & quality semantics** via official Kalodata contract documentation or targeted endpoint inspection (confirming whether `creator_number` on `/detail` is strictly `last7Day` active affiliate creators or lifetime creators, and whether a separate endpoint supplies verified product rating).
3. **Evaluate optional server-side snapshot persistence** (if cross-device longitudinal tracking is desired) while maintaining the exact `LOCAL_OBSERVED` vs. `IMPORTED_UNVERIFIED` trust boundary.
