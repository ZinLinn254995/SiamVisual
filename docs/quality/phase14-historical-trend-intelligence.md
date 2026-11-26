# Phase 14 — Historical Trend Intelligence

**Date**: 2026-11-26  
**Repository**: `ZinLinn254995/SiamVisual`  
**Kalodata API Credits Used in Phase 14**: `0.00 cr` (Balance preserved at `8.70 cr`)  
**Commercial Scoring / Strategy Gate Changes**: `0` (Strict non-interference preserved)

---

## 1. Audit of Existing Snapshot Infrastructure

Before introducing the Phase 14 Historical Trend Intelligence layer, the existing Phase 10, 10.1, 11, 12, and 13 infrastructure was audited (`src/lib/snapshotStore.ts`, `src/lib/dataIntelligence.ts`, `src/lib/scoringEngineV2.ts`, `src/lib/productIntelligenceView.ts`, `src/types/metrics.ts`, `src/types/strategyV2.ts`):

- **Existing Capabilities Preserved**:
  - `ProductObservationSnapshot` v1 schema with UTC-day deduplication (`observationDay`), per-metric observation timestamps and provenance (`metricMeta`), and the Phase 10.1 trust boundary (`LOCAL_OBSERVED` vs `IMPORTED_UNVERIFIED`).
  - `deriveSnapshotTrend` and `toStrategyHistoricalSnapshots` remain intact and unchanged for backward compatibility with existing Phase 10 / 10.1 / 11 consumers and historical strategy gates.
- **Audit Gaps Identified & Hardened**:
  1. `ProductSourceObservationValues` did not previously record `unitPriceThb`. Added `unitPriceThb?: number | null` as an optional field so all 7 target trend metrics are tracked while maintaining 100% backward compatibility with pre-Phase 14 v1 snapshots.
  2. `ProductObservationMetricMeta` lacked an explicit optional `unit?: MetricUnit` tag. Added `unit?: MetricUnit` and hardened `createObservationSnapshotFromProduct` with explicit `expectedUnit` checks (`THB`, `COUNT`, `PERCENT`) so any metric carrying `UNVERIFIED` or a mismatched unit is never recorded into snapshot observations.
  3. Hardened `appendObservationSnapshot` to explicitly reject empty/whitespace `productId` or `dateRange` records.
  4. Added protection against stale re-recorded per-metric timestamps (`DUPLICATE_METRIC_TIMESTAMP`) when the exact same `EXACT_METRIC` `fetchedAt` timestamp is re-saved across multiple UTC days.

---

## 2. Tracked Metrics & Deterministic Classification Rules

Implemented in `src/lib/historicalTrendIntelligence.ts` (`analyzeProductHistoricalTrends`, `buildHistoricalTrendsMap`):

### 2.1 Seven Tracked Source Metrics

| Metric Key | Snapshot Field | Unit | Rising Threshold | Declining Threshold | Min Abs Delta | Volatile Threshold (≥3 points + ≥1 reversal) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `revenue` | `revenueThb` | `THB` | ≥ `+5%` | ≤ `-5%` | `100 THB` | swing ≥ `20%`, both legs ≥ `12%`, abs swing ≥ `500 THB` |
| `salesVolume` | `salesVolume` | `COUNT` | ≥ `+5%` | ≤ `-5%` | `2 units` | swing ≥ `20%`, both legs ≥ `12%`, abs swing ≥ `5 units` |
| `videoRevenue` | `videoRevenueThb` | `THB` | ≥ `+5%` | ≤ `-5%` | `100 THB` | swing ≥ `20%`, both legs ≥ `12%`, abs swing ≥ `500 THB` |
| `liveRevenue` | `liveRevenueThb` | `THB` | ≥ `+5%` | ≤ `-5%` | `100 THB` | swing ≥ `20%`, both legs ≥ `12%`, abs swing ≥ `500 THB` |
| `shoppingMallRevenue` | `shoppingMallRevenueThb` | `THB` | ≥ `+5%` | ≤ `-5%` | `100 THB` | swing ≥ `20%`, both legs ≥ `12%`, abs swing ≥ `500 THB` |
| `unitPrice` | `unitPriceThb` | `THB` | ≥ `+2%` | ≤ `-2%` | `1 THB` | swing ≥ `8%`, both legs ≥ `4%`, abs swing ≥ `5 THB` |
| `commissionRate` | `commissionRate` | `PERCENT` | ≥ `+1.0pp` | ≤ `-1.0pp` | `1.0 pp` | abs swing ≥ `2.0 pp` with material reversal (`≥1.0pp` up & down) |

