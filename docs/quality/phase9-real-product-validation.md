# Phase 9: Real Product Discovery & Ranking Validation

**Repository**: `ZinLinn254995/SiamVisual`  
**Validation Date**: 2026-11-25  
**Validation Mode**: Controlled live run through SiamVisual's production endpoints (`POST /api/products/search` and `POST /api/products/enrich`) + production V2 scoring/strategy/merge pipeline.  
**Overall Phase 9 Status**: `PARTIALLY_VERIFIED` (Discovery, Demand, Earning, Conversion Evidence, `NOT_MONETIZABLE` filtering, `/detail` enrichment, and credit caching are `VERIFIED`; full 4-pillar Commercial Opportunity scoring and strategy qualification remain `INSUFFICIENT_DATA` due to upstream `rating` unavailability and unverified `creator_number` / `revenue_growth_rate` semantics).

---

## 1. Live Search Parameters (`VERIFIED`)

Executed via production route `POST /api/products/search` -> `searchSilentVisualProducts` -> `fetchKalodataThailandProducts`:

| Parameter | Value Sent | Status |
| :--- | :--- | :--- |
| Endpoint | `POST /openapi/v1/tiktok/product/rank` | `VERIFIED` |
| Market (`region`) | `TH` (Thailand) | `VERIFIED` |
| Currency (`currency`) | `THB` | `VERIFIED` |
| Period (`date_range`) | `last7Day` | `VERIFIED` |
| Page Size (`page_size`) | `20` (`page_number: 1`) | `VERIFIED` |
| Sort (`sort_field`) | `{ field: "revenue", type: "DESC" }` | `VERIFIED` |
| Affiliate Filter (`is_affiliate`) | `1` (Affiliate products only requested) | `PARTIALLY_VERIFIED` (Upstream still returned 3 items with `commission_rate: 0`, caught and demoted locally as `NOT_MONETIZABLE`) |
| Detail Enrichment (`POST /api/products/enrich`) | `includeDetails: true` (`need_extra: true`, `need_image: 1`) on Top 2 preliminary candidates | `VERIFIED` |

---

## 2. Product Discovery Results (`VERIFIED`)

| Metric | Count (out of 20) | Status | Notes |
| :--- | :---: | :--- | :--- |
| Products returned from `/rank` | **20** | `VERIFIED` | All 20 parsed cleanly with nested `pri_category`, THB channel revenues, `sales_volumn`, `commission_rate`, `revenue_growth_rate`. |
| Products enriched with `/detail` | **2** | `VERIFIED` | Top 2 preliminary candidates (`1731299385569545105`, `1732462917435950190`); both preserved `/rank` growth rate after merge and added `creator_number`, `product_review_count`, and descriptions. |
| Usable Demand metrics (`demandScore.status === 'SCORED'`) | **20** | `VERIFIED` | 20/20 scored from verified `revenue` + `sales_volumn`. Growth boost stayed `0` (`growthStatus: 'UNVERIFIED'`). |
| Usable Earning metrics (`earningScore.status === 'SCORED'`) | **17** | `VERIFIED` | 17 monetizable (`1%–20%` commission); **3** explicitly marked `NOT_MONETIZABLE` (`commission_rate: 0`). |
| Usable Competition metrics (`competitionScore.status === 'SCORED'`) | **0** | `UNVERIFIED` | 18 absent on `/rank` (`MISSING`); 2 returned `creator_number` (`343`, `1,028`) on `/detail` but remain `UNAVAILABLE`/`UNVERIFIED` because time-window/activity scope is unverified. |
| Usable Customer Quality metrics (`customerQualityScore.status === 'SCORED'`) | **0** | `INSUFFICIENT_DATA` | `rating` is `UNAVAILABLE` on both `/rank` and `/detail` (20/20); `product_review_count` (`59,540`, `19,236` on `/detail`) remains `UNVERIFIED` scope. |
| Four-pillar `INSUFFICIENT_DATA` | **17** | `INSUFFICIENT_DATA` | Honest Gate 2 behavior (only 2/4 pillars verified). |
| `NOT_MONETIZABLE` (`0%` commission) | **3** | `VERIFIED` | iPad A16, AirPods 5, and 1g Gold Ring automatically scored `0` and demoted to ranks `#18–#20`. |

---

## 3. Top 5 Preliminary Candidates (`INSUFFICIENT_DATA` for 4-Pillar Composite — Ranked by Verified Demand & Earning Only)

