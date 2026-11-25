# Phase 10.1 — Snapshot Data Integrity & Historical Timestamp Hardening

## 1. Original Defects & Root Causes

A pre-Phase 11 code review identified two core data-integrity flaws and related longitudinal validation gaps:

1. **Untrusted Backup Import Self-Certification**
   - `parseBackupFile()` in `src/lib/storage.ts` previously passed `payload.productSnapshots` directly into `sanitizeProductSnapshotsMap()` without distinguishing trusted local browser observations from untrusted external JSON imports.
   - Because `sanitizeProductSnapshotsMap()` accepted client-supplied `creatorCountVerified` and `revenueGrowthVerified` fields verbatim and carried no trust-boundary classification, an edited or crafted backup JSON could declare unverified metrics as verified and artificially qualify historical strategies (`fast_rising_products` and `trend_timing_opportunity`).
   - `mergeRestoredProductSnapshots()` also permitted imported same-day snapshots to overwrite or mutate existing trusted local observations when timestamps or confidence fields were higher.

2. **Collapsed & Fabricated Observation Timestamps**
   - `createObservationSnapshotFromProduct()` previously discarded per-metric `fetchedAt` and `sourceEndpoint` values, collapsing every metric into a single snapshot-level `observedAt`.
   - When `/rank` (observed at `T1`) and `/detail` (observed at `T2`) responses were combined during same-day merges or hydration, `observedAt` was overwritten with the later timestamp and `toStrategyHistoricalSnapshots()` stamped every emitted metric with that single timestamp, making non-simultaneous observations appear simultaneous.
   - `extractMetricsFromRawRow()` / `parseRawProductRow()` in `server/kalodata.ts` defaulted missing `fetchedAt` to `new Date().toISOString()`, and `adaptProductItemToValidatedMetrics()` fell back to `deepInsights.fetchedAt` for numeric Kalodata metrics, silently fabricating observation times when none existed.

3. **Insufficient Longitudinal Guards in Historical Strategy Analysis**
   - `analyzeHistoricalSnapshots()` in `src/lib/strategyEngineV2.ts` previously checked only `Number.isFinite(Date.parse(snap.fetchedAt))`, without rejecting imported unverified records, future timestamps (`> nowMs + 5m`), incompatible `dateRange` windows, or duplicate/near-duplicate captures.

---

## 2. Trust-Boundary Design

Phase 10.1 introduces an explicit two-state trust model on `ProductObservationSnapshot` and `HistoricalMetricSnapshot`:

- `LOCAL_OBSERVED`: Snapshot generated directly inside the active application runtime from live/validated source observations (or pre-10.1 records already persisted in local browser storage).
- `IMPORTED_UNVERIFIED`: Any snapshot entering through backup JSON import (`parseBackupFile` / `sanitizeImportedProductSnapshotsMap` / `mergeRestoredProductSnapshots`), regardless of what `trustStatus`, `provenance`, `verificationStatus`, `creatorCountVerified`, or `revenueGrowthVerified` flags the imported file claims.

Boundary rules enforced across storage and strategy boundaries:
- **Never trust imported verification claims**: Imported JSON is always routed through `sanitizeImportedProductSnapshotsMap()` and re-sanitized inside `mergeRestoredProductSnapshots()`.
- **No overwrite of trusted local history**: `appendObservationSnapshot()` strictly blocks `IMPORTED_UNVERIFIED` snapshots from overwriting or mutating `LOCAL_OBSERVED` snapshots on the same `(productId, dateRange, observationDay)` bucket.
- **Clean local superseding**: A fresh `LOCAL_OBSERVED` capture on the same UTC day cleanly replaces an `IMPORTED_UNVERIFIED` reference without copying unverified imported fields into verified fields.
- **No trust upgrade on re-export / re-import**: `buildBackupPayload()` preserves exact `trustStatus`, `metricMeta`, and `importedAudit` on export; re-importing any backup file always classifies imported records as `IMPORTED_UNVERIFIED`.

---

## 3. Imported Snapshot Behavior

Restoring a backup never destroys a user's historical view while preventing false verification:

- **Visible & Inspectable**: Valid imported snapshots (with valid non-future timestamps) are stored and remain inspectable in browser history and optional reference trend derivation (`deriveSnapshotTrend(..., { includeImportedReference: true })`, which explicitly labels `trustScope: 'INCLUDES_IMPORTED_UNVERIFIED'` and keeps `verifiedCreatorDeltaPct: null`).
- **Verification Stripped, Reference & Audit Preserved**:
  - `observations.creatorCountVerified` is forced to `null` (any numeric claimed value is preserved in `observations.creatorCountUnverifiedRaw` as an unverified reference).
  - `observations.revenueGrowthVerified` is forced to `false` (the numeric `observations.revenueGrowthRate` remains inspectable as unverified reference).
  - Original untrusted claims (`claimedTrustStatus`, `claimedSourceEndpoint`, `claimedCreatorCountVerified`, `claimedRevenueGrowthVerified`, `originalProvenance`, `originalVerificationStatus`, `importedAt`) are preserved in `snapshot.importedAudit` for transparent inspection.
- **Excluded from Historical Strategy Qualification**: `toStrategyHistoricalSnapshots()`, `buildStrategySnapshotsMap()`, default `deriveSnapshotTrend()`, and `strategyEngineV2.ts` all refuse to use `IMPORTED_UNVERIFIED` snapshots to qualify `fast_rising_products` or `trend_timing_opportunity`.

---

## 4. Per-Metric Timestamp Implementation

Observation timestamps are now tracked per individual metric rather than collapsed or invented:

- `ValidatedMetric<T>` carries optional `sourceEndpoint?: ProductMetricSourceEndpoint` alongside `fetchedAt` and `dateRange`.
- `ProductKalodataMetrics` carries optional `metricTimestamps?: Partial<Record<string, string | null>>` so `mergeKalodataMetrics()` retains each field's source timestamp during coherent merges.
- `mergeValidatedMetricsSnapshots()` complements absent endpoint-exclusive fields within the 6-hour coherent window and identical `dateRange` while leaving each individual `ValidatedMetric`'s own `fetchedAt`, `dateRange`, and `sourceEndpoint` completely untouched.
- `ProductObservationSnapshot` records `metricMeta?: Partial<Record<ObservationMetricKey, ProductObservationMetricMeta>>` storing `{ fetchedAt, timestampPrecision: 'EXACT_METRIC' | 'SNAPSHOT_FALLBACK' | 'UNKNOWN', sourceEndpoint, dateRange }` per metric.
- Same-day merges in `appendObservationSnapshot()` merge metric values and `metricMeta` field-by-field (`mergeSameDayObservationAndMeta`), preserving distinct `/rank` (`T1`) and `/detail` (`T2`) timestamps and source endpoints independently.
- **No fabricated timestamps**:
  - `extractMetricsFromRawRow()`, `parseRawProductRow()`, and `adaptRawKalodataRowToValidatedMetrics()` default omitted `fetchedAt` to `null` (never `new Date().toISOString()`).
  - `adaptProductItemToValidatedMetrics()` no longer borrows `deepInsights.fetchedAt` for numeric Kalodata metrics.
  - `createObservationSnapshotFromProduct()` refuses to fabricate `observedAt` when no valid observation timestamp exists (`returns null`), and marks individual metrics without timestamps explicitly as `{ fetchedAt: null, timestampPrecision: 'UNKNOWN' }`.
  - Pre-10.1 legacy local snapshots lacking `metricMeta` are handled transparently with `note: 'SNAPSHOT_LEVEL_TIMESTAMP_FALLBACK'` when converted to historical strategy inputs.

---

## 5. Historical Strategy Protections

Both `src/lib/snapshotStore.ts` and `src/lib/strategyEngineV2.ts` enforce defense-in-depth protections for `fast_rising_products` and `trend_timing_opportunity`:

- **Trust-status gate**: `toStrategyHistoricalSnapshots()` emits only `LOCAL_OBSERVED` snapshots, and `analyzeHistoricalSnapshots()` independently rejects any `HistoricalMetricSnapshot` with `trustStatus === 'IMPORTED_UNVERIFIED'`.
- **Future-timestamp rejection**: Timestamps beyond `nowMs + 5 minutes` (via `validateMetricTimestamp`) are rejected in `createObservationSnapshotFromProduct`, `appendObservationSnapshot`, `sanitizeProductSnapshotsMap`, `sanitizeImportedProductSnapshotsMap`, `parseBackupFile`, `deriveSnapshotTrend`, `toStrategyHistoricalSnapshots`, and `analyzeHistoricalSnapshots` (both snapshot envelope `fetchedAt` and per-metric `fetchedAt`).
- **Date-range compatibility**: Incompatible `dateRange` observations are excluded from snapshots, trends, and longitudinal comparisons.
- **Duplicate & near-duplicate suppression**:
  - `snapshotStore.ts` deduplicates observations per UTC day `(productId, dateRange, observationDay)`.
  - `analyzeHistoricalSnapshots()` collapses exact and near-duplicate captures (`< 6h` apart) so duplicate snapshots cannot inflate `snapshotCount` or satisfy `minSnapshots` (`>= 2` for `fast_rising_products`, `>= 3` for `trend_timing_opportunity`).