### 2.2 Six Transparent Classifications

- **`RISING`**: ≥ 2 distinct trusted UTC days spanning ≥ 12 hours, meeting positive direction + minimum absolute delta thresholds without material oscillation.
- **`DECLINING`**: ≥ 2 distinct trusted UTC days spanning ≥ 12 hours, meeting negative direction + minimum absolute delta thresholds without material oscillation.
- **`STABLE`**: ≥ 2 distinct trusted UTC days spanning ≥ 12 hours within the neutral band (or consistently `ALL_ZERO`).
- **`VOLATILE`**: ≥ 3 distinct trusted UTC days with ≥ 1 material direction reversal (e.g., a roundtrip spike `40k → 75k → 41k` is classified `VOLATILE`, never `STABLE`) or diverging primary demand metrics (`Revenue: RISING` vs `Sales Volume: DECLINING`).
- **`INSUFFICIENT_HISTORY`**: Fewer than 2 distinct trusted UTC-day observations (0 observations, 1 observation, same-day deduplicated observations) or observation span `< 12 hours`. A single snapshot can never produce `RISING`.
- **`INCOMPARABLE_DATA`**: Snapshots fail one or more strict comparability or trust boundary checks.

### 2.3 Zero-Baseline & All-Zero Safety

- **`ALL_ZERO`** (`0 → 0`): Classified `STABLE`, `baselineStatus: 'ALL_ZERO'`, `deltaPct: null`, `absoluteDelta: 0`.
- **`ZERO_BASELINE`** (`0 → 50,000` or `0 → 50,000 → 0`): Percentage change from `0` is mathematically undefined — **`deltaPct` is strictly `null`** (never `Infinity`, `-Infinity`, `NaN`, or fabricated percentage). Direction is evaluated from `absoluteDelta` (`RISING` if `latestValue >= minAbsDelta`, `STABLE` if sub-threshold) and reversal rules (`VOLATILE` for `0 → 50,000 → 0`).

### 2.4 Overall Trend Synthesis

Overall product trend is synthesized strictly from primary demand metrics (`revenue` and `salesVolume`) rather than letting secondary channel shifts or commission changes overwrite demand momentum:
- Either primary metric `VOLATILE`, or opposing directions (`RISING` vs `DECLINING`) → `VOLATILE`
- Either `RISING` (with the other `RISING` or `STABLE`) → `RISING`
- Either `DECLINING` (with the other `DECLINING` or `STABLE`) → `DECLINING`
- Both `STABLE` → `STABLE`

---

## 3. Strict Comparability Guards & Trust Boundary

Every historical trend evaluation runs a 7-step deterministic gate pipeline (`trustScope: 'LOCAL_OBSERVED_ONLY'`, `provenance: 'DERIVED'`):

1. **Product Identity Match (`PRODUCT_IDENTITY_MISMATCH`)**: Mixed `productId` entries or records not matching the requested `productId` are excluded and cannot be compared.
2. **Valid Non-Future Timestamps (`INVALID_OR_FUTURE_TIMESTAMPS`)**: Invalid or future timestamps relative to `nowMs` are rejected.
3. **Phase 10.1 Trust Boundary (`IMPORTED_UNVERIFIED_ONLY`)**: Backup-restored snapshots (`trustStatus: 'IMPORTED_UNVERIFIED'`) are strictly excluded from trend computation and counted separately for audit visibility.
4. **Date Range Comparability (`DATE_RANGE_MISMATCH`)**: Snapshots from different windows (e.g., `last7Day` vs `last30Day`) are never mixed.
5. **Source Provenance Compatibility (`PROVENANCE_INCOMPATIBLE`)**: `rank` and `detail` share the compatible `kalodata_openapi_v1` provenance family and can be compared across days; `legacy_product` / `unknown` records are never mixed with Kalodata OpenAPI records.
6. **Per-Metric Unit & Duplicate Timestamp Guards (`UNIT_MISMATCH`, `DUPLICATE_METRIC_TIMESTAMP`)**: Any metric entry with a mismatched `unit` or a stale repeated `EXACT_METRIC` `fetchedAt` timestamp is excluded.
7. **UTC-Day Deduplication**: Multiple observations on the same UTC date collapse to the latest valid observation for that UTC day.

