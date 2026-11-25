# SiamVisual — Phase 12: Data Intelligence Completion & Verification

**Date**: 2026-11-25  
**Target Repository**: `ZinLinn254995/SiamVisual`  
**Phase Scope**: Data intelligence completion, zero-credit Kalodata API semantic verification audit, Competition & Customer Quality intelligence assessment, scoring safety audit, and comprehensive verification tests.  
**Kalodata API Credits Consumed in Phase 12**: **`0.00 credits`** (`0` live API requests made; remaining account balance preserved at `8.70 credits` from Phase 11).

---

## 1. Repository Baseline

- **Completed Prior Phases**: Phases 0–11 verified present in workspace, including:
  - Phase 0 live Kalodata API contract verification (`docs/quality/kalodata-api-contract-verification.md`)
  - Phase 1–6 metric validation foundation (`src/lib/metricFoundation.ts`), Commercial Scoring Engine V2 (`src/lib/scoringEngineV2.ts`), Strategy Engine V2 (`src/lib/strategyEngineV2.ts`), UI migration (`src/lib/productIntelligenceView.ts`), and real-world scenario tests
  - Phase 7 mobile & UX audit
  - Phase 8 live data integration audit (`docs/quality/phase8-live-data-integration-audit.md`)
  - Phase 9 real product discovery & ranking validation (`docs/quality/phase9-real-product-validation.md`)
  - Phase 10 competition & video opportunity intelligence (`src/lib/discoveryShortlist.ts`, `src/lib/snapshotStore.ts`, `docs/quality/phase10-competition-video-opportunity-intelligence.md`)
  - Phase 10.1 snapshot trust-boundary & per-metric timestamp hardening (`docs/quality/phase10.1-snapshot-integrity-hardening.md`)
  - Phase 11 live product discovery validation & historical intelligence (`docs/quality/phase11-live-discovery-historical-validation.md`)
- **Pre-Phase-12 Test Baseline**: 13 test suites (`tests/*.test.ts`), `103/103` passing.
- **Git / Branch State (Honest Workspace Note)**: The AI Studio workspace runtime (`/app/applet`) does not contain a `.git` directory (`git status` returns `fatal: not a git repository`). No commit SHA or branch is fabricated in this report; changes must be committed to branch `feature/phase12-data-intelligence` when exporting/syncing to GitHub.

---

## 2. API Metric Verification Matrix (Zero-Credit Audit)

Evidence sources: live captured Kalodata responses from Phase 0 (`2026-04-04`), Phase 9 (`2026-11-25`), and Phase 11 (`2026-11-25`) across `POST /openapi/v1/tiktok/product/rank` (`last7Day`, `country: "TH"`) and `POST /openapi/v1/tiktok/product/detail` (`need_extra: true`, `last7Day`, `country: "TH"`), cross-checked against public Kalodata Open API v1 documentation.

