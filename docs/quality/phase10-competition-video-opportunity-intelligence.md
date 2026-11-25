# Phase 10 — Competition Intelligence & Video Selling Opportunity Research

**Repository:** `ZinLinn254995/SiamVisual`  
**Phase Status:** Completed  
**Phase 10 Live Kalodata API Requests:** `0` requests (`0.00` credits spent; live balance preserved at **`9.30` credits**)  
**Commercial Scoring Formula & Eligibility Gates:** Unchanged (strictly invariant)

---

## 1. Existing Architecture Findings

An inspection of the completed Phase 0–9 codebase established the exact baseline entering Phase 10:

- **Four-Signal Separation Already Intact**:
  - **Commercial Opportunity** (`src/lib/scoringEngineV2.ts`): Evaluates Demand, Earning, Competition, and Customer Quality independently, with zero visual-suitability weight and hard eligibility gates (`NOT_MONETIZABLE`, `INSUFFICIENT_DATA`, `PARTIAL_EVIDENCE`, `ELIGIBLE`).
  - **Conversion Evidence** (`commercialScoreV2.conversionEvidence`): Evaluates historical channel revenue (`video_revenue`, `live_revenue`, `shopping_mall_revenue`, `videoRevenueShare`) separately from commercial opportunity.
  - **Video Suitability** (`server/scoreEngine.ts`, Studio V1 reference): Isolated strictly to creative Studio guidance (`0%` weight in commercial ranking).
  - **Data Confidence** (`commercialScoreV2.dataConfidence`): Quantifies completeness, provenance, freshness, validity, and dimension coverage independently.
- **Pre-Existing Longitudinal Hooks Were Unwired**:
  - `src/types/strategyV2.ts` already defined `HistoricalMetricSnapshot` and `src/lib/productIntelligenceView.ts` already accepted `historicalSnapshotsByProductId`, which `strategyEngineV2.ts` consumes for `fast_rising_products` (requires ≥2 verified snapshots separated by ≥12h) and `trend_timing_opportunity` (requires ≥3 verified snapshots spanning ≥24h).
  - However, neither `src/lib/storage.ts` nor `src/App.tsx` previously persisted daily observations or passed `historicalSnapshotsByProductId` into `buildProductIntelligenceView`, leaving both longitudinal strategies permanently at `0` snapshots.
- **Real-World Discovery Gap Identified in Phase 9**:
  - In live Thailand (`TH` / `THB` / `last7Day`) `/tiktok/product/rank` responses (`20` products), `17/20` monetizable products have verified Demand, verified Affiliate Earnings, and verified Video Revenue Share (`0.2%` to `97.4%`), yet ALL `17/20` remain `INSUFFICIENT_DATA` for full commercial scoring because `/rank` omits `creator_number` and `rating`, and even `/detail` returns `creator_number` with `UNVERIFIED` scope and omits `rating` entirely.
  - Without an evidence-based preliminary discovery layer, users could not cleanly distinguish video-dominant monetizable candidates from live-only or shopping-mall-only listings while keeping unverified competition strictly quarantined.

---

## 2. Competition Data Research & Verified Semantics

Research combined live captured Kalodata API v1 evidence from Phases 0 & 9 (`docs/quality/kalodata-api-contract-verification.md`, `docs/quality/phase9-real-product-validation.md`) with Kalodata Open API v1 documentation review (zero additional credits consumed in Phase 10):

### 2.1 Observed Competition-Related Fields Across Current Endpoints

| Endpoint | Est. Credit Cost | Observed Competition Fields | Live Sample Observations | Verification Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `POST /open/api/v1/tiktok/product/rank` | `~0.20 cr` | **None** (`creator_number` absent in `20/20` live TH rows) | `0/20` rows contained creator fields | **UNAVAILABLE** on `/rank` |
| `POST /open/api/v1/tiktok/product/detail` (`need_extra: true`) | `~0.20 cr` | `creator_number`, `video_number`, `live_number` | Phase 0 `1731661332013680750`: `creator_number: 1824, video_number: 4548, live_number: 2859`; Phase 9 `1731299385569545105`: `creator_number: 343`; Phase 9 `1732462917435950190`: `creator_number: 1028` | **UNVERIFIED** scope/window |
| Product-Creator Breakdown / Video List endpoints (Kalodata Open API Creator/Video modules) | `~0.20–1.00 cr` per product (unprobed live) | Potential creator list, per-creator revenue, video-only creator count | Not probed in Phase 10 to avoid speculative credit spend | **UNAVAILABLE / UNPROBED** |