- **Time-anchored evaluation**: `src/App.tsx` passes `{ nowMs: evaluationNowMs }` into `buildStrategySnapshotsMap()` so evaluation time matches scoring and strategy evaluation consistently.

---

## 6. Backup Compatibility Results (v1–v5)

Verified via automated compatibility tests in `tests/phase10_1SnapshotIntegrityHardening.test.ts`:

- **Bare legacy array (`SavedHistoryEntry[]`)**: Restores entries cleanly without error.
- **Backup v1 (`entries`)**: Restores entries cleanly.
- **Backup v2 (`entries`, `limits`, `recentSearches`)**: Restores entries, credit limits, and recent searches cleanly.
- **Backup v3 (+ `deepInsightsCache`)**: Restores entries and deep insights cache cleanly.
- **Backup v4 (+ `productAnalysisCache`)**: Restores entries and product analysis cache cleanly.
- **Backup v5 (+ `productSnapshots`)**: Restores all sections cleanly while sanitizing every imported snapshot as `IMPORTED_UNVERIFIED` with preserved audit metadata and rejecting malformed/future timestamps.

---

## 7. Files Changed

- `src/types/metrics.ts` — Added `sourceEndpoint` on `ValidatedMetric<T>`, `SnapshotTrustStatus`, `ObservationMetricKey`, `ProductObservationMetricMeta`, `SnapshotImportedAuditMetadata`, `trustStatus`/`metricMeta`/`importedAudit` on `ProductObservationSnapshot`, and `trustScope` on `SnapshotTrendDerivation`.
- `src/types/strategyV2.ts` — Added optional `trustStatus` on `HistoricalMetricSnapshot`.
- `src/types.ts` — Added optional `metricTimestamps` on `ProductKalodataMetrics`.
- `src/lib/metricFoundation.ts` — Propagated per-metric `sourceEndpoint`, stopped fabricating timestamps when missing, used conservative combined timestamp for synthetic commission, and prevented `adaptProductItemToValidatedMetrics` from borrowing `deepInsights.fetchedAt`.
- `server/kalodata.ts` — Changed default `fetchedAt` in `extractMetricsFromRawRow` and `parseRawProductRow` to `null` instead of fabricating `new Date().toISOString()` (live API callers still pass actual capture timestamps).
- `server/productService.ts` — Handled nullable `validatedMetrics.fetchedAt` safely during enrichment assembly.
- `src/lib/snapshotStore.ts` — Implemented trust-boundary sanitization (`sanitizeImportedProductSnapshotsMap` vs `sanitizeProductSnapshotsMap`), per-metric `metricMeta` tracking and field-by-field same-day merges, future-timestamp rejection, duplicate suppression, and `LOCAL_OBSERVED`-only strategy/trend conversion.
- `src/lib/storage.ts` — Preserved per-metric timestamps in `mergeKalodataMetrics` and `mergeValidatedMetricsSnapshots`, extracted `buildBackupPayload()`, and routed `parseBackupFile()` snapshots through the untrusted import boundary.
- `src/lib/strategyEngineV2.ts` — Hardened `analyzeHistoricalSnapshots()` with trust-status filtering, future-timestamp rejection, `dateRange` matching, and exact/near-duplicate (`< 6h`) snapshot suppression.
- `src/App.tsx` — Passed `{ nowMs: evaluationNowMs }` into `buildStrategySnapshotsMap()`.
- `tests/phase10_1SnapshotIntegrityHardening.test.ts` — Added 12 targeted regression tests covering all Phase 10.1 requirements.
- `docs/quality/phase10.1-snapshot-integrity-hardening.md` — This verification report.

---

## 8. Tests & Exact Results

Command executed: `npx tsx --test tests/*.test.ts`

- **Total test suites**: `12`
- **Total tests**: `99`
- **Passed**: `99`
- **Failed**: `0`
- **Skipped / Cancelled**: `0`
- **Kalodata live API credits spent in Phase 10.1**: `0`