| # | Metric | Endpoint(s) | Exact Response Field(s) | Data Type | Unit | Time-Window Semantics | Verification Status | Scoring Suitability | Extra Requests / Credits |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Creator Count** | `/tiktok/product/detail` (`need_extra: true`); absent (`0/20`) on `/rank` | `creator_number` | Integer (`number`) | `UNVERIFIED` (raw integer count) | **Unconfirmed**: active creators in window vs selling creators (`>=1` sale) vs lifetime affiliates not proven | **UNVERIFIED** (quarantined) | **Excluded** from Competition scoring (`INSUFFICIENT`) | `+0.20 cr` / product on `/detail` |
| 2 | **Product Review Count** | `/tiktok/product/detail` (`need_extra: true`); absent (`0/20`) on `/rank` | `product_review_count` | Integer (`number`) | `UNVERIFIED` (raw integer count) | **Unconfirmed**: live values (`44,372`–`59,540` vs `3,257` 7d sales) strongly suggest cumulative PDP total, but unconfirmed by contract | **UNVERIFIED** (quarantined) | **Excluded** from Customer Quality scoring | `+0.20 cr` / product on `/detail` |
| 3 | **Product Rating** | Absent (`0/20`) on `/rank` and absent on `/detail` (`need_extra: true`) | None returned on integrated endpoints | `null` (`UNAVAILABLE`) | `UNVERIFIED` / N/A | N/A on tested endpoints; candidate endpoint `/tiktok/product/comments` is unprobed | **UNAVAILABLE** | **Excluded**; never fabricated or treated as `0` | Requires unprobed endpoint (cost unverified) |
| 4 | **Revenue Growth Rate** | `/tiktok/product/rank` (`20/20`); absent on `/detail` | `revenue_growth_rate` | Float (`number`, e.g. `17.75`, `-44.25`) | `PERCENT` (percentage-point scale **VERIFIED**) | **Baseline unconfirmed**: exact comparison period (preceding 7d vs rolling window) and zero-baseline encoding unverified | **PARTIALLY VERIFIED** (unit verified; baseline `UNVERIFIED`) | **Quarantined** from verified Demand growth boost (`growthStatus: 'UNVERIFIED'`) | Included in `/rank` (`0.10 cr`/call) |
| 5 | **Commission Rate** | `/rank` (`20/20`) & `/detail` (`2/2`) | `commission_rate` | Float (`number`, e.g. `7`, `20`, `0`) | `PERCENT` (percentage-point scale **VERIFIED** for `0` and `1–100`) | Open-plan vs targeted-plan commission semantics remain unverified; `0 < x < 1` sub-1% quarantined | **VERIFIED UNIT** (`0` & `1–100`); `0 < x < 1` quarantined | **Eligible** for Earning Score V2 (`0%` -> `NOT_MONETIZABLE`) | Included in `/rank` & `/detail` |
| 6 | **Revenue** | `/rank` (`20/20`) & `/detail` (`2/2`) | `revenue` | Float (`number`) | `THB` (**VERIFIED**; `video + live + shopping_mall ≈ revenue`) | Matches requested window (`last7Day`); gross GMV vs net-of-refunds unconfirmed | **VERIFIED** (currency & window scale) | **Eligible** for Demand Score V2 & RPC denominator | Included in `/rank` & `/detail` |
| 7 | **Sales Volume** | `/rank` (`20/20`) & `/detail` (`2/2`) | `sales_volumn` *(upstream typo)* | Integer (`number`) | `COUNT` (**VERIFIED**; `sales * unit_price ≈ revenue`) | Matches requested window (`last7Day`); gross units vs post-cancellation unconfirmed | **VERIFIED** (count & window scale) | **Eligible** for Demand Score V2 | Included in `/rank` & `/detail` |
| 8 | **Video Revenue** | `/rank` (`20/20`); absent on `/detail` | `video_revenue` | Float (`number`) | `THB` (**VERIFIED**) | Matches requested window (`last7Day`) | **VERIFIED** | **Eligible** for **Conversion Evidence** only (kept strictly separate from Commercial Opportunity) | Included in `/rank` |
| 9 | **Live Revenue** | `/rank` (`20/20`); absent on `/detail` | `live_revenue` | Float (`number`) | `THB` (**VERIFIED**) | Matches requested window (`last7Day`) | **VERIFIED** | **Eligible** for **Conversion Evidence** only | Included in `/rank` |
| 10 | **Showcase / Shopping Mall Revenue** | `/rank` (`20/20`); absent on `/detail` | `shopping_mall_revenue` (adapter also maps `showcase_revenue` alias) | Float (`number`) | `THB` (**VERIFIED**) | Matches requested window (`last7Day`); sums with `video_revenue + live_revenue` to `revenue` | **VERIFIED** | **Eligible** for **Conversion Evidence** & revenue channel reconciliation | Included in `/rank` |

---

## 3. Confirmed and Unconfirmed Semantics (Questions A–E)

### Question A — What does `creator_number` represent?
- **Answer**: **UNCONFIRMED (`UNVERIFIED`)**.
- **Evidence**: Live `/detail` (`need_extra: true`) returns integer values (e.g., `343` for Solomon Mattress, `34` for Nivea). Public third-party summaries of Kalodata's API refer to `creator_number` broadly as creators associated with the product in the selected range, **but no primary Kalodata Open Center field contract or live multi-window (`last7Day` vs `last30Day`) comparison proves** whether `creator_number` counts:
  1. All creators who posted content referencing the product during the timeframe,
  2. Only creators with `>= 1` attributed sale in the timeframe, or
  3. Lifetime/cumulative creators linked to the product.
- **Policy Enforcement**: Remains strictly `unit: 'UNVERIFIED'` (`UNVERIFIED_CREATOR_DEFINITION`) and excluded from `scoreCompetitionDimension`.