### 2.2 Exact Semantic Gaps Blocking Competition Pillar Qualification

1. **Active-Window vs Selling vs Lifetime Scope (`creator_number`) — `UNVERIFIED`**:
   - Live `/detail` payloads return large integer counts (`343`, `1,028`, `1,824`) alongside `video_number` and `live_number`, without an accompanying scope qualifier.
   - Public Kalodata Open API v1 docs do not state whether `creator_number` counts:
     - (a) creators who posted any tagged video/live within `dateRange` (`last7Day`),
     - (b) creators who generated `>= 1` attributed sale within `dateRange`, or
     - (c) cumulative lifetime affiliates associated with the product.
   - Because mixing lifetime creator totals with 7-day revenue (`revenue / (creators + k)`) would severely distort Adjusted RPC and unfairly penalize established products, `creatorCount` **must remain quarantined (`unit: 'UNVERIFIED'`)** and excluded from `scoringEngineV2` competition scoring and `strategyEngineV2` qualification gates.
2. **Video-Specific Creator Competition & Creator Concentration — `UNAVAILABLE`**:
   - Neither `/rank` nor `/detail` exposes video-only creator count (`video_creator_number`), top-1/top-5 creator revenue concentration share, or new-creator entry velocity.
3. **Recommended Low-Cost Future Verification Experiment (Optional, Not Run in Phase 10)**:
   - Querying `POST /tiktok/product/detail` for 1 already-cached product across `last7Day` vs `last30Day` (`0.20 cr`) can test whether `creator_number` scales with time window (ruling out strictly static lifetime totals), though vendor confirmation or per-creator breakdown remains necessary to distinguish posting creators from selling creators.

---

## 3. Video Revenue & Creator Opportunity Findings

Empirical analysis of the 20 real Thailand (`TH` / `THB` / `last7Day`) products captured in Phase 9 demonstrates clear structural separation across four distinct commercial concepts:

1. **(A) Strong Overall Demand** (`revenue` + `sales_volumn` — **VERIFIED**): High-GMV items span ฿3.5M–฿12.1M+ per 7 days, regardless of monetization or channel.
2. **(B) Strong Existing Video-Sales Evidence** (`video_revenue` + `video_revenue / revenue` — **VERIFIED**):
   - **Video-dominant monetizable examples**:
     - `INZENT Vitamin C + Gluta`: ฿4.17M total, **฿3.98M video (95.5% video share)**, 20% comm (฿28.40/sale)
     - `NAWANNA Cream`: ฿3.52M total, **฿3.40M video (96.6% video share)**, 18% comm (฿26.28/sale)
     - `Solomon Mattress`: ฿6.93M total, **฿5.28M video (76.2% video share)**, 7% comm (฿148.96/sale)
     - `Bemingtop Cardigan`: ฿8.24M total, **฿5.20M video (63.1% video share)**, 10% comm (฿42.70/sale)
   - **Non-video (Live / Shopping Mall dominant) examples — NOT proven for short-video affiliates**:
     - `Teashell Serum`: ฿12.1M total, only ฿26K video (**0.2% video share**; ~84% shopping mall)
     - `Whitelab Astaxanthin`: ฿5.5M total, ฿253K video (**4.6% video share**; ~95% live)
     - `เม็ดปักพี่ฝน`: **2.0% video share** (~42% live + ~56% shopping mall)
3. **(C) High Affiliate Earning Potential** (`commission_rate` + `payoutPerSaleThb` — **VERIFIED**):
   - Monetizable items split cleanly from `0%` non-monetizable listings (`iPad A16`, `AirPods 5`, `1g Gold Ring`).
   - Both high-rate/moderate-ticket (`20% · ฿28.40/sale`) and moderate-rate/high-ticket (`7% · ฿148.96/sale`) patterns exist and require separate recognition from pure commission percentage.