Phase 10.1 regression suite (`tests/phase10_1SnapshotIntegrityHardening.test.ts`, 12/12 passed):
1. Backup with spoofed `creatorCountVerified` (`true` and numeric `12` + `trustStatus: 'LOCAL_OBSERVED'`, `provenance: 'SOURCE'`, `verificationStatus: 'VERIFIED'`) cannot create a verified creator metric; audit metadata and unverified numeric reference preserved.
2. Backup with `revenueGrowthVerified: true` cannot create a verified growth metric; numeric reference and audit claim preserved.
3. Imported snapshots remain restorable and inspectable in storage, while `toStrategyHistoricalSnapshots`, default `deriveSnapshotTrend`, `fast_rising_products`, and `trend_timing_opportunity` refuse to qualify on them (including direct defense-in-depth rejection in `strategyEngineV2`).
4. Re-exporting and re-importing preserves `LOCAL_OBSERVED` vs `IMPORTED_UNVERIFIED` on export and never upgrades imported trust across round-trips.
5. Legitimate local snapshots (both Phase 10.1 `LOCAL_OBSERVED` and pre-10.1 legacy local storage records without `trustStatus`) remain eligible and qualify `fast_rising_products` and `trend_timing_opportunity`.
6. `/rank` (`T1`) and `/detail` (`T2`) metrics preserve distinct per-metric `fetchedAt` and `sourceEndpoint` across `mergeValidatedMetricsSnapshots`, `mergeKalodataMetrics`, `createObservationSnapshotFromProduct`, same-day `appendObservationSnapshot`, and `toStrategyHistoricalSnapshots`.
7. Missing timestamps remain explicitly `null` / `UNKNOWN` across `extractMetricsFromRawRow`, `adaptRawKalodataRowToValidatedMetrics`, `adaptProductItemToValidatedMetrics`, `createObservationSnapshotFromProduct`, and `toStrategyHistoricalSnapshots` (never fabricated).
8. Future timestamps (`> nowMs + 5m`) are rejected across snapshot creation, append, local sanitization, backup import, trend derivation, and `strategyEngineV2`.
9. Duplicate and near-duplicate (`< 6h`) snapshots do not inflate snapshot counts or fabricate longitudinal trends.
10. Imported snapshots never overwrite or mutate trusted local observations on the same UTC day; distinct imported days restore as `IMPORTED_UNVERIFIED`, and fresh local captures cleanly supersede imported references on the same day.
11. Backup formats v1, v2, v3, v4, v5, and bare legacy array restore cleanly without data loss.
12. Commercial scoring (`evaluateProductCommercialV2`) and all non-historical strategies remain completely identical and unaffected.

---

## 9. Remaining Limitations

- **Client-side storage boundary**: Browser `localStorage` is inherently client-controlled on the user's own device. Without a server-side persistence store and server-verified cryptographic attestation, SiamVisual cannot prevent a user from manually modifying their own live `localStorage` keys in browser DevTools. Phase 10.1 intentionally avoids inventing fake client-side signatures and instead enforces a clear, honest trust boundary for all imported backup JSON and longitudinal validations.
- **Pre-10.1 legacy local snapshots**: Local snapshots recorded prior to Phase 10.1 do not have per-metric `metricMeta` stored; they continue to work for longitudinal continuity with an explicit `SNAPSHOT_LEVEL_TIMESTAMP_FALLBACK` note until naturally superseded by new captures.
- **Live creator count semantics**: As documented in Phases 0, 8, and 10, Kalodata's `/detail` `creator_number` time-window scope remains unverified upstream, so live Kalodata captures continue storing it in `creatorCountUnverifiedRaw` rather than `creatorCountVerified`.

---

## 10. Confirmation of Unchanged Commercial Scoring & Gates

Confirmed:
- `src/lib/scoringEngineV2.ts` was **not modified**.
- No commercial scoring formulas, dimension weights, Bayesian priors, thresholds, or commercial eligibility gates were modified in `src/lib/scoringEngineV2.ts` or `src/lib/strategyEngineV2.ts`.
- The four signals (**Commercial Opportunity**, **Conversion Evidence**, **Video Suitability**, and **Data Confidence**) remain strictly separate.
- Only untrusted, malformed, future-dated, incompatible-period, or duplicate historical snapshot evidence is excluded from longitudinal trend and historical strategy evaluation.
