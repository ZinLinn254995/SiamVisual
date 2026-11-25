# Product Intelligence V2 — Design Specification

**Status:** Draft / documentation-first  
**Baseline commit:** `55457854ee0248b95dbdd0bd83e0b6e39f1b90e4`  
**Branch:** `docs/product-intelligence-v2-spec`  
**Scope:** Product opportunity discovery for Thailand TikTok Shop affiliates  
**Implementation status:** No V2 code, database, deployment, or production behavior changes are included in this document.

## 1. Product objective

SiamVisual should help a creator discover products with a commercially attractive combination of:

- proven and sufficiently large demand;
- positive demand momentum when comparable historical data exists;
- relatively low affiliate creator density;
- attractive revenue yield per creator;
- meaningful commission payout;
- trustworthy customer feedback; and
- evidence that shoppable video is already a meaningful sales channel.

The primary opportunity pattern is:

**High Demand + Positive Growth + Low Creator Density + Strong Revenue per Creator.**

A product's visual suitability for AI-generated videos is a separate creative consideration. It must not inflate its commercial opportunity score.

SiamVisual describes evidence-backed opportunities; it does not guarantee that a product will sell or that a user's own video will convert.

## 2. Current implementation facts at the baseline

The repository currently has a single legacy `ProductScoreBreakdown` in `src/types.ts` with:

- Visual Demo: 42%;
- AI Video Suitability: 26%;
- Sales Demand: 18%;
- Commission Value: 14%; and
- a speech-reliance penalty.

The active server scoring path is `computeDirectKalodataScore` in `server/scoreEngine.ts`, called from `server/productService.ts`. AI enrichment also produces visual and sales-momentum fields and feeds a separate ranking path. These paths must be reconciled before V2 becomes the only displayed commercial ranking.

The current product metric type includes 7-day sales volume, revenue, video revenue, live revenue, revenue growth, creator count, rating, review count and a date-range string. The existence of a type field does not prove that the upstream API returns it consistently or with known units.

The current server has a 10-minute in-memory search cache and a credit-aware Kalodata search path. The UI/server request behavior and the actual API response contract must be checked before changing retrieval behavior.

## 3. Architecture

V2 is divided into five layers. Each layer has one responsibility and must preserve the distinction between source facts, derived metrics and interpretations.

### Layer 1 — Ingestion, normalization and validation

Every input metric is represented as a validated value, not as a bare number.

Required conceptual fields:

- `value`: normalized value or null;
- `state`: `OK`, `ZERO`, `MISSING`, `UNAVAILABLE`, `INVALID`, or `STALE`;
- `provenance`: `SOURCE` or `SYNTHETIC`;
- `rawInput`: original upstream value when available;
- `unit`: explicit unit (THB, count, percentage, rating, etc.);
- `fetchedAt`: actual retrieval timestamp;
- `dateRange`: period represented by the metric; and
- `note`: validation or interpretation note.

Rules:

1. A true zero is not missing. Zero commission is a valid commercial fact and must remain zero.
2. Missing, unavailable, invalid and stale values must never be silently converted to a positive default.
3. A synthetic estimate must never be presented as an upstream source fact.
4. Do not synthesize source revenue from sales volume multiplied by listed price and then label it as actual revenue.
5. Normalize percentages and currency only after confirming the source unit and scale.
6. Parse price ranges explicitly; do not silently choose an arbitrary endpoint.
7. A snapshot must not merge fields from different fetch times unless each field retains its own provenance and timestamp.
8. Replacing a snapshot should replace the snapshot coherently rather than blending old and new fields with unknown periods.

### Layer 2 — Four independent commercial engines

Each engine returns either a scored result (integer 0–100) or `INSUFFICIENT_DATA` with a null score. Each result includes completeness, a transparent breakdown and explanatory notes.

#### 2.1 Demand Engine

Measures market demand scale from verified revenue and/or sales volume.

- Revenue and sales volume are scale signals; avoid double-counting them as if they were independent demand outcomes.
- Growth is not included in the numeric demand score until its unit, period and direction are verified.
- If both revenue and sales volume are missing, unavailable or invalid, return `INSUFFICIENT_DATA`.
- Never silently substitute synthetic revenue for source revenue.
- Category anchors and percentile curves are calibration inputs, not universal constants. Validate them against representative Thailand category samples.