> **Important Transparency Notice**: None of the 20 live products qualifies as a verified 4-pillar `TOP_OPPORTUNITY` (`commercialOpportunityScore = null`, `Data Confidence = 42 LOW`) because Competition and Customer Quality lack verified inputs. The 5 products below are **preliminary candidates** showing the strongest verified **Demand + Earning** evidence (after applying the Phase 9 deterministic tie-breaker fix):

| Prelim Rank | Product Name & ID | Category | 7d Revenue (THB) | 7d Units | Comm % / Est. Payout | Growth % (`UNVERIFIED` baseline) | Video Share (Conversion Evidence) | Demand / Earning | Detail Check (`creator_number` / `reviews` — `UNVERIFIED` scope) | Video Suitability (V1) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | **Solomon Pyla Plus 9-inch Spring Mattress** (`1731299385569545105`) | Furniture (`604453`) | ฿6,929,653.68 | 3,257 | `7%` / **฿148.96** | `-11.76%` | `76.2%` (`STRONG/VIDEO`) | **80 / 70** | Enriched: `343` creators, `59,540` reviews, rating `UNAVAILABLE` | `85` (top) |
| **2** | **INZENT Vitamin C + Gluta Collagen 2-Jar Set** (`1732462917435950190`) | Health (`700645`) | ฿4,163,665.25 | 29,324 | `20%` / **฿28.40** | `+41.11%` | `95.5%` (`STRONG/VIDEO`) | **80 / 59** | Enriched: `1,028` creators, `19,236` reviews, rating `UNAVAILABLE` | `76` (strong) |
| **3** | **Panda&Ele 460-Sheet Facial Tissue Pack** (`1732232621014943924`) | Home Supplies (`600001`) | ฿5,526,746.47 | 11,785 | `10%` / **฿46.90** | `+34.12%` | `48.9%` (`STRONG/BALANCED`) | **80 / 58** | Not enriched (`MISSING`) | `88` (top) |
| **4** | **NAWANNA Ginseng + Turmeric Pearl Cream** (`1736401558606284552`) | Beauty & Personal Care (`601450`) | ฿3,519,141.43 | 24,042 | `18%` / **฿26.28** | `-38.19%` | `96.6%` (`STRONG/VIDEO`) | **80 / 57** | Not enriched (`MISSING`) | `93` (top) |
| **5** | **Bemingtop643 BMG Knit Cardigan** (`1730650840970135613`) | Womenswear (`601152`) | ฿8,236,927.95 | 19,280 | `10%` / **฿42.70** | `+17.75%` | `63.1%` (`STRONG/VIDEO`) | **80 / 56** | Not enriched (`MISSING`) | `83` (strong) |

*Note: Past short-video revenue proves historical channel demand only; it does not guarantee affiliate sales for a new creator's video.*

---

## 4. Detailed 20-Product Live Breakdown (`VERIFIED` Inputs / `INSUFFICIENT_DATA` Composite)

Ordered by post-fix overall ranking (verified Demand+Earning tie-breaker within `INSUFFICIENT_DATA`, `NOT_MONETIZABLE` demoted to `#18–#20`):