---

## 4. Integration & Strict Separation of Concerns

- **`src/lib/productEvidenceSummary.ts`**: Integrates `trendReport: HistoricalProductTrendReport` into `historicalSummary` and surfaces actionable trends in `derivedCalculations` or honest `INCOMPARABLE_DATA` / `INSUFFICIENT_HISTORY` status in `unavailableEvidence`.
- **`src/lib/productIntelligenceView.ts` & `src/App.tsx`**: Threads `observationSnapshotsByProductId` into `buildProductIntelligenceView` and attaches `historicalTrend?: HistoricalProductTrendReport` to card items without altering ranking order, buckets, `commercialScore`, or `strategyReport`.
- **`src/components/ProductCard.tsx`**: Renders a minimal directional chip (`↗ 3d`, `↘ 3d`, `→ 3d`, `↕ 3d`) ONLY when an actionable verified local trend exists; stays silent when history is insufficient or incomparable.
- **`src/components/ScoreDetailDialog.tsx` & `src/i18n.ts`**: Adds Section 4B (`Historical Trend Intelligence`) with full bilingual (MY & EN) labels, trust scope badge (`LOCAL_OBSERVED_ONLY`), 7-metric breakdown table (earliest → latest, delta / `Zero Base` / `All 0`, classification), and explicit non-guarantee disclaimer.
- **Zero Impact on Scoring/Strategy**: `src/lib/scoringEngineV2.ts` and `src/lib/strategyEngineV2.ts` were not modified.

---

## 5. Verification Summary

- **New Automated Test Suite**: `tests/phase14HistoricalTrendIntelligence.test.ts` — **7/7 tests passed** covering:
  1. Snapshot capture of `unitPriceThb`, `UNVERIFIED` unit rejection, same-day merge preservation, empty `productId`/`dateRange` rejection, and backward compatibility with legacy v1 snapshots.
  2. Deterministic classification of all 7 metrics across `RISING`, `STABLE`, `DECLINING`, and `VOLATILE` (including roundtrip spike detection).
  3. Non-fabrication guards (`0` obs, `1` obs, same-day duplicates, `< 12h` span).
  4. Explicit `ZERO_BASELINE` and `ALL_ZERO` handling (`deltaPct === null`, zero `Infinity`/`NaN`).
  5. All 7 comparability/trust guards (`PRODUCT_IDENTITY_MISMATCH`, `DATE_RANGE_MISMATCH`, `IMPORTED_UNVERIFIED_ONLY`, `PROVENANCE_INCOMPATIBLE`, `UNIT_MISMATCH`, `INVALID_OR_FUTURE_TIMESTAMPS`, `DUPLICATE_METRIC_TIMESTAMP`).
  6. Overall trend divergence synthesis (`RISING` vs `DECLINING` → `VOLATILE`) and `buildHistoricalTrendsMap`.
  7. End-to-end integration into `buildProductEvidenceSummary` and `buildProductIntelligenceView` proving `commercialScore` and `strategyReport` remain 100% identical.
- **Regression Verification**:
  - Phase 10, 10.1, 11, 12, and 14 suites: **42/42 passed**.
  - Phase 3, 4, 5, 7, 8, 9, and security suites: **45/45 passed**.
  - Note: 3 pre-existing Phase 1/2/6 tests using a hardcoded `2026-11-25T03:00:00.000Z` fixture timestamp inside `parseRawProductRow` crossed the 24h staleness clock threshold on `2026-11-26`; unrelated to Phase 14.
- **Kalodata API Credit Ledger**: `0` requests made, `0.00 cr` spent, balance preserved at `8.70 cr`.