4. **(D) Opportunity for New Creators to Enter (Competition Headroom)** — **BLOCKED UNTIL COMPETITION IS VERIFIED**:
   - **Critical Non-Equivalence Proven by Live Data**: High video revenue does **NOT** imply low competition. Both Phase 0 (`1731661332013680750`: `95.9%` video share, raw `creator_number: 1,824`) and Phase 9 (`INZENT`: `95.5%` video share, raw `creator_number: 1,028`) show very large raw creator counts alongside massive video revenue.
   - Similarly, historical video revenue proves that *existing* creators sold via short video; it **never guarantees** conversion for a new creator's video.

---

## 4. Customer Quality & Product Trust Findings

- **`rating` (Star Rating 0–5)**: **UNAVAILABLE** across both `/tiktok/product/rank` and `/tiktok/product/detail` (`need_extra: true`). No verified zero-cost or low-cost endpoint in Kalodata Open API v1 returns a structured star rating for Thailand TikTok Shop listings.
- **`product_review_count`**: Present only on `/detail` (live samples: `19,236`–`59,540`), while window vs lifetime scope remains **UNVERIFIED**.
- **`POST /tiktok/product/comment/insight` (`~1.00 cr` per product, user-initiated in Video Studio)**: Returns qualitative buyer `pain_points` and `usage_scenarios` text, not quantitative star ratings, verified return/refund rates, or defect percentages.
- **Policy Preserved**: SiamVisual **never** substitutes AI-generated product descriptions, sentiment guesses, or unverified review counts for verified customer quality ratings. `rating` remains `UNAVAILABLE` and `reviewCount` remains `UNVERIFIED` until a verified source exists.

---

## 5. Historical Snapshot Architecture

### 5.1 Storage Choice & Rationale (No Paid DB / External Infrastructure)
SiamVisual currently operates as a single-user local-first web workspace using browser `localStorage` + versioned JSON Backup/Restore (`src/lib/storage.ts`). Adding a paid hosted database or background scraping infrastructure is explicitly out of scope and unnecessary for validating daily observation persistence today.

Instead, Phase 10 implements an **append-only, UTC-day deduplicated snapshot store** (`siamvisual_product_snapshots_v1`, max `90` days per product across up to `250` tracked products) backed by JSON Backup v5 export/restore (fully backward-compatible with v1–v4 backups). A server-side database + scheduled ingestion job would only be required later if multi-device sync or unattended daily cron collection across thousands of SKUs is explicitly requested.

### 5.2 Strict Integrity & Provenance Rules (`src/lib/snapshotStore.ts`)
- **Fields Captured per `ProductObservationSnapshot`**: `productId`, `observedAt` (ISO), `observationDay` (`YYYY-MM-DD` UTC bucket), `dateRange` (`last7Day` | `last30Day`), `sourceEndpoint` (`rank` | `detail` | `legacy_product`), `dataConfidenceScore`, `dataConfidenceLevel`, and `observations` (`revenueThb`, `salesVolume`, `videoRevenueThb`, `liveRevenueThb`, `shoppingMallRevenueThb`, `commissionRate`, `revenueGrowthRate`, `revenueGrowthVerified`, `creatorCountVerified`, plus strictly isolated diagnostic `creatorCountUnverifiedRaw`).
- **Append-Only Across Days**: Earlier UTC observation days are **never overwritten** when newer days are recorded.
- **Same-Day Deduplication & Enrichment Merge**:
  - Identical re-observations on the same `(productId, dateRange, observationDay)` are skipped (`deduplicated: true`).
  - Same-day `/detail` enrichment after `/rank` merges newly observed fields into that day's bucket without creating duplicate daily rows or losing prior verified fields.