### Question B — What does `product_review_count` represent?
- **Answer**: **UNCONFIRMED (`UNVERIFIED`)**.
- **Evidence**: Live `/detail` (`need_extra: true`) returned `59,540` for Solomon Mattress (while 7-day sales were `3,257`) and `44,372` for Nivea (while 7-day sales were `3,005`). The order-of-magnitude gap strongly indicates cumulative lifetime TikTok Shop PDP review count rather than 7-day incremental reviews, **but this has not been confirmed by an authoritative API contract or multi-window check**.
- **Policy Enforcement**: Remains strictly `unit: 'UNVERIFIED'` (`UNVERIFIED_REVIEW_COUNT`) and excluded from `scoreCustomerQualityDimension`.

### Question C — Can product `rating` be obtained from another Kalodata endpoint?
- **Answer**: **UNAVAILABLE on integrated endpoints; candidate endpoint unprobed**.
- **Evidence**:
  - `POST /openapi/v1/tiktok/product/rank` (`20/20` rows): no rating field returned.
  - `POST /openapi/v1/tiktok/product/detail` (`need_extra: true`): no rating field returned.
  - Public Kalodata Open API v1 documentation indexes `POST /openapi/v1/tiktok/product/comments` ("Product Reviews / Ratings") alongside `/tiktok/product/comment/insight` (qualitative review insights, `~1.0 cr`/call).
  - `/tiktok/product/comments` has **not been probed live** (zero-credit constraint). Whether it returns an aggregate average star rating (`0–5`), paginated individual review star ratings, or requires high per-product credit spend is **UNVERIFIED**.
- **Policy Enforcement**: `rating` remains strictly `state: 'UNAVAILABLE'`, `value: null`, classified as `'unavailable'` (never `'unverified'` and never `0`).

### Question D — What comparison period does `revenue_growth_rate` use?
- **Answer**: **Unit VERIFIED (`PERCENT`); comparison baseline UNCONFIRMED (`UNVERIFIED_COMPARISON_PERIOD`)**.
- **Evidence**: Live `/rank` returns percentage-point floats (e.g. `17.75`, `-11.76`, `-44.25`). No primary contract or multi-day live reconciliation has confirmed whether `last7Day` compares against the immediately preceding 7 days (days `-14..-8`), a rolling average, or how zero-baseline products are encoded (`0`, `100`, `null`, or capped).
- **Policy Enforcement**: `scoreDemandDimension` tags `growthStatus: 'UNVERIFIED'` and withholds the verified growth adjustment (`verifiedGrowthPercent: null`). Missing or unverified growth is never treated as verified `0%` growth.

### Question E — Are there other Kalodata endpoints that provide competition intelligence?
- **Answer**: **Candidate endpoints exist in Kalodata Open API v1, but none are verified or integrated**.
- **Evidence**: Public Kalodata Open API v1 lists:
  - `/openapi/v1/tiktok/creator/rank` and `/openapi/v1/tiktok/creator/detail`
  - `/openapi/v1/tiktok/video/rank` and `/openapi/v1/tiktok/livestream/rank`
  - `/openapi/v1/tiktok/shop/rank` and `/openapi/v1/tiktok/shop/detail`
- **Unverified gaps**: It is not yet verified whether `/tiktok/creator/rank` supports filtering by `product_id` to retrieve active selling creator counts, top-creator revenue share (concentration), or per-creator GMV, nor what its exact credit cost per product would be.

---

## 4. Competition Data Assessment

- **Current Competition Engine Inputs (`scoreCompetitionDimension`)**:
  - Requires **verified `SOURCE` `creatorCount` (`unit: 'COUNT'`, no unverified semantic note)** AND **verified `SOURCE` `revenueThb7d` (`unit: 'THB'`, never `SYNTHETIC`)**.
  - Computes Laplace-smoothed `adjustedRpcThb = revenue / (creators + 5)`, `creatorDensityScore`, and `demandViabilityFactor` — with `ZERO_CREATORS_POSITIVE_REVENUE` capped at `55` and `rawRpcThb: null` (never `Infinity`).
- **Missing Competition Signals**:
  - Verified active-window creator count (currently blocked on Question A)
  - Creator revenue concentration (e.g., whether 1 mega-creator drives 90% of GMV vs 20 mid-tier creators)
  - Active selling creator count vs posting creator count
  - Paid ad saturation / Spark Ads intensity