#### 2.2 Earning Engine

Measures the affiliate's potential commission economics.

- Preserve a valid 0% commission as `ZERO`; score it as zero and apply the non-monetizable gate.
- Missing or invalid commission is `INSUFFICIENT_DATA`, not zero.
- Gross commission payout is `priceTHB × commissionRate / 100`.
- Do not impose a minimum payout floor (for example, do not force a ฿0.58 payout to ฿1).
- Combine commission-rate attractiveness with absolute THB payout so a high percentage on a tiny basket is not automatically ranked above a meaningful payout.
- Validate listed price, commission rate and payout units before scoring.

#### 2.3 Competition Engine

Higher score means more attractive entry conditions (less creator crowding / more yield headroom).

- Creator count is required for a reliable competition score.
- Revenue per creator (RPC) is a proxy, not a guaranteed creator-level earning figure.
- Display raw RPC separately from any smoothed RPC used for ranking.
- Use adjusted/smoothed RPC for ranking to reduce extreme small-denominator distortion; define and test the smoothing constant before implementation.
- If creator count is zero while revenue is positive, RPC is undefined. Emit a `ZERO_CREATOR_DEMAND` warning and apply a conservative cap; never represent RPC as infinity.
- Creator count of one must not create an unbounded high score.
- Confirm whether the upstream creator count means active creators in the selected period, creators with sales, or lifetime creators. Do not label it more specifically than the source supports.

#### 2.4 Customer Rating Quality Engine

Measures customer feedback quality using rating and review volume.

- Use Bayesian shrinkage or an equivalent sample-size-aware method.
- A high average rating with only a few reviews is not strong proof of quality.
- Small samples should be marked insufficient or strongly penalized according to a threshold validated on actual coverage.
- A low rating with a large review count is a meaningful risk signal.
- Confirm the meaning and period of review/comment counts before treating them as comparable.

### Layer 3 — Independent evidence and risk modules

These modules inform the result but do not replace the four commercial engines.

#### 3.1 Conversion Evidence

Answers: **Is this product already selling through shoppable short video?**

It does not answer whether AI can generate a compelling video or whether this user's own video will convert.

- Compute video/live/other revenue shares only when the required source values are present, valid and period-aligned.
- A null video revenue value means unknown; a valid zero means no observed video revenue in the period.
- If video revenue plus live revenue exceeds total revenue by more than a 5% tolerance, mark the channel split inconsistent and suppress derived shares.
- Candidate labels such as strong/moderate video-proven evidence may use initial thresholds (for example, video share ≥45% with video revenue ≥฿15,000; moderate ≥20% with ≥฿5,000), but these are **calibration candidates, not approved facts**. Validate against real data before they influence ranking.

#### 3.2 Data Confidence

A separate reliability indicator. It must not directly change the four dimension scores.

Candidate components:

- completeness: 40%;
- freshness: 20%;
- internal consistency: 20%;
- evidence volume: 20%.

Candidate tiers: HIGH ≥75, MEDIUM 50–74, LOW <50. These are provisional until the team defines exact field coverage, freshness windows and evidence-volume rules.

Do not let missing metrics masquerade as positive evidence. A high confidence score requires actual, current, internally consistent observations.

#### 3.3 Deterministic tags

Opportunity tags may include:

- `HIGH_VIDEO_SHARE`
- `HIGH_RPC_YIELD`
- `LOW_CREATOR_CROWDING`
- `HIGH_COMMISSION_PAYOUT`
- `PROVEN_TRUST`

Risk tags may include:

- `NOT_MONETIZABLE`
- `MICRO_PAYOUT`
- `CREATOR_SATURATED`
- `LIVE_DEPENDENT`
- `LOW_RATING_RISK`
- `TINY_SAMPLE_ANOMALY`
- `AOV_PRICE_MISMATCH`
- `MISSING_METRICS`
- `CHANNEL_REVENUE_INCONSISTENT`

Do not invent seller concentration, creator concentration, ad saturation, return rates, EPC, CPM or other fields that are not actually supplied by the source.

### Layer 4 — Eight automatic opportunity strategies