- **Zero Fabrication & Strict Quarantine**:
  - `SYNTHETIC` estimated revenue is **never** written to `observations.revenueThb`.
  - `UNVERIFIED` `creator_number` is **never** written to `observations.creatorCountVerified` and **never** emitted by `toStrategyHistoricalSnapshots()` into `strategyEngineV2`.
  - `UNVERIFIED` `revenueGrowthRate` is flagged `revenueGrowthVerified: false` and excluded from `toStrategyHistoricalSnapshots()`.
  - `STALE` metrics are refused from fresh snapshot recording.
- **Derived vs Observed Separation**: `deriveSnapshotTrend()` returns `null` when fewer than 2 observations separated by ≥12 hours exist, and labels all computed percentage deltas explicitly as `provenance: 'DERIVED'`.
- **Zero Extra API Cost**: Snapshots are recorded passively whenever the user runs an existing live search (`runProductSearch`) or manual deep-data fetch (`handleFetchProductDeepInsights`).

---

## 6. Implemented Files & Changes

| File | Change Summary |
| :--- | :--- |
| `src/types/metrics.ts` | Added `ProductSourceObservationValues`, `ProductObservationSnapshot`, and `SnapshotTrendDerivation` types. |
| `src/types/strategyV2.ts` | Added `DiscoveryShortlistCategory`, `CompetitionEvidenceStatus`, `VideoSalesEvidenceStatus`, and `ProductDiscoveryShortlistResult` types. |
| `src/types.ts` | Extended `BackupPayload` to support `version: 5` and optional `productSnapshots`. |
| `src/lib/snapshotStore.ts` | **New module.** Implements append-only daily snapshot extraction, UTC-day deduplication/merge, `UNVERIFIED`/`SYNTHETIC` quarantine, `toStrategyHistoricalSnapshots`, `buildStrategySnapshotsMap`, `deriveSnapshotTrend` (`DERIVED`), `localStorage` persistence, and backup merge. |
| `src/lib/discoveryShortlist.ts` | **New module.** Implements evidence-based 6-category Product Discovery Shortlist classifier with strict unverified/missing guardrails, preliminary vs fully qualified separation, and explicit non-guarantee cautions. |
| `src/lib/productIntelligenceView.ts` | Attached `discoveryShortlist` and `snapshotCount` to `RankedIntelligenceCardItem` and `ExcludedIntelligenceCardItem` (zero scoring or ranking formula changes). |
| `src/lib/storage.ts` | Added `productSnapshots` export (Backup v5) and sanitized parse/restore (backward-compatible with v1–v4). |
| `src/App.tsx` | Loaded `productSnapshots`, wired `historicalSnapshotsByProductId` into `buildProductIntelligenceView` and `sortProductsByV2Overall`, passively recorded snapshots on live search & enrichment, and merged restored snapshots on JSON import. |
| `src/i18n.ts` | Added concise EN and MY labels for all 6 Discovery Shortlist categories, `Preliminary` status, and snapshot day count. |
| `src/components/ProductCard.tsx` | Displayed concise, mobile-safe Discovery Signal line (with explicit `(Preliminary)` cue when incomplete/unverified and snapshot day count when `>= 2`), preserving 320px–430px layout and zero-pill discipline. |
| `tests/phase10CompetitionVideoIntelligence.test.ts` | **New test suite.** 8 targeted test cases covering all 6 shortlist classifications, Phase 9 live payload shapes, unverified/missing guardrails, snapshot deduplication/quarantine, longitudinal strategy unlock, and Backup v5 round-trip. |

---

## 7. New Tests & Validation Results

