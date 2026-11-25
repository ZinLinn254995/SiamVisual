# Phase 8: Live Data Integration Audit & Scoring Revalidation

**Repository**: `ZinLinn254995/SiamVisual`  
**Audit Date**: 2026-11-25  
**Source Evidence**: `docs/quality/kalodata-api-contract-verification.md` (Phase 0 live probe, 2026-11-25)  
**Live Kalodata API Requests Used in Phase 8**: `0` (`0.00 credits` spent; all revalidation performed via code inspection and sanitized Phase 0 live fixtures).

---

## 1. Confirmed Fixes

| Defect | Root Cause | Files Changed | Fix Applied |
| :--- | :--- | :--- | :--- |
| `creator_number` unmapped | Parser only checked `creator_count` / `affiliate_count` / `influencer_count`; live `/detail` returns `creator_number`. | `server/kalodata.ts`, `src/lib/metricFoundation.ts`, `src/components/VideoStudioView.tsx`, `src/lib/aiChatPromptBuilder.ts` | Mapped `creator_number` as primary key into `kalodataMetrics.creatorCount` and `validatedMetrics.creatorCount.rawInput`, while keeping `state: 'UNAVAILABLE'` / `unit: 'UNVERIFIED'` because time-window scope is still `UNVERIFIED`. |
| `product_review_count` unmapped | Parser only checked `review_count` / `comment_count`; live `/detail` returns `product_review_count`. | `server/kalodata.ts`, `src/lib/metricFoundation.ts`, `src/components/VideoStudioView.tsx`, `src/lib/aiChatPromptBuilder.ts` | Mapped `product_review_count` as primary key into `kalodataMetrics.reviewCount` and `validatedMetrics.reviewCount.rawInput`, while keeping `state: 'UNAVAILABLE'` / `unit: 'UNVERIFIED'` because lifetime vs window scope is still `UNVERIFIED`. |
| `commission_rate` unit & `<1` inflation | `validateCommissionRateMetric` blocked all non-zero values (including verified percentage points like `10`, `7`, `15`), while `server/kalodata.ts` multiplied `0 < val < 1` by `100`. | `src/lib/metricFoundation.ts`, `server/kalodata.ts` | Validated `1..100` as `OK`/`PERCENT` (and `0` as `ZERO`/`PERCENT`) per Phase 0 live proof. Removed the `<1` `* 100` multiplier so `0 < val < 1` stays `UNAVAILABLE`/`UNVERIFIED` (and `null` on legacy `commissionRate`). |
| `revenue_growth_rate` 100x UI/prompt distortion & ratio assumption | `VideoStudioView.tsx` and `aiChatPromptBuilder.ts` multiplied `|rate| <= 3` by `100` (e.g. `-1.8%` -> `-180%`), and `server/scoreEngine.ts` checked `> 0.2`. | `src/lib/metricFoundation.ts`, `src/components/VideoStudioView.tsx`, `src/components/ScoreDetailDialog.tsx`, `src/lib/aiChatPromptBuilder.ts`, `src/lib/productIntelligenceView.ts`, `server/scoreEngine.ts` | Treated `revenue_growth_rate` as verified percentage points (`unit: 'PERCENT'`) with `UNVERIFIED_COMPARISON_PERIOD` note so UI/prompts render exact `%` values without 100x inflation while V2 scoring and provenance still withhold it as unverified. |
| `shopping_mall_revenue` / `showcase_revenue` dropped | Neither `/rank`'s `showcase_revenue` nor `/detail`'s `shopping_mall_revenue` was mapped. | `src/types.ts`, `src/types/metrics.ts`, `server/kalodata.ts`, `src/lib/metricFoundation.ts`, `server/productSanitizer.ts`, `src/lib/scoringEngineV2.ts`, `src/lib/storage.ts` | Added optional `shoppingMallRevenueThb7d` mapped from `shopping_mall_revenue ?? showcase_revenue` with 2-decimal THB precision (matching live channel sum `video + live + mall = total`). |
| `rating` marked `MISSING` instead of `UNAVAILABLE` | Tested `/rank` and `/detail` (`need_extra: true`) endpoints do not return rating; adapter emitted `MISSING`. | `src/lib/metricFoundation.ts` | Passed `missingAsUnavailable: true` for `rating` on `/rank`, `/detail`, and legacy adapters so `rating` stays `UNAVAILABLE`. |
| Nested `pri_category` object ignored on `/rank` | Live `/rank` returns `pri_category: { category_id, category_name }`, not flat `pri_cate_id` / `pri_cate_name`. | `server/kalodata.ts` | Read `row.pri_category.category_id` and `row.pri_category.category_name` first in `parseRawProductRow`. |
| `/detail` enrichment wiped `/rank` `revenueGrowthRate` | `selectFresherValidatedMetrics` / `mergeKalodataMetrics` replaced the entire `/rank` snapshot when `/detail` arrived minutes later. | `src/lib/storage.ts`, `src/App.tsx` | Implemented `mergeValidatedMetricsSnapshots` & updated `mergeKalodataMetrics` to complement endpoint-exclusive missing fields only when `dateRange` matches and timestamp spread is `<= 6 hours` (strictly blocking stale `>6h` cross-period mixing). |
| Redundant `/detail` credit spend | `enrichSingleKalodataProduct` had no server-side cache or in-flight dedup, and single-link `/detail` search didn't share cache or set `fetchedDetails: true` when description was empty. | `server/kalodata.ts`, `server/productService.ts`, `src/App.tsx` | Added 30-min per-layer TTL cache (`detail`, `specs`, `comments`) + in-flight deduplication in `server/kalodata.ts`, shared `/detail` cache between single-link search and Studio enrichment, and marked `fetchedDetails: true` for all `/detail` responses. |