| Rank | Product ID | Product Title (Short) | Price (THB) | 7d Rev (THB) | Units | Growth % (`UNVERIFIED`) | Comm % / ฿ | Creators / Reviews / Rating | D / E / C / Q | Comp. V2 | Status | Conf. | Conv. Evidence (Video Share) | V1 Vid. Fit |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :---: |
| 1 | `1731299385569545105` | Solomon ที่นอนสปริงนุ่มเด้ง Pyla Plus 9" | 2,128 | 6,929,654 | 3,257 | -11.76% | 7% / ฿148.96 | 343* / 59,540* / — | 80/70/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (76.2%) | 85 |
| 2 | `1732462917435950190` | INZENT (เซต 2 กระปุก) Vitamin C + Gluta | 142 | 4,163,665 | 29,324 | +41.11% | 20% / ฿28.40 | 1,028* / 19,236* / — | 80/59/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (95.5%) | 76 |
| 3 | `1732232621014943924` | Panda&Ele 460 แผ่น ทิชชู่แพ็คใหญ่ | 469 | 5,526,746 | 11,785 | +34.12% | 10% / ฿46.90 | — / — / — | 80/58/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/BALANCED` (48.9%) | 88 |
| 4 | `1736401558606284552` | ครีมโสมขมิ้นไข่มุก NAWANNA | 146 | 3,519,141 | 24,042 | -38.19% | 18% / ฿26.28 | — / — / — | 80/57/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (96.6%) | 93 |
| 5 | `1730650840970135613` | Bemingtop643 BMG Knit Cardigan | 427 | 8,236,928 | 19,280 | +17.75% | 10% / ฿42.70 | — / — / — | 80/56/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (63.1%) | 83 |
| 6 | `1734215429336433667` | Whitelab Astaxanthin + Vit E 60 softgels | 358 | 3,485,400 | 9,733 | -52.39% | 10% / ฿35.80 | — / — / — | 80/54/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `MODERATE/LIVE` (4.6%) | 69 |
| 7 | `1733023593329296909` | OUKEYA Classy Matte Cushion | 143 | 5,202,741 | 36,290 | -3.63% | 15% / ฿21.45 | — / — / — | 80/52/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (90.5%) | 84 |
| 8 | `1735533715642549357` | Teashell 5% Niacinamide Serum Set | 490 | 4,535,161 | 9,256 | -67.47% | 8% / ฿39.20 | — / — / — | 80/52/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `MODERATE/LIVE` (0.2%) | 84 |
| 9 | `1738398029387761617` | Dr.PONG GPI FIT498 Probiotic | 1,001 | 3,665,979 | 3,661 | +34.61% | 5% / ฿50.05 | — / — / — | 80/50/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (91.7%) | 73 |
| 10 | `1738529120155961009` | Love Story Premium Perfume Love Pink | 99 | 5,896,820 | 59,685 | -41.27% | 15% / ฿14.85 | — / — / — | 80/48/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (89.8%) | 87 |
| 11 | `1731941619140428980` | (21 ห่อ) ทิชชู่เช็ดหน้า JLY 5 ชั้น | 469 | 3,710,860 | 7,909 | +51.98% | 6% / ฿28.14 | — / — / — | 80/44/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/BALANCED` (48.0%) | 85 |
| 12 | `1735560032097961939` | เม็ดปักพี่ฝน 1 ซอง ราคาเฉพาะไลฟ์ | 89 | 5,665,567 | 63,387 | +897.79% | 13% / ฿11.57 | — / — / — | 80/44/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `MODERATE/LIVE` (2.0%) | 68 |
| 13 | `1731661332013680750` | [1แถม2] Vitamin C Acerola Cherry | 135 | 8,335,227 | 61,846 | -44.25% | 10% / ฿13.50 | — / — / — | 80/42/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (95.9%) | 70 |
| 14 | `1729437530297568140` | MAYBELLINE Superstay Vinyl Ink | 191 | 6,770,659 | 35,437 | -48.67% | 7% / ฿13.37 | — / — / — | 80/37/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (83.6%) | 88 |
| 15 | `1729424092832893836` | MAYBELLINE Superstay Matte Ink | 182 | 3,541,047 | 19,418 | -13.67% | 7% / ฿12.74 | — / — / — | 80/36/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (85.3%) | 86 |
| 16 | `1735933480387970400` | Ness (ขนาดมินิ) ออยล์บำรุงผิว 11 กลิ่น | 49 | 3,702,302 | 75,719 | +3.05% | 10% / ฿4.90 | — / — / — | 80/33/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `STRONG/VIDEO` (97.4%) | 85 |
| 17 | `1733396495220901248` | น้ำมันถั่วเหลือง ตราองุ่น 1 ลิตร x 12 | 753 | 3,750,816 | 4,978 | +19.16% | 1% / ฿7.53 | — / — / — | 80/15/—/— | — | `INSUFFICIENT_DATA` | 42 LOW | `MODERATE/LIVE` (34.0%) | 66 |
| 18 | `1737449944001578194` | Airpods 5 หูฟังไร้สาย | 4,220 | 4,127,594 | 978 | +98.65% | 0% / ฿0 | — / — / — | 78/0/—/— | 0 | `NOT_MONETIZABLE` | 42 LOW | `STRONG/BALANCED` (50.9%) | 73 |
| 19 | `1738545545522218819` | TD แหวน 1 กรัม ทองคำ | 4,945 | 3,550,589 | 718 | +53.50% | 0% / ฿0 | — / — / — | 77/0/—/— | 0 | `NOT_MONETIZABLE` | 42 LOW | `MODERATE/LIVE` (0.0%) | 70 |
| 20 | `1732077377460865234` | iPad A16 Gen 11 Wi-Fi | 16,760 | 5,011,280 | 299 | -35.96% | 0% / ฿0 | — / — / — | 73/0/—/— | 0 | `NOT_MONETIZABLE` | 42 LOW | `STRONG/BALANCED` (39.8%) | 67 |