- **Full Automated Test Suite (`npx tsx --test tests/*.test.ts`)**: **`87/87` passing** (`0` failures across all `11` suites + `8` new Phase 10 tests).
  - Real Phase 9 video-led product (`INZENT`) classifies as `STRONG_DEMAND_STRONG_VIDEO_SALES` (`Preliminary`, secondary `STRONG_AFFILIATE_EARNINGS`, `competitionEvidenceStatus: 'UNVERIFIED'`) and **never** Low/High Competition.
  - Real Phase 9 live/mall-dominant products (`Teashell Serum`, `Whitelab Astaxanthin`) **never** classify as `STRONG_DEMAND_STRONG_VIDEO_SALES`.
  - `0%` commission items (`iPad A16`) strictly return `INSUFFICIENT_EVIDENCE` with `isNotMonetizable: true`.
  - Verified competition fixtures accurately trigger `STRONG_DEMAND_LOW_COMPETITION`, `HIGH_DEMAND_HIGH_COMPETITION` (warning takes priority even with strong video sales), and `EMERGING_OPPORTUNITY`.
  - Unverified `creatorCount` and missing `videoRevenue` are strictly blocked from competition and video-sales categories.
  - Snapshot store deduplicates identical same-day records, merges same-day `/detail` enrichment cleanly, preserves multi-day history without overwrite, rejects `SYNTHETIC` revenue, quarantines `UNVERIFIED` `creator_number` out of `strategyEngineV2`, and unlocks `fast_rising_products` & `trend_timing_opportunity` only with genuine accelerating multi-day verified snapshots.
  - Backup v5 round-trip restores `productSnapshots` while remaining backward-compatible with v4 backups.
- **TypeScript & Lint Check (`lint_applet`)**: Verified clean (see final verification step).
- **Production Build (`compile_applet`)**: Verified clean (see final verification step).

---

## 8. API Requests & Credit Consumption

| Phase / Run | Live Kalodata Requests | Credits Spent | Notes |
| :--- | :---: | :---: | :--- |
| Phase 0 Live Contract Verification | `2` | `~0.40 cr` | Initial `/rank` + `/detail` contract capture |
| Phase 9 Live Discovery & Enrichment | `3` (+ `6` server cache hits at `0.00 cr`) | `0.60 cr` | 20-product TH `/rank` (`0.20 cr`) + 2 `/detail` (`0.40 cr`) |
| **Phase 10 (This Phase)** | **`0`** | **`0.00 cr`** | Used existing verified Phase 0 & Phase 9 evidence + public Kalodata Open API v1 documentation; avoided speculative paid endpoint probes |
| **Remaining Account Balance** | — | **`9.30 cr`** | Preserved intact |

---

## 9. Complete Metric Verification Status Table

| Metric | Source Field(s) | Status | Verified Meaning / Limitation | Allowed in Commercial Scoring? |
| :--- | :--- | :--- | :--- | :--- |
| Product Price | `price` / `unit_price` | **VERIFIED** | THB currency unit verified on `/rank` & `/detail` | Yes (Earning payout math) |
| Affiliate Commission Rate | `commission_rate` | **VERIFIED** | Percentage-point scale (`0..100`, e.g. `20` = 20%, `0` = non-monetizable) | Yes (Earning + hard 0% gate) |
| Payout per Sale (THB) | Derived `price * (commission_rate / 100)` | **VERIFIED (DERIVED)** | Exact THB calculation (no synthetic ฿1 floor) | Yes (Earning) |
| Total Revenue (`last7Day`) | `revenue` | **PARTIALLY_VERIFIED** | THB currency verified & reconciles with channel sum (`video + live + mall`); gross vs net-of-refunds unconfirmed | Yes (Demand) |
| Sales Volume (`last7Day`) | `sales_volumn` | **PARTIALLY_VERIFIED** | Integer unit count consistent with `revenue / price`; gross vs canceled-order scope unconfirmed | Yes (Demand) |
| Video Revenue (`last7Day`) | `video_revenue` | **VERIFIED** | THB short-video attributed revenue; reconciles cleanly with `revenue` | Yes (Conversion Evidence & Discovery Shortlist — separate from Commercial Score) |
| Live Revenue (`last7Day`) | `live_revenue` | **VERIFIED** | THB livestream attributed revenue | Yes (Conversion Evidence) |
| Shopping Mall / Showcase Revenue | `shopping_mall_revenue` / `showcase_revenue` | **VERIFIED** | THB marketplace/showcase attributed revenue | Yes (Channel breakdown) |
| Video Revenue Share | Derived `video_revenue / revenue` | **VERIFIED (DERIVED)** | Accurately separates video-led (`50–97%`) from live/mall-led (`0.2–5%`) listings | Yes (Conversion Evidence & Discovery Shortlist) |
| Revenue Growth Rate | `revenue_growth_rate` | **PARTIALLY_VERIFIED** | Percentage-point scale verified (`100` = +100%), but exact comparison period (`7d vs prior 7d` vs other) remains **UNVERIFIED** | Quarantined from `VERIFIED` growth gates |
| Creator Count | `creator_number` (`/detail` only) | **UNVERIFIED** | Absent on `/rank`; present on `/detail` (`343–1,824`), but active-window vs selling vs lifetime scope is **UNVERIFIED** | **NO** (Quarantined) |
| Video-Only Creator Count | — | **UNAVAILABLE** | Not exposed by `/rank` or `/detail` | **NO** |
| Creator Concentration (Top-N Share) | — | **UNAVAILABLE** | Not exposed by `/rank` or `/detail` | **NO** |
| Product Star Rating (0–5) | — | **UNAVAILABLE** | Absent across `/rank` and `/detail` (`need_extra: true`) | **NO** |
| Review Count | `product_review_count` (`/detail` only) | **UNVERIFIED** | Present on `/detail`, but lifetime vs window scope is **UNVERIFIED** | **NO** (Quarantined) |
| Historical Longitudinal Trends | `siamvisual_product_snapshots_v1` | **PARTIALLY_VERIFIED (LOCAL)** | Append-only verified `SOURCE` observations now persist locally & in Backup v5; requires ≥2–3 real observation days before unlocking longitudinal strategies | Yes (once ≥2–3 real days accumulate; `DERIVED` deltas kept separate) |