---

## 2. Verified Behavior

Verified end-to-end against Phase 0 captured live fixtures (`1731661332013680750` `/rank` + `/detail` and realistic live-shaped rows):

- **THB Revenue & Channel Reconciliation**: `revenue`, `video_revenue`, `live_revenue`, and `shopping_mall_revenue` / `showcase_revenue` preserve 2-decimal THB precision (`6,017,972.18 + 2,317,032.28 + 222.87 = 8,335,227.33`).
- **Sales Volume (`sales_volumn`)**: Validated as `COUNT`/`SOURCE` (`16,965`) with exact spelling preserved; missing values remain `MISSING` (`null`), never fabricated as `0`.
- **Commission Rate (`commission_rate`)**: Verified percentage-point values (`1..100`, e.g., `10` = `10%`, `15` = `15%`) validate as `OK`/`PERCENT` and derive synthetic `commissionThb` (`491.32 * 10% = 49.13 THB`) with no minimum floor. `0` stays `ZERO` (`NOT_MONETIZABLE`). `0 < val < 1` stays `UNAVAILABLE`/`UNVERIFIED`.
- **Rating**: Stays `UNAVAILABLE` across `/rank` and `/detail`.
- **Four-Signal Separation Preserved**: Commercial Opportunity, Conversion Evidence (`STRONG`/`VIDEO` share with explicit non-guarantee disclaimer), Video Suitability (`scoreBreakdown`), and Data Confidence remain strictly separated.
- **No Unjustifiable Competition Inflation**: Missing/unverified `creator_number` keeps `competitionScore.score = null` (`INSUFFICIENT`), never producing a high competition score.

---

## 3. Remaining `UNVERIFIED` Semantics

Per Phase 0 live evidence, these semantics remain **UNVERIFIED** and are explicitly withheld from scoring upgrades:

1. **`creator_number` scope** (`/detail` only): Whether count represents 7-day active creators, creators with `>=1` attributed sale, or lifetime cumulative affiliates is unverified. Held at `UNAVAILABLE`/`UNVERIFIED` in `validatedMetrics`.
2. **`product_review_count` scope** (`/detail` only): Whether count is lifetime PDP reviews or window-scoped reviews is unverified. Held at `UNAVAILABLE`/`UNVERIFIED`.
3. **`revenue_growth_rate` comparison baseline** (`/rank` only): Percentage-point unit is verified, but exact comparison window (e.g., prior 7 days vs week-over-week) and zero-baseline encoding remain `UNVERIFIED`. Flagged with `UNVERIFIED_COMPARISON_PERIOD` so V2 scoring keeps `growthStatus = 'UNVERIFIED'` and `growthBoost = 0`.
4. **`commission_rate` plan type & sub-1% encoding**: Open-plan vs targeted-plan commission attribution and `0 < val < 1` representation remain `UNVERIFIED`.
5. **`revenue` gross vs net-of-refunds**: THB currency scale is verified, but gross GMV vs net-of-refunds/cancellations remains `UNVERIFIED`.
6. **Product `rating`**: Not returned by `/tiktok/product/rank` or `/tiktok/product/detail` (`need_extra: true`). Remains `UNAVAILABLE`.
7. **Untested Endpoints**: `/tiktok/product/analysis` (`0.50 cr`), `/tiktok/product/comment/insight` (`1.00 cr`), and `last30Day` responses were not called live to conserve credits and remain unverified.