*\* Raw `creator_number` and `product_review_count` values from `/detail`; time-window semantics remain `UNVERIFIED` and excluded from Competition/Quality scores.*

---

## 5. Strategy Validation (All 8 Strategies) (`INSUFFICIENT_DATA` / `DATA_UNAVAILABLE`)

| Strategy | Qualified | Partial | Excluded | Status Breakdown | Main Exclusion Reasons | Trustworthy Today? |
| :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| 1. **Early Market Opportunity** | 0 | 0 | 20 | 17 `INSUFFICIENT_DATA`, 3 `NOT_ELIGIBLE` | `verified_growth:UNVERIFIED` (20), `creatorCount:UNVERIFIED` (20), `data_confidence:FAILED` (20), `monetizable_commission:FAILED` (3) | **No** (`INSUFFICIENT_DATA`) |
| 2. **Underserved Demand** | 0 | 0 | 20 | 17 `INSUFFICIENT_DATA`, 3 `NOT_ELIGIBLE` | `creatorCount:UNVERIFIED` (20), `data_confidence:FAILED` (20), `monetizable_commission:FAILED` (3) | **No** (`INSUFFICIENT_DATA`) |
| 3. **Creator Yield Opportunity** | 0 | 0 | 20 | 17 `INSUFFICIENT_DATA`, 3 `NOT_ELIGIBLE` | `creatorCount:UNVERIFIED` (20), `data_confidence:FAILED` (20), `monetizable_commission:FAILED` (3) | **No** (`INSUFFICIENT_DATA`) |
| 4. **Fast Rising Products** | 0 | 0 | 20 | 20 `DATA_UNAVAILABLE` | `historical_snapshots:DATA_UNAVAILABLE` (20 — 0 snapshots; 2 required) | **No** (`DATA_UNAVAILABLE`) |
| 5. **Profit Maximizer** | 0 | 0 | 20 | 17 `INSUFFICIENT_DATA`, 3 `NOT_ELIGIBLE` | `creatorCount:UNVERIFIED` (20), `data_confidence:FAILED` (20), `payout_per_sale:FAILED` (8), `monetizable_commission:FAILED` (3) | **No** (`INSUFFICIENT_DATA`) |
| 6. **Video Proven Winners** | 0 | 0 | 20 | 17 `INSUFFICIENT_DATA`, 3 `NOT_ELIGIBLE` | `creatorCount:UNVERIFIED` (20), `data_confidence:FAILED` (20), `video_sales_evidence:FAILED` (4), `monetizable_commission:FAILED` (3) | **No** (`INSUFFICIENT_DATA`) |
| 7. **Trust-Based Winners** | 0 | 0 | 20 | 17 `INSUFFICIENT_DATA`, 3 `NOT_ELIGIBLE` | `rating:UNVERIFIED/UNAVAILABLE` (20), `creatorCount:UNVERIFIED` (20), `data_confidence:FAILED` (20), `monetizable_commission:FAILED` (3) | **No** (`INSUFFICIENT_DATA`) |
| 8. **Trend Timing Opportunity** | 0 | 0 | 20 | 20 `DATA_UNAVAILABLE` | `longitudinal_snapshots:DATA_UNAVAILABLE` (20 — 0 snapshots; 3 required) | **No** (`DATA_UNAVAILABLE`) |

**Integrity Confirmation (`VERIFIED`)**: Zero products were forced into any strategy; every exclusion reason accurately matched the underlying missing/unverified upstream field.

---

## 6. Real-World Findings & Analysis

1. **Does the discovery pipeline return commercially relevant products?**  
   - `VERIFIED`: **Yes (17/20)**. It returned high-velocity Thailand TikTok Shop products (`฿3.49M–฿8.34M` 7-day revenue) across Beauty, Health, Home Supplies, Furniture, and Fashion, with 12/17 monetizable items showing `STRONG/VIDEO` conversion evidence (`48%–97.4%` video share).  
   - `VERIFIED` upstream quirk: Kalodata `/rank` returned 3 zero-commission listings (iPad, AirPods, 1g Gold Ring) despite `is_affiliate: 1`; SiamVisual's `NOT_MONETIZABLE` gate caught and demoted all 3 cleanly.