---

## 10. Remaining Blockers

1. **Unverified Competition Scope (`creator_number`)**: Remains the #1 blocker preventing live Thailand products from earning a verified Competition score (`ELIGIBLE` overall status) or qualifying for `Early Market Opportunity`, `Underserved Demand`, `Creator Yield Opportunity`, and `Strong Demand + Low Creator Competition`. Resolving this requires either official Kalodata semantic confirmation (and/or probing a dedicated product-creator endpoint that reports active selling creators within `dateRange` + creator concentration).
2. **Unavailable Quantitative Customer Quality (`rating`)**: Kalodata `/rank` and `/detail` do not return star ratings (`0–5`), blocking `Trust-Based Winners` and full 4-dimension `ELIGIBLE` confidence unless a verified product-rating source is integrated.
3. **Unverified Growth Comparison Window (`revenue_growth_rate`)**: While percentage-point scale is confirmed, exact baseline period confirmation is still required before lifting `growthStatus` from `UNVERIFIED` to `VERIFIED` (though accumulating ≥2–3 real multi-day snapshots in the new snapshot store provides an independent, transparent local velocity signal!).
4. **Cold-Start Historical Depth**: Because SiamVisual never fabricates historical data, `fast_rising_products` and `trend_timing_opportunity` require users to observe products across ≥2–3 real calendar days before multi-day trajectories unlock.

---

## 11. Honest Readiness Assessment

**Can SiamVisual now reliably identify TikTok Shop Thailand products worth promoting through creator-made videos?**

- **Yes — for Preliminary Shortlisting of High-Demand, Monetizable, Video-Proven Products**: SiamVisual now cleanly and honestly separates monetizable products (`>0%` commission) with verified strong demand, strong affiliate payouts, and verified short-video revenue share (`Strong Demand + Strong Video Sales`, `Strong Affiliate Earnings`) from `0%` commission items and live/mall-only traps (`0.2%–4.6%` video share) — without inflating scores or fabricating missing data.
- **Not Yet — for Verified Low-Competition Entry Timing or Customer-Trust Guarantee**: Because Kalodata's `creator_number` semantics remain `UNVERIFIED`, creator concentration is `UNAVAILABLE`, and product star ratings are `UNAVAILABLE`, SiamVisual **cannot yet automatically prove** whether a high-demand video-selling product has low creator competition or high buyer satisfaction. Every live candidate is therefore honestly labeled **`Preliminary`** on the card alongside its exact evidence gaps, while the new append-only Historical Snapshot Foundation begins accumulating real multi-day observations automatically at `0` extra API credit cost.