- **Reliable Fallback Classification (`src/lib/dataIntelligence.ts` — `assessCompetitionIntelligence`)**:
  - When verified competition data is absent, SiamVisual never invents creator counts, never guesses ad saturation, and never equates high video sales with low competition. Instead it returns deterministic fallback states:
    - `FALLBACK_UNVERIFIED_CREATOR_SCOPE` (`/detail` `creator_number` present, semantics unverified; surfaces `rawUnverifiedCreatorNumber` strictly as unverified context while keeping `verifiedCreatorCount: null` and `score: null`)
    - `FALLBACK_UNAVAILABLE_ON_ENDPOINT` (`/rank` omits creator count)
    - `FALLBACK_MISSING_CREATOR_DATA`
    - `FALLBACK_MISSING_REVENUE_FOR_RPC` (verified creator count without verified `SOURCE` revenue — e.g. synthetic revenue rejected)
    - `FALLBACK_STALE_DATA` (`>24h` old)
    - `FALLBACK_INVALID_DATA` (malformed/negative/future timestamp)
- **Strict Separation Preserved**: Competition remains completely independent from Demand, Affiliate Earning, Conversion Evidence (video/live channel split), and Video Suitability (`0%` commercial weight).

---

## 5. Customer Quality Data Assessment

- **Current Status**:
  - `rating` is **`UNAVAILABLE`** on all integrated Kalodata endpoints (`/rank` and `/detail` with `need_extra: true`).
  - `product_review_count` is **`UNVERIFIED`** on `/detail` and **`MISSING`** on `/rank`.
- **Policy & Fallback (`src/lib/dataIntelligence.ts` — `assessCustomerQualityIntelligence`)**:
  - Missing/unavailable `rating` is **never fabricated**, **never defaulted to a neutral mean**, and **never coerced to `0`**.
  - Unverified `product_review_count` is **never promoted** into `scoreCustomerQualityDimension`, even if a verified rating were supplied.
  - Fallback states cleanly distinguish: `FALLBACK_UNAVAILABLE_RATING`, `FALLBACK_UNVERIFIED_QUALITY_SCOPE`, `FALLBACK_ZERO_REVIEWS`, `FALLBACK_MISSING_QUALITY_DATA`, `FALLBACK_STALE_QUALITY_DATA`, and `FALLBACK_INVALID_QUALITY_DATA`.
- **Impact on Ranking & Strategy Eligibility**:
  - Because `rating` is `UNAVAILABLE` and `creatorCount` is `UNVERIFIED`/`MISSING` on live Kalodata data, live products score `2/4` verified commercial dimensions (Demand + Earning).
  - Commercial Scoring Gate 2 (`minScoredDimensions = 3`) honestly holds `commercialOpportunityScore: null` and `eligibilityStatus: 'INSUFFICIENT_DATA'`, and `Trust-Based Winners` remains `INSUFFICIENT_DATA` rather than issuing false quality endorsements.
  - `Data Confidence` reflects this gap accurately (`LOW` / `~42/100` on `/rank` rows).

---

## 6. Scoring Safety Audit & Surgical Hardening

All 8 scoring safety invariants were audited across `src/lib/metricFoundation.ts`, `src/lib/scoringEngineV2.ts`, `src/lib/strategyEngineV2.ts`, `src/lib/discoveryShortlist.ts`, `src/lib/productIntelligenceView.ts`, `src/lib/storage.ts`, `src/lib/snapshotStore.ts`, `server/kalodata.ts`, and `server/productService.ts`:

1. **Missing values are never treated as zero**: Confirmed across `validateNumericMetric`, `adaptRawKalodataRowToValidatedMetrics`, `scoreDemandDimension`, `scoreCompetitionDimension`, and `scoreCustomerQualityDimension`.
2. **Unverified metrics never enter verified scoring**: Confirmed via `isUsableScoringMetric` (`unit !== 'UNVERIFIED'`), `isVerifiedGrowthMetric` (`UNVERIFIED_COMPARISON_PERIOD` guard), and **hardened in Phase 12** with defensive unverified-semantic note guards on `creatorCount`, `rating`, and `reviewCount` in `scoringEngineV2.ts`.
3. **Stale metrics (`>24h`) are excluded and reduce confidence**: Confirmed via `refreshProductValidatedMetricsFreshness` and `evaluateProductCommercialV2`. **Hardened in Phase 12**: expanded `STALE_DATA` risk tag detection in `evaluateProductCommercialV2` to cover all core/evidence metrics (`priceThb`, `revenueThb7d`, `salesVolume7d`, `commissionRate`, `videoRevenueThb7d`, `liveRevenueThb7d`, `revenueGrowthRate`, `creatorCount`, `rating`, `reviewCount`).
4. **Zero commission is always `NOT_MONETIZABLE`**: Confirmed (`commercialOpportunityScore: 0`, `earningScore.status: 'NOT_MONETIZABLE'`, blocked from all strategies and `BLOCKED` on `discoveryShortlist`).
5. **Weak demand cannot receive high commercial scores**: Confirmed (`RESTRICTED_WEAK_DEMAND` caps commercial score at `54`).
6. **Extreme competition cannot appear as low competition**: Confirmed (`EXTREME_COMPETITION` risk flag, Laplace smoothing prevents low-creator inflation, zero-creator positive revenue capped at `55` with `rawRpcThb: null`).
7. **Video suitability never alters commercial scores**: Confirmed (`0%` weight in `scoringEngineV2.ts`; Conversion Evidence is tracked separately).
8. **Six-state provenance accuracy (`productIntelligenceView.ts`)**: **Fixed defect in Phase 12** where `classifyMetricProvenance` checked `metric.unit === 'UNVERIFIED'` before `metric.state === 'MISSING'` / `'UNAVAILABLE'`, causing `rating` (`state: 'UNAVAILABLE', rawInput: undefined`) to be misclassified as `'unverified'` instead of `'unavailable'` and `/rank` missing `creatorCount` to be misclassified as `'unverified'` instead of `'missing'`.
9. **No V2 commercial formula changes**: All V2 weights, thresholds, caps, and eligibility gates remain 100% unchanged.