2. **Are the highest-ranked products genuinely supported by available demand and earning evidence?**  
   - `VERIFIED` (**Defect Found & Fixed**): **Before the Phase 9 fix, NO** — because all 17 monetizable items shared `eligibilityStatus = 'INSUFFICIENT_DATA'`, `commercialOpportunityScore = null`, and `dataConfidence = 42`, both `rankCommercialOpportunitiesV2` and `rankProductIntelligenceV2` fell through to `productId.localeCompare`, sorting the live feed by ascending numeric TikTok product ID (putting a 7%/฿12.74 lipstick at `#1` and a 1%/฿7.53 soybean oil at `#10` ahead of 18%–20% skincare/supplements). **After the Phase 9 tie-breaker fix, YES** — preliminary ordering reflects verified Demand + Earning (`Earning 70, 59, 58, 57, 56` at `#1–#5` and `Earning 15` at `#17`), while keeping all 17 transparently labeled `INSUFFICIENT_DATA`.
3. **Are any products receiving suspiciously high scores because of missing metrics?**  
   - `VERIFIED`: **No**. Missing/unverified Competition and Customer Quality produce `score: null` (`INSUFFICIENT`), Data Confidence is penalized to `42 (LOW)`, and Gate 2 keeps `commercialOpportunityScore = null`.  
   - `VERIFIED` calibration observation (not altered in Phase 9): All 17 top-20 Thailand bestsellers exceeded `revenueMaxRefThb` (`฿1.5M`) and `salesMaxRefUnits` (`3,000`) and hit the `noGrowthCap = 80` ceiling, so Demand showed `80` across all 17. This is mathematically honest (not caused by missing data), though it limits Demand differentiation inside the top-20 tier until growth baseline is verified or higher-end revenue tiers are calibrated in a future dedicated calibration phase.
4. **Is creator competition data sufficient for reliable comparison?**  
   - `VERIFIED`: **No**. `/rank` omits `creator_number` completely (0/20); `/detail` returns `creator_number` (`343` and `1,028` on the 2 enriched items), which already suggests heavy crowding on top-20 bestsellers, but because Kalodata does not verify whether `creator_number` is 7-day active creators vs lifetime cumulative affiliates, RPC and Competition scoring cannot be reliably computed yet.
5. **Is customer quality data sufficient?**  
   - `VERIFIED`: **No**. Product `rating` is absent on both `/rank` and `/detail` (`need_extra: true`), and `product_review_count` time-window scope is unverified.
6. **Are the current 8 strategies useful with the available data?**  
   - `VERIFIED`: **Not yet for live qualification (0/20 qualified across all 8)**, because all 6 non-historical strategies require verified `creatorCount` (and `dataConfidence >= threshold`), while the 2 historical strategies require 2–3 saved multi-day snapshots. They currently act as honest safety gates preventing false recommendations.
7. **What prevents SiamVisual from confidently identifying the best products for video affiliate promotion?**  
   - `VERIFIED` blockers: (a) No verified creator competition scope (`creator_number` absent on `/rank`, unverified window on `/detail`), (b) No live product `rating` endpoint, (c) Unverified `revenue_growth_rate` comparison baseline, (d) Zero persisted historical snapshots across days, and (e) Top-20 revenue sort naturally surfaces mega-crowded items (`343–1,028` creators) rather than mid-tier emerging products.
8. **Which improvements would create the greatest practical value?** *(Hypotheses — ranked by impact)*  
   - **H1 (Highest impact)**: Verify `creator_number` and `revenue_growth_rate` semantics via Kalodata official docs/support or a controlled two-window probe (`last7Day` vs `last30Day` on 1 product = `0.20 cr`) to unlock Competition & Growth scoring cleanly.  
   - **H2**: Add optional revenue/price filter presets or pagination on `/rank` so creators can inspect rank `#21–#100` (emerging mid-tier products with lower crowding than top-20 mega-sellers).  
   - **H3**: Persist lightweight daily snapshots of searched products in local/server storage so `Fast Rising Products` and `Trend Timing Opportunity` can accumulate real longitudinal evidence over time.  
   - **H4**: Switch default UI Search from `forceRefresh: true` to `forceRefresh: false` (with an explicit Refresh button) so repeated searches within 10 minutes use `searchCache` (`0.00 cr`).