Strategies run in the background. The user searches normally and does not need to choose a strategy manually. Each strategy has explicit eligibility gates and a ranking profile; do not build eight unrelated scoring engines.

1. **Early Market Opportunity** — primary strategy: strong demand, positive growth when verified, low creator density and strong RPC. Until comparable growth is verified, show a clearly labelled growth-free early-opportunity proxy.
2. **Underserved Demand** — strong revenue/sales with relatively few creators; growth is not required.
3. **Creator Yield Opportunity** — high adjusted RPC with sufficient demand and meaningful commission payout.
4. **Fast Rising Products** — demand growth exceeds creator growth over comparable periods. Block until historical snapshots or verified prior-period baselines exist.
5. **Profit Maximizer** — meaningful demand plus strong commission payout/rate. High commission without demand is ineligible.
6. **Video Proven Winners** — meaningful absolute video revenue and video revenue share, consistent channel data and manageable competition.
7. **Trust-Based Winners** — sufficient rating and review sample plus demand and commission evidence.
8. **Trend Timing Opportunity** — seasonal/trend demand rising before creator supply catches up. Block until multi-week history and creator-growth evidence exist.

Current data may support strategies 1, 2, 3, 5 and 6 conditionally; strategy 7 depends on validated rating coverage. Strategies 4 and 8 remain blocked until historical data exists.

### Layer 5 — Opportunity aggregation and presentation

The result must show:

- a commercial opportunity score;
- a separate data-confidence indicator;
- eligibility and rank for each applicable strategy;
- opportunity and risk tags;
- the evidence behind each score; and
- explicit missing/insufficient data.

Do not let one overall score hide a product's strong fit for a specific strategy. Strategy ranks/highlights remain visible independently.

**Aggregator status: NOT FINALIZED.** The exact base weights/formula from the prior proposal were not supplied in readable plain text. Do not implement or infer a missing formula. Arithmetic mean alone is unsafe because a zero-commission product can still rank highly; a pure geometric mean is too brittle when a secondary dimension is legitimately unavailable.

Candidate critical gates to test:

- 0% commission: overall score capped at 15 and tagged `NOT_MONETIZABLE`;
- demand score below 25: overall score capped at 45;
- verified poor quality score below 30: apply a tested penalty rather than silently dropping quality;
- top-tier eligibility requires Demand, Earning and Competition to be scored;
- missing quality/competition must not trigger naive weight renormalization;
- small result cohorts (N<8) must not use in-search percentiles as if statistically stable.

These caps and thresholds are provisional test candidates, not final calibrated values.

A proposed confidence adjustment `0.78 + 0.22 × confidence/100` and a 0–4 multi-strategy breadth bonus are also unapproved candidates. Test whether the confidence discount is strong enough and whether the breadth bonus double-counts correlated strategies. Do not add the bonus until backtesting proves it improves ranking quality.

## 4. Strategy availability and data prerequisites

| Strategy | Initial availability | Required evidence |
|---|---|---|
| Early Market Opportunity | Conditional / proxy | Demand, commission, creator count; verified growth for full version |
| Underserved Demand | Available conditionally | Revenue or sales + creator count |
| Creator Yield Opportunity | Available conditionally | Demand + creator count + commission |
| Fast Rising Products | Blocked | Comparable historical demand and creator snapshots |
| Profit Maximizer | Available conditionally | Demand + price + commission |
| Video Proven Winners | Conditional | Valid video revenue, total revenue and aligned period |
| Trust-Based Winners | Conditional | Rating + meaningful review sample |
| Trend Timing Opportunity | Blocked | Multi-week demand and creator-growth history |

## 5. Retrieval and credit policy

Use an adaptive retrieval policy rather than automatically issuing multiple broad requests.

1. Begin with the lean rank request and respect the current credit guardrails.
2. Use the existing cache when the user has not explicitly requested a refresh and the cached result is valid.
3. Only run a second retrieval pass when the first result set has a material, measurable gap relevant to the user's query (for example, missing creator/quality evidence or a clearly narrow candidate pool) and the expected value justifies its credit cost.
4. Deduplicate identical in-flight requests.
5. Record the retrieval mode, source endpoint, date range, fetched time, credit usage and reason for any second pass.
6. Do not broaden page size, sort modes or category passes until the live API contract and cost have been verified.
7. First verification budget: at most 1–2 targeted rank/detail probes, estimated 0.2–0.4 credits, subject to actual endpoint cost and the user's configured reserve. Stop if the endpoint response or cost differs from expectation.