---

## 4. Scoring Impact

No Commercial Scoring V2 formulas or weights were altered. Impact from fixing live field mappings:

- **Earning Dimension (Unlocked)**: Previously `INSUFFICIENT` (`null`) on 100% of live products because `commission_rate` was blocked as `UNVERIFIED`. Now scores accurately (`SCORED`, verified `commissionPercent` + synthetic `commissionThb`) on all live products with `commission_rate` in `1..100`, while `0` remains strictly `NOT_MONETIZABLE`.
- **Demand Dimension (Accurate)**: Scores from verified `revenue` + `sales_volumn` (`SCORED`). `revenue_growth_rate` contributes `0` boost (`growthStatus = 'UNVERIFIED'`) until comparison baseline is confirmed.
- **Competition Dimension (Protected)**: Remains `INSUFFICIENT` (`null`) on both `/rank` and `/detail` so unverified `creator_number` scope cannot inflate competition scores.
- **Customer Quality Dimension (Protected)**: Remains `INSUFFICIENT` (`null`) because `rating` is `UNAVAILABLE` and `product_review_count` scope is `UNVERIFIED`.
- **Overall Commercial Opportunity & Strategies**: On live Kalodata rows today, only 2 of 4 commercial dimensions (Demand + Earning) have verified inputs, so Gate 2 honestly reports `INSUFFICIENT_DATA` (`commercialOpportunityScore = null`, `Data Confidence = LOW`, `0` falsely qualified strategies) rather than fabricating a top-tier score from missing Competition/Quality data. Conversion Evidence (`video_revenue` / `live_revenue` share) and Demand + Earning dimension scores are fully visible and accurate.

---

## 5. API Credit Optimization

- **Implemented (Zero Extra Cost on Repeat Layer Requests)**:
  - Added 30-minute server-side per-layer TTL caches (`detail`, `specs`, `comments`) and in-flight deduplication in `server/kalodata.ts`.
  - Shared `/tiktok/product/detail` cache between `fetchSingleKalodataProductById` and `enrichSingleKalodataProduct`: opening Video Studio after a single-link lookup now spends **`0.00 cr`** instead of re-billing `0.20 cr`.
  - Marked `deepInsights.fetchedDetails = true` on all `/detail` products in `server/productService.ts` and persisted full `/detail` metrics in browser `localStorage` so Studio UI does not pre-check already-fetched details.
- **Recommended Next Optimization (Not Changed Yet to Preserve Current UX Contract)**:
  - `src/App.tsx` currently sends `forceRefresh: true` on every Search click, bypassing `server/kalodata.ts`'s existing 10-minute `searchCache`. Switching default Search to `forceRefresh: false` (with an explicit "Refresh Live Data" button for `forceRefresh: true`) would eliminate repeat `0.20 cr` charges when users re-run the same keyword/category query within 10 minutes.
  - Keep `/detail` (`0.20 cr`), `/analysis` (`0.50 cr`), and `/comment/insight` (`1.00 cr`) strictly on-demand per selected product (never bulk-enrich all 20 `/rank` rows, which would cost `4.00–34.00 cr` per search).

---

## 6. Remaining Blockers

1. **No Live Product Rating Source**: Neither `/rank` nor `/detail` (`need_extra: true`) returns `rating`, keeping the Customer Quality dimension `INSUFFICIENT` on live data.
2. **Unverified `creator_number` Time-Window Semantics**: Until Kalodata documentation or a controlled live check confirms whether `creator_number` matches the requested 7-day window (and active vs selling creators), Competition remains `INSUFFICIENT`, which prevents Gate 2 (`>= 3` scored dimensions) from assigning an overall Commercial Opportunity composite score or qualifying Competition-gated strategies on live rows.
3. **Unverified `revenue_growth_rate` Comparison Baseline**: Prevents Demand growth boost and `early_market_opportunity` strategy qualification on live rows.
4. **Optional Enrichment Endpoints Untested Live**: `/tiktok/product/analysis` and `/tiktok/product/comment/insight` schemas have not been live-probed yet (deferred to protect remaining `9.90 cr` balance).