---

## 7. API Credit Usage & Efficiency (`VERIFIED`)

| Operation | Live Upstream Calls | Server Cache Hits | Credits Consumed | Notes |
| :--- | :---: | :---: | :---: | :--- |
| Balance check before/after (`/credit/balance`) | 4 | — | `0.00 cr` | Free endpoint (`9.90 cr` -> `9.30 cr`). |
| `/rank` product discovery (`20` products) | 1 | 2 | `0.20 cr` | Repeat calls with `forceRefresh: false` returned `fromCache: true`, `0.00 cr`. |
| `/detail` enrichment (Top 2 preliminary candidates) | 2 | 4 | `0.40 cr` | Repeat `/api/products/enrich` calls hit 30-min `detailLayerCache` with `0.00 cr`. |
| Expensive endpoints (`/analysis`, `/comment/insight`) | 0 | 0 | `0.00 cr` | Intentionally skipped in Phase 9. |
| **Total Phase 9 Spend** | **3 paid calls** | **6 cache hits** | **`0.60 cr`** | **Remaining balance: `9.30 cr`** |

- **Estimated credit cost per discovered product (`/rank` only)**: `0.20 / 20 = 0.01 cr/product`.
- **Estimated credit cost per detail-enriched candidate**: `+0.20 cr/product` on first fetch, `0.00 cr` within 30-min server cache (and `0.00 cr` permanently via browser `localStorage` once fetched).

---

## 8. Confirmed Defects Found & Fixes Applied

| Defect | Evidence from Live Run | Fix Applied | Impact |
| :--- | :--- | :--- | :--- |
| **`INSUFFICIENT_DATA` live products sorted by ascending numeric `product_id`** | All 17 live monetizable products shared `INSUFFICIENT_DATA`, `score: null`, `confidence: 42`, causing `rankCommercialOpportunitiesV2` and `rankProductIntelligenceV2` to sort by `a.productId.localeCompare(b.productId)` (placing 1% comm / Earning 15 soybean oil ahead of 18% comm / Earning 57 skincare). | Added deterministic verified-dimension tie-breaker (`mean of verified scored dimensions` -> `earningScore` -> `demandScore` -> `productId`) in `src/lib/scoringEngineV2.ts` and `src/lib/strategyEngineV2.ts`, ONLY when `eligibilityStatus`/`opportunityClassification`, `commercialOpportunityScore`, and `dataConfidence.score` are tied. | Top preliminary candidates now surface by real verified Demand + Earning evidence (`Earning 70, 59, 58, 57, 56` at `#1–#5`), while strictly preserving `INSUFFICIENT_DATA`, `commercialOpportunityScore = null`, all scoring formulas, and zero false strategy qualifications. |

*Regression test added*: `tests/phase9RealProductValidation.test.ts`.

---

## 9. Tests & Build Results (`VERIFIED`)

- **Test Suite**: `npx tsx --test tests/*.test.ts` — **`79/79` passed across `11` suites** (0 failed).
- **TypeScript Check**: `npm run lint` (`tsc --noEmit`) — **passed with 0 errors**.
- **Production Build**: `compile_applet` (`npm run build`) — **succeeded cleanly**.

---

## 10. Readiness Assessment (`PARTIALLY_VERIFIED`)

- **Production-Ready & Trustworthy Today (`VERIFIED`)**: Thailand `/rank` discovery, THB revenue & channel breakdown (`video` / `live` / `shopping_mall`), unit volume, verified `commission_rate` (`1%–100%`) & estimated payout, automatic `0%` commission (`NOT_MONETIZABLE`) demotion, Conversion Evidence (`STRONG/VIDEO` vs `LIVE`), on-demand `/detail` descriptions, and credit-saving server/browser caches.
- **Treat Cautiously (`PARTIALLY_VERIFIED` / `UNVERIFIED`)**: `revenue_growth_rate` (percentage-point unit verified, comparison baseline unverified), raw `creator_number` and `product_review_count` from `/detail` (useful rough scale cues, time-window scope unverified), and Video Suitability (V1 heuristic — creative fit only, not sales proof).
- **Not Yet Reliable (`INSUFFICIENT_DATA` / `DATA_UNAVAILABLE`)**: 4-pillar Commercial Opportunity composite ranking, creator competition / RPC scoring, Customer Quality / product ratings, and automated strategy qualification across all 8 strategies.
