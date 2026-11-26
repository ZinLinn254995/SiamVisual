# SiamVisual — Phase 17: Verified Daily `revenue_trend` & Probe P1 Provenance Integration

**Date (UTC):** `2026-11-26`  
**Repository:** `ZinLinn254995/SiamVisual`  
**Live Kalodata API Calls Executed in Phase 17:** **`0`**  
**Kalodata Credits Consumed in Phase 17:** **`0.00 credits`** (Account balance preserved at **`8.30 credits`**)  
**Commercial Scoring Formula / Weights / Eligibility Gates Modified:** **NO**

---

## 1. Objective

Integrate the empirically verified findings from **Phase 16 Live Probe P1** into SiamVisual's extraction pipeline, evidence layer, and UI with **zero extra Kalodata credits** and **zero weakening of `scoringEngineV2` or `strategyEngineV2` gates**:

1. **Verified Daily THB `revenue_trend` (`VERIFIED`):** Extract, reconcile, and analyze daily THB revenue arrays (`7` days on `last7Day`, `30` days on `last30Day`) returned by `POST /tiktok/product/detail` to immediately compute mathematically auditable `DERIVED` 7d-over-previous-7d revenue growth and daily revenue stability on Day 1.
2. **Window-Scoped `creator_number` (`PARTIALLY_VERIFIED`) & Cumulative `product_review_count` (`VERIFIED` lifetime scope):** Present honest, scope-accurate informational context in Product Evidence Summary and Score Detail Dialog while keeping Competition Score and Customer Quality Score strictly `INSUFFICIENT_DATA` (`null`) until selling-creator breakdown / concentration and star rating are verified.
3. **Optional `7d` / `30d` Detail Window Selector (Same `0.20 cr` Cost):** Allow users in Video Studio enrichment controls to choose `7d` (default, coherent with `last7Day` `/rank` discovery) or `30d (Daily Trend)` (for immediate 30-day daily sparkline + 7d-vs-prev-7d derived growth) with isolated per-window server cache keys.

---

## 2. Files Added & Updated

- **`src/lib/revenueTrendAnalyzer.ts` (New):**
  - `sanitizeRevenueTrendArray`: Strictly validates finite non-negative daily THB arrays (`1..90` elements), rejecting negatives, `NaN`, strings, and empty arrays.
  - `analyzeDetailRevenueTrend`: Reconciles `sum(dailyValues)` against `reportedRevenueThb` (`tolerance = max(50 THB, 2%)`), flags sum mismatches as `INCOMPARABLE_DATA`, handles `ZERO_BASELINE` / `ALL_ZERO` without division-by-zero, computes `last7dSumThb` vs `prev7dSumThb` + `growth7dPct` + `firstHalf` vs `secondHalf` + `volatilityCv` + `activeRevenueDays`, and outputs transparent classifications (`RISING`, `STABLE`, `DECLINING`, `VOLATILE`, `INSUFFICIENT_HISTORY`, `INCOMPARABLE_DATA`).
- **`src/types.ts`, `server/kalodata.ts`, `server.ts`, `src/lib/storage.ts`:**
  - Extended `ProductKalodataMetrics` with optional `revenueTrendThb`, `videoCount`, `liveCount`, `launchDate`, `deliveryType`.
  - Extended `ProductEnrichOptions`, `POST /api/products/enrich`, and `enrichSingleKalodataProduct` with optional `dateRange?: 'last7Day' | 'last30Day'` and isolated `detail|${dateRange}|${productId}` cache keys.
  - Preserved all new `/detail` fields across coherent `mergeKalodataMetrics` merges.
- **`src/lib/productEvidenceSummary.ts`, `src/components/ScoreDetailDialog.tsx`, `src/components/VideoStudioView.tsx`, `src/i18n.ts`:**
  - Exposed `detailRevenueTrend` on `ProductEvidenceSummary` and surfaced derived 30d trend in Derived Calculations.
  - Added a clean inline SVG Daily Revenue Trend sparkline + stats card + Probe P1 informational Active Creators / Lifetime Reviews strip inside `ScoreDetailDialog` (strictly separated from Commercial Opportunity Score).
  - Added a compact `7d` / `30d (Daily Trend)` toggle inside `VideoStudioView` Product Details enrichment card.
- **`tests/phase17RevenueTrendAndProbeP1Integration.test.ts` (New):**
  - 5 comprehensive test groups validating real Probe P1 Solomon Mattress 30d data (`+12.51%`, `0.01 THB` sum reconciliation), 7d honest window behavior, zero-baseline/all-zero/declining/stable/volatile/mismatch/invalid edge cases, strict `scoringEngineV2` gate preservation, evidence summary notes, storage merges, and mocked 7d/30d cache isolation.