## 6. Historical data decision

Do **not** provision a database in this stage.

The current browser/local storage and short-lived in-memory cache are not a reliable longitudinal dataset. Once V2 single-snapshot calculations are validated, evaluate a persistent append-only history with:

- `product_snapshots`: product/source/date-range/captured-at, validated metric states, normalized metrics, computed scores and matched strategies;
- `search_runs`: query/category/retrieval mode/credits/result IDs;
- `strategy_outcomes`: forward revenue/RPC/saturation changes and evaluation labels.

Historical strategy activation requires comparable snapshots and explicit retention/coverage rules. Fast Rising and Trend Timing must remain unavailable until then.

## 7. Migration and release sequence

1. **Phase 0 — Contract verification:** inspect current Kalodata rank/detail payloads, units, field coverage, period semantics, supported sort/page size and real credit cost. Use only the approved limited probes.
2. **Phase 1 — Validation foundation:** introduce explicit metric states/provenance and fix known V1 data bugs additively. Preserve the legacy `scoreBreakdown` contract.
3. **Phase 2 — V2 shadow computation:** implement the four engines, evidence modules and currently eligible strategies behind an additive `intelligenceV2` field. Do not change visible ranking yet.
4. **Phase 3 — Validation:** run the edge-case test matrix, compare V1/V2 behavior, inspect real examples and verify that missing/zero/inconsistent inputs behave correctly.
5. **Phase 4 — UI migration:** show V2 only after validation; retain V1 rollback compatibility during the transition. Retire legacy endpoints/fallbacks only after confirming they are unused and V2 is stable.
6. **Phase 5 — Historical data:** decide on database provisioning and historical strategies only after single-snapshot scoring is validated.
7. **Phase 6 — Retrieval optimization:** tune adaptive multi-pass retrieval only after supported API capabilities and credit costs are verified.

No production deployment or V1 removal is authorized by this design document.

## 8. Required acceptance tests

At minimum, test:

1. high demand + low creator density + strong RPC;
2. high demand + saturated creator supply;
3. high commission + no demand;
4. all metrics missing;
5. exactly 0% commission;
6. ambiguous fractional commission input;
7. price range such as `199-299`;
8. video revenue null versus true zero;
9. video + live revenue exceeding total revenue;
10. zero creators with positive revenue;
11. one creator with extreme raw RPC;
12. five-star rating with only two reviews;
13. 3.7-star rating with a large review sample;
14. live-dominated product;
15. visual-video suitability must not change commercial score;
16. exact ฿0.58 commission payout (no minimum floor);
17. missing quality must not create a ranking exploit;
18. one-product/single-link search must not create unstable cohort percentiles;
19. hydration and re-scoring must remain consistent;
20. blocked strategies must never be fabricated;
21. average order value/listed price mismatch must be flagged.

For case 1, if revenue is ฿200,000 and creator count is 8, raw RPC is ฿25,000. If a smoothing constant of 3 is later approved, adjusted RPC is ฿200,000/(8+3) ≈ ฿18,182. Strategy gates must state explicitly whether they use raw or adjusted RPC. Proposed rule: rank on adjusted RPC and display both values.

## 9. Open decisions before implementation

The following must be resolved with evidence before the relevant code is written:

- exact plain-text aggregator base formula and weights;
- confirmed units and meanings for growth and creator-count fields;
- source coverage and semantics for rating/review count;
- whether video/live/total revenue periods align;
- smoothing constant and RPC strategy thresholds;
- validated category anchors and minimum sample rules;
- exact freshness and confidence calculations;
- whether the current search request always forces refresh, and the safe cache policy;
- exact API cost and supported retrieval parameters.

## 10. Non-goals for this stage

- No database provisioning.
- No V1 scoring removal.
- No production UI redesign.
- No claims that AI video suitability predicts commercial success.
- No invented metrics or synthetic source values.
- No automatic broad multi-pass search that increases credit spend without a verified reason.
- No deployment.