---

## 7. Remaining Limitations

1. **Live Competition Verification Blocked on Kalodata Semantics**: Until `creator_number` window/scope semantics are verified (or a creator-level product endpoint is verified), live Kalodata products cannot receive a verified Competition score.
2. **Live Customer Quality Blocked on Rating Availability**: Kalodata `/rank` and `/detail` (`need_extra: true`) do not return star ratings (`rating`), and `product_review_count` scope remains unverified.
3. **Composite Commercial Score on Live Kalodata Data**: Because Competition and Customer Quality are withheld on live rows, Gate 2 (`>=3` verified dimensions) rightly holds `commercialOpportunityScore` at `null` (`INSUFFICIENT_DATA`) and relies on `discoveryShortlist` preliminary discovery tiers (`VIDEO_DEMAND_CANDIDATE`, `WATCHLIST`) rather than falsely claiming `ELIGIBLE` or `HIGH_PRIORITY_VIDEO_OPPORTUNITY`.
4. **Growth Comparison Baseline Unverified**: `revenue_growth_rate` remains quarantined until baseline window semantics are proven; historical multi-day snapshot trends (`snapshotStore.ts`) require `>= 3` verified live capture days per product (`0` verified multi-day histories accumulated yet).
5. **Legacy V1 Server Fields**: `server/kalodata.ts` retains legacy V1 fields (`salesVolume7d`, `revenueThb7d`, `revenueGrowthRate`) solely for backwards-compatible V1 serialization; all V2 scoring, strategies, shortlists, and UI views consume `validatedMetrics` and `kalodataMetrics` (which never fabricate values).

---

## 8. Recommended Phase 13 Work

1. **Low-Credit Semantic Verification Probes (Requires Explicit User Approval Before Execution)**:
   - **Probe 1 (`0.20 cr`)**: Query `/tiktok/product/detail` (`need_extra: true`) on one previously captured product (`1731661332013680778`) with `last30Day` and compare `creator_number` and `product_review_count` against the captured `last7Day` values (`343` and `59,540`) to empirically determine whether each field is window-scoped or lifetime-cumulative.
   - **Probe 2 (Credit cost check first / `~0.10–0.20 cr`)**: Probe `POST /openapi/v1/tiktok/product/comments` (if supported by account tier) to check whether aggregate star rating is returned and evaluate credit efficiency.
   - **Probe 3 (`~0.10–0.20 cr`)**: Probe `POST /openapi/v1/tiktok/creator/rank` with `product_id` filter (if supported) to assess whether active selling creator count and top-creator GMV concentration can be verified.
2. **Multi-Day Live Snapshot Accumulation**: Run periodic `/rank` captures across 3+ distinct days on a stable Thailand category cohort so `snapshotStore.ts` can produce verified multi-day revenue/sales velocity trends independent of Kalodata's unverified `revenue_growth_rate` baseline.
3. **Commit & Push**: Sync workspace to GitHub branch `feature/phase12-data-intelligence` and verify CI checks.

---

## 9. API Credit Usage

| Metric | Value |
|---|---|
| Live Kalodata API Requests in Phase 12 | `0` |
| Kalodata Credits Consumed in Phase 12 | **`0.00 credits`** |
| Remaining Account Balance (from Phase 11) | **`8.70 credits`** (unchanged) |
| External Paid Probes Executed | None (all candidate probes deferred pending explicit user approval) |
