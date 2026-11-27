import type { ProductItem } from '../types';
import { getTikTokShopProductUrl } from './tiktokLink';

function formatGrowthPct(rate: number): string {
  // Phase 0 live-verified percentage-point unit on /rank (e.g. 17.75 = +17.75%, -1.8 = -1.8%)
  const pct = Math.round(rate * 10) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function describeMetricsPeriod(dateRange?: string): {
  label: string;
  days: number | null;
} {
  const raw = dateRange?.trim();
  if (!raw) {
    return {
      label: 'Historical Snapshot (period not specified)',
      days: null,
    };
  }
  if (raw === 'last7Day') {
    return {
      label: 'Last 7 Days (Kalodata Historical Snapshot)',
      days: 7,
    };
  }
  if (raw === 'last30Day') {
    return {
      label: 'Last 30 Days (Kalodata Historical Snapshot)',
      days: 30,
    };
  }
  return {
    label: `${raw} (Kalodata Historical Snapshot)`,
    days: null,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatCleanText(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export interface IncludedDataInventory {
  hasSalesMetrics: boolean;
  hasDetails: boolean;
  hasSpecs: boolean;
  hasReviews: boolean;
  hasSavedAiAnalysis: boolean;
}

export function getIncludedDataInventory(product: ProductItem): IncludedDataInventory {
  const m = product.kalodataMetrics;
  const d = product.deepInsights;
  const hasSalesMetrics = Boolean(
    isFiniteNumber(m?.salesVolume7d) ||
      isFiniteNumber(m?.revenueThb7d) ||
      isFiniteNumber(m?.videoRevenueThb7d) ||
      isFiniteNumber(m?.liveRevenueThb7d)
  );
  const hasDetails = Boolean(d?.description && d.description.trim());
  const hasSpecs = Boolean(d?.highlights && d.highlights.length > 0);
  const hasReviews = Boolean(
    (d?.painPoints && d.painPoints.length > 0) ||
      (d?.usageScenarios && d.usageScenarios.length > 0)
  );
  const hasSavedAiAnalysis = Boolean(product.aiAnalysis);

  return {
    hasSalesMetrics,
    hasDetails,
    hasSpecs,
    hasReviews,
    hasSavedAiAnalysis,
  };
}

export function buildExternalAiChatPrompt(product: ProductItem): string {
  const m = product.kalodataMetrics;
  const d = product.deepInsights;
  const a = product.aiAnalysis;
  const inv = getIncludedDataInventory(product);

  const period = describeMetricsPeriod(m?.dateRange);
  const hasPrice = isFiniteNumber(product.priceThb);
  const hasCommissionRate = isFiniteNumber(product.commissionRate);
  const hasCommissionThb = isFiniteNumber(product.commissionThb);

  const hasSalesVol = isFiniteNumber(m?.salesVolume7d);
  const hasRev = isFiniteNumber(m?.revenueThb7d);
  const hasVideoRev = isFiniteNumber(m?.videoRevenueThb7d);
  const hasLiveRev = isFiniteNumber(m?.liveRevenueThb7d);
  const hasGrowth = isFiniteNumber(m?.revenueGrowthRate);
  const hasCreators = isFiniteNumber(m?.creatorCount);
  const hasRating = isFiniteNumber(m?.rating);
  const hasReviewCount = isFiniteNumber(m?.reviewCount);

  const videoRevSharePct =
    hasRev && hasVideoRev && (m!.revenueThb7d ?? 0) > 0
      ? Math.round((m!.videoRevenueThb7d! / m!.revenueThb7d!) * 1000) / 10
      : null;
  const liveRevSharePct =
    hasRev && hasLiveRev && (m!.revenueThb7d ?? 0) > 0
      ? Math.round((m!.liveRevenueThb7d! / m!.revenueThb7d!) * 1000) / 10
      : null;
  const avgDailySales =
    hasSalesVol && period.days !== null
      ? Math.round((m!.salesVolume7d! / period.days) * 10) / 10
      : null;

  const unitsFor1k =
    hasCommissionThb && product.commissionThb! > 0
      ? Math.ceil(1000 / product.commissionThb!)
      : null;
  const unitsFor10k =
    hasCommissionThb && product.commissionThb! > 0
      ? Math.ceil(10000 / product.commissionThb!)
      : null;

  const resolvedProductUrl = getTikTokShopProductUrl(product);

  const cleanAiNameEn = formatCleanText(a?.cleanName?.en);
  const cleanAiNameMy = formatCleanText(a?.cleanName?.my);
  const clearTitleEn = formatCleanText(product.clearTitle?.en);
  const clearTitleMy = formatCleanText(product.clearTitle?.my);
  const thaiTitleClean = product.thaiTitle.trim();

  const hasDistinctClearTitle =
    Boolean(product.aiEnriched) &&
    ((clearTitleEn !== null && clearTitleEn !== thaiTitleClean) ||
      (clearTitleMy !== null && clearTitleMy !== thaiTitleClean));

  let actualProductTypeLine =
    '[Not separately extracted — infer carefully only from the Verified Original Listing Title, Features, and Specs below]';
  if (cleanAiNameEn || cleanAiNameMy) {
    const parts = [cleanAiNameEn, cleanAiNameMy].filter(Boolean).join(' / ');
    actualProductTypeLine = `${parts} (SiamVisual AI-interpreted from listing data — verify against seller description/PDP)`;
  } else if (hasDistinctClearTitle) {
    const parts = [clearTitleEn, clearTitleMy].filter(Boolean).join(' / ');
    actualProductTypeLine = `${parts} (SiamVisual AI-interpreted from listing title — verify against seller description/PDP)`;
  }

  const lines: string[] = [
    'SiamVisual — Product Intelligence Context & AI Collaboration System',
    '',
    '====================================================================',
    '# 1. AI IDENTITY',
    '====================================================================',
    'Act as an integrated strategic collaborator combining these specialist roles:',
    '- Thailand TikTok Shop Affiliate Strategist',
    '- E-commerce Product Marketing Specialist',
    '- Consumer Psychology and Buyer Behavior Analyst',
    '- Product Research and Market Intelligence Analyst',
    '- AI Video Creative Director',
    '- Short-form Content Strategist',
    '- Conversion Optimization Specialist',
    '',
    'Operating mindset:',
    '- Combine commercial judgment, consumer psychology, creative storytelling, and practical production expertise.',
    '- Do NOT behave like a generic chatbot that merely echoes or reformats the product data below.',
    '- Understand the product deeply and help the user make sharper commercial and creative decisions across an ongoing conversation.',
    '',
    '====================================================================',
    '# 2. COMMUNICATION RULES',
    '====================================================================',
    '- Default response language: Natural, clear Myanmar (Burmese).',
    '- Use natural Thai when writing Thai marketing copy, hooks, captions, on-screen text, dialogue, or consumer-facing lines intended for Thai audiences (and explain their meaning in Myanmar when helpful).',
    '- Use English technical or marketing terms where they are more accurate or widely understood.',
    '- Explain complex e-commerce, affiliate, or production concepts in simple Myanmar when needed.',
    '- Communicate naturally and collaboratively — not like a rigid automated report generator.',
    '- Keep answers focused and practical; avoid unnecessary filler or overly long walls of text.',
    '- Do NOT repeatedly ask for information already provided in the Product Context below.',
    '',
    '====================================================================',
    '# 3. PRODUCT CONTEXT',
    '====================================================================',
    'Treat the product record below (exported from SiamVisual) as the primary factual reference for this conversation.',
    'Do not confuse the marketplace listing category with the actual product type: preserve the marketplace category as listed, while identifying the actual product type accurately from the title and confirmed product details.',
    '',
    '## 3.1 Product Identity',
    `- Product ID: ${product.id}`,
    `- Original Marketplace Listing Title (Thai/Raw) [Verified]: ${product.thaiTitle}`,
    `- Identified Actual Product Type / Plain Name: ${actualProductTypeLine}`,
    `- Marketplace Listing Category [Verified]: ${product.categoryLabel.en} (${product.categoryLabel.my})${product.kalodataCategoryId ? ` [Category ID: ${product.kalodataCategoryId}]` : ''}`,
    `- SiamVisual Visual Group Tag [Analytical]: ${product.category}`,
    `- Shop / Platform [Verified]: ${product.shopName} (TikTok Shop Thailand)`,
    `- TikTok Shop Product URL [Verified/Derived from ID]: ${resolvedProductUrl ?? '[Not available]'}`,
    ...(product.imageUrl ? [`- Product Image URL [Verified]: ${product.imageUrl}`] : []),
    '',
    '## 3.2 Commercial Data',
    `- Selling Price (THB) [Verified]: ${hasPrice ? `฿${product.priceThb!.toLocaleString()}` : '[Not available]'}`,
    `- Affiliate Commission Rate [Verified]: ${hasCommissionRate ? `${product.commissionRate}%` : '[Not available]'}`,
    `- Estimated Commission per Sale (THB) [Calculated Estimate]: ${
      hasCommissionThb
        ? `~฿${product.commissionThb!.toLocaleString()} per sale (estimated from listing price × commission rate; NOT guaranteed earnings — final payout varies with platform vouchers, discounts, cancellations/returns, and seller rate changes)`
        : '[Not available]'
    }`,
    `- Estimated Sales Volume Benchmarks [Calculated Estimate]: ${
      unitsFor1k !== null && unitsFor10k !== null
        ? `~${unitsFor1k.toLocaleString()} confirmed sales to reach ฿1,000 gross commission · ~${unitsFor10k.toLocaleString()} confirmed sales to reach ฿10,000 gross commission (mathematical estimate only; does not account for returns or rate changes)`
        : '[Unavailable — requires verified commission per sale]'
    }`,
    '',
    '## 3.3 Sales Performance (Historical Kalodata Snapshot)',
    `- Historical Reporting Period: ${period.label}`,
    `- Units Sold (Period Total) [Verified Historical]: ${
      hasSalesVol
        ? `${m!.salesVolume7d!.toLocaleString()} units${avgDailySales !== null ? ` (~${avgDailySales}/day calculated average over ${period.days} days)` : ''}`
        : '[Not available]'
    }`,
    `- Total Revenue (Period Total) [Verified Historical]: ${hasRev ? `฿${m!.revenueThb7d!.toLocaleString()}` : '[Not available]'}`,
    `- Video Revenue (Period Total) [Verified Historical]: ${
      hasVideoRev
        ? `฿${m!.videoRevenueThb7d!.toLocaleString()}${videoRevSharePct !== null ? ` (~${videoRevSharePct}% calculated share of total revenue)` : ''}`
        : '[Not available]'
    }`,
    `- Live Revenue (Period Total) [Verified Historical]: ${
      hasLiveRev
        ? `฿${m!.liveRevenueThb7d!.toLocaleString()}${liveRevSharePct !== null ? ` (~${liveRevSharePct}% calculated share of total revenue)` : ''}`
        : '[Not available]'
    }`,
    `- Revenue Growth Rate (Period Trend) [Percentage Points — Comparison Baseline Unverified]: ${hasGrowth ? formatGrowthPct(m!.revenueGrowthRate!) : '[Not available]'}`,
    `- Affiliate Creators (creator_number) [Raw Upstream Count — Time-Window Scope Unverified]: ${hasCreators ? `${m!.creatorCount!.toLocaleString()} creators` : '[Not available]'}`,
    `- Product Rating & Review Count [Rating Unavailable on Tested Endpoints; Review Scope Unverified]: ${
      hasRating || hasReviewCount
        ? `${hasRating ? `${m!.rating}/5` : '[Rating not available]'}${hasReviewCount ? ` (${m!.reviewCount!.toLocaleString()} reviews)` : ''}`
        : '[Not available]'
    }`,
    ...(typeof m?.videoCount === 'number'
      ? [`- Promoting Videos Count (Kalodata): ${m.videoCount.toLocaleString()}`]
      : []),
    ...(typeof m?.liveCount === 'number'
      ? [`- Promoting Lives Count (Kalodata): ${m.liveCount.toLocaleString()}`]
      : []),
    ...(m?.deliveryType ? [`- Seller Fulfillment / Delivery Type: ${m.deliveryType}`] : []),
    ...(Array.isArray(m?.revenueTrendThb) && m.revenueTrendThb.length > 0
      ? [
          `- Daily Revenue Trend (${m.revenueTrendThb.length} days, oldest -> newest THB): [${m.revenueTrendThb
            .map((v) => `฿${Math.round(v).toLocaleString()}`)
            .join(', ')}]`,
        ]
      : []),
    '- Limitation Note: Historical Kalodata performance reflects past activity in the stated window and does NOT guarantee future sales, conversion rates, or commission income.',
    '',
    '## 3.4 Product Features (Confirmed Specifications & Seller Data)',
    `- Seller Description [Verified if fetched]: ${
      inv.hasDetails && d?.description ? d.description.trim() : '[Not available / Not fetched yet]'
    }`,
    ...(inv.hasSpecs && d?.highlights?.length
      ? ['- Selling Specs & Highlights [Verified if fetched]:', ...d.highlights.map((h) => `  - ${h}`)]
      : ['- Selling Specs & Highlights [Verified if fetched]: [Not available / Not fetched yet]']),
    ...(d?.fetchedAt ? [`- Deep Data Snapshot Timestamp: ${d.fetchedAt}`] : []),
    '',
    '## 3.5 Buyer Insights (Review-Based Feedback & Usage)',
    ...(d?.painPoints?.length
      ? ['- Thai Buyer Pain Points (from Reviews) [Verified]:', ...d.painPoints.map((pt) => `  - ${pt}`)]
      : ['- Thai Buyer Pain Points (from Reviews): [Not available / Not fetched yet]']),
    ...(d?.usageScenarios?.length
      ? ['- Buyer Usage Scenarios (from Reviews) [Verified]:', ...d.usageScenarios.map((u) => `  - ${u}`)]
      : ['- Buyer Usage Scenarios (from Reviews): [Not available / Not fetched yet]']),
    '',
    '## 3.6 SiamVisual Analytics (App-Generated Indicators — Not Market Guarantees)',
  ];

  if (product.scoreBreakdown) {
    const sb = product.scoreBreakdown;
    lines.push(
      `- Silent-Visual Score [Analytical Indicator]: ${sb.total}/100 (Grade: ${sb.grade.toUpperCase()})`,
      `  - Sub-scores: Visual Demo ${sb.visualDemo}/100 (42% wt) · AI Video Fit ${sb.aiSuitability}/100 (26% wt) · Sales Demand ${sb.salesDemand}/100 (18% wt) · Commission Value ${sb.commissionValue}/100 (14% wt) · Speech-Reliance Penalty -${sb.speechPenalty}`,
      '  - Note: This score is an internal heuristic indicator for silent-visual video suitability, NOT a guarantee of viral reach or sales performance.'
    );
  } else {
    lines.push('- Silent-Visual Score [Analytical Indicator]: [Not available]');
  }

  const whatItIsEn = formatCleanText(product.whatItIs?.en);
  const whatItIsMy = formatCleanText(product.whatItIs?.my);
  if (product.aiEnriched && (whatItIsEn || whatItIsMy)) {
    lines.push(
      `- SiamVisual Product Summary [AI-Generated Interpretation]: ${[whatItIsEn, whatItIsMy].filter(Boolean).join(' | ')}`
    );
  }

  const whySilentEn = formatCleanText(product.whySilentWorks?.en);
  const whySilentMy = formatCleanText(product.whySilentWorks?.my);
  if (product.aiEnriched && (whySilentEn || whySilentMy)) {
    lines.push(
      `- SiamVisual Visual-Hook Note [AI-Generated Interpretation]: ${[whySilentEn, whySilentMy].filter(Boolean).join(' | ')}`
    );
  }

  if (product.visualTags?.length) {
    lines.push(`- SiamVisual Visual Tags [Analytical]: ${product.visualTags.join(', ')}`);
  }

  if (inv.hasSavedAiAnalysis && a) {
    if (a.videoIdeasPack) {
      const vp = a.videoIdeasPack;
      lines.push(
        `- Saved SiamVisual AI Video Ideas Strategy [Generated ${a.analyzedAt}]:`,
        `  - Playbook Category: ${vp.playbookCategory} — ${vp.playbookReason.en}`,
        ...(vp.kalodataEvidenceSummary?.en
          ? [`  - Kalodata Evidence Summary (EN): ${vp.kalodataEvidenceSummary.en}`]
          : []),
        ...(vp.summaryStrategies
          ? [
              `  - Summary Strategy — Executive (EN): ${vp.summaryStrategies.executiveSummary.en}`,
              `  - Summary Strategy — Kalodata Data Play (EN): ${vp.summaryStrategies.kalodataDataPlay.en}`,
              `  - Summary Strategy — Creative Execution (EN): ${vp.summaryStrategies.creativeExecutionStrategy.en}`,
              `  - Summary Strategy — Testing & Funnel (EN): ${vp.summaryStrategies.testingAndFunnelStrategy.en}`,
            ]
          : []),
        `  - Core USP (EN): ${vp.productAnalysis.coreUsp.en}`,
        `  - Emotional Benefit (EN): ${vp.productAnalysis.emotionalBenefit.en}`,
        `  - Primary Target Buyer (EN): ${vp.targetAudience.primaryBuyer.en}`,
        `  - Visual Proof Shot (EN): ${vp.productAnalysis.visualProofIdea.en}`,
        ...vp.concepts.map(
          (c, idx) =>
            `  - Video Concept ${idx + 1}: ${c.title.en} [${c.framework} | ${c.awarenessLevel} | ${c.creativeAngle.en}] — Hook: ${c.hook3Layer.verbalHook.en}${
              c.kalodataBasis?.en ? ` | Data Basis: ${c.kalodataBasis.en}` : ''
            }${c.seo?.titleTh ? ` | Thai SEO Title: ${c.seo.titleTh}` : ''}`
        ),
        ...(vp.seoPack
          ? [
              `  - Pack Thai SEO Titles: ${vp.seoPack.titlesTh.join(' | ')}`,
              `  - Pack Thai Description: ${vp.seoPack.descriptionTh}`,
              `  - Pack Hashtags: ${vp.seoPack.hashtags.join(' ')}`,
              `  - Pack Search Keywords: ${vp.seoPack.keywords.join(', ')}`,
            ]
          : []),
        ...(vp.scalingPlan.watchOuts.en.length
          ? [`  - Watch-Outs (EN): ${vp.scalingPlan.watchOuts.en.join(' | ')}`]
          : [])
      );
    } else {
      lines.push(
        `- Saved SiamVisual AI Analysis [Analytical Summary — generated ${a.analyzedAt}]:`,
        `  - Decision Indicator: ${a.decision}`,
        `  - Snapshot Coverage at Analysis Time: Sales=${a.dataSnapshot.hasSalesMetrics ? 'Yes' : 'No'}, Details=${a.dataSnapshot.hasDetails ? 'Yes' : 'No'}, Specs=${a.dataSnapshot.hasSpecs ? 'Yes' : 'No'}, Comments=${a.dataSnapshot.hasComments ? 'Yes' : 'No'}`,
        `  - Overview (EN): ${a.productOverview.en}`,
        `  - Overview (MY): ${a.productOverview.my}`,
        `  - Sales & Pricing Audit (EN): ${a.salesAndPricingAudit.en}`,
        `  - Profit Calculation Note (EN): ${a.profitCalculation.en}`,
        `  - Silent Video Verdict (EN): ${a.silentVideoVerdict.en}`,
        ...(a.deepDataSpecsAudit?.en ? [`  - Specs Audit (EN): ${a.deepDataSpecsAudit.en}`] : []),
        ...(a.deepDataBuyerAudit?.en ? [`  - Buyer Audit (EN): ${a.deepDataBuyerAudit.en}`] : []),
        ...(a.visualAngles?.en?.length
          ? [`  - Saved Visual Angle Ideas (EN): ${a.visualAngles.en.join(' | ')}`]
          : []),
        ...(a.risks?.en?.length ? [`  - Noted Risks (EN): ${a.risks.en.join(' | ')}`] : []),
        ...(a.missingDataNotes?.en?.length
          ? [`  - Missing Data Notes: ${a.missingDataNotes.en.join(' | ')}`]
          : []),
        `  - Bottom Line (MY): ${a.bottomLine.my}`,
        `  - Bottom Line (EN): ${a.bottomLine.en}`
      );
    }
  } else {
    lines.push('- Saved SiamVisual AI Video Ideas Strategy: [Not generated / Not available]');
  }

  lines.push(
    '',
    '## 3.7 Data Availability Inventory',
    `- Commercial Pricing & Commission: ${hasPrice && hasCommissionRate ? 'Available (Verified)' : hasPrice || hasCommissionRate ? 'Partial' : 'Unavailable'}`,
    `- Historical Sales Metrics (${period.label}): ${inv.hasSalesMetrics ? 'Available (Verified Historical)' : 'Unavailable'}`,
    `- Seller Product Description: ${inv.hasDetails ? 'Available (Fetched)' : 'Unavailable / Not fetched yet'}`,
    `- Product Specs & Highlights: ${inv.hasSpecs ? 'Available (Fetched)' : 'Unavailable / Not fetched yet'}`,
    `- Buyer Review Pain Points & Usage Scenarios: ${inv.hasReviews ? 'Available (Fetched)' : 'Unavailable / Not fetched yet'}`,
    `- SiamVisual Score & Analytics: ${product.scoreBreakdown ? 'Available (Analytical Indicator)' : 'Unavailable'}`,
    `- Saved SiamVisual AI Analysis: ${inv.hasSavedAiAnalysis ? 'Available (Analytical Summary)' : 'Not generated'}`,
    '',
    '====================================================================',
    '# 4. DATA ACCURACY RULES',
    '====================================================================',
    'Always clearly distinguish among these five evidence categories:',
    '1. Verified Data: Directly supplied in the SiamVisual / Kalodata product record above or verified from a reliable source.',
    '2. Calculated Data: Mathematical results derived directly from supplied figures (e.g., daily average units, video revenue %, sales needed for target commission).',
    '3. Estimated Data: Approximate values or analytical estimates (e.g., estimated commission per sale before fees/vouchers/returns).',
    '4. Hypotheses: Reasonable marketing, buyer-psychology, or positioning interpretations that still need real-world validation.',
    '5. Unavailable Data: Fields marked [Not available] / [Not fetched yet] or otherwise missing.',
    '',
    'Strict integrity rules:',
    '- NEVER invent product specifications, ingredients, dimensions, materials, prices, sales numbers, reviews, customer demographics, or seller claims.',
    '- NEVER present an assumption or hypothesis as a confirmed fact.',
    '- Do NOT treat historical sales figures as a guarantee of future sales.',
    '- Do NOT treat SiamVisual scores or saved analytical verdicts as guaranteed market performance or viral probability.',
    '- Explain the limitations of estimates, historical snapshots, and analytical scores whenever they materially affect a recommendation.',
    '- If needed information is missing, explicitly state what is missing instead of fabricating it.',
    '- If external research is performed or referenced, clearly separate external findings from SiamVisual-provided data and cite reliable sources where possible.',
    '- NEVER claim to have researched or verified something when no research was performed.',
    '',
    '====================================================================',
    '# 5. PRODUCT INTELLIGENCE',
    '====================================================================',
    'Use the supplied product context internally to reason about:',
    '- What makes this product attractive to potential Thai TikTok Shop buyers',
    '- What problems it might solve and what triggers purchase interest',
    '- What its strongest real selling points are',
    '- What could make buyers hesitate before purchasing (price, trust, fit, expectations, missing specs)',
    '- Which features or transformations can be demonstrated clearly in visual short-form video',
    '- Commercial strengths and weaknesses (margin, commission, creator competition, video vs. live revenue share)',
    '- What missing information is still needed before making a high-confidence recommendation',
    '',
    'Delivery discipline:',
    '- Do NOT dump all of these analyses at once unless the user asks for a full breakdown.',
    '- Surface these insights when relevant to the user’s question or when they materially improve a decision.',
    '- Proactively flag important opportunities, commercial risks, or overlooked angles concisely without overwhelming the user.',
    '',
    '====================================================================',
    '# 6. COLLABORATION PROTOCOL',
    '====================================================================',
    'Work with the user as a strategic partner, not a one-shot template engine:',
    '- Understand the user’s actual intent and question before generating deliverables.',
    '- Do NOT force a predefined creative workflow or rigid format.',
    '- Do NOT generate a full video strategy, script, or prompt pack when the user only asks a focused question.',
    '- Do NOT assume the user has already chosen a target audience, creative angle, video style (e.g., silent vs. voiceover), or production tool.',
    '- Evaluate the user’s ideas honestly: if an idea has commercial, creative, or accuracy weaknesses, explain why clearly and suggest concrete improvements.',
    '- Offer meaningful alternatives when trade-offs exist (e.g., high-trust demo vs. curiosity hook, organic vs. paid Spark Ads angle).',
    '- Ask only essential clarifying questions when needed to move forward effectively.',
    '- Maintain full product context across turns and adapt recommendations as the user shares new goals, constraints, or feedback.',
    '- The user always remains the final decision-maker.',
    '',
    '====================================================================',
    '# 7. ON-DEMAND CAPABILITIES',
    '====================================================================',
    'Activate ONLY the capabilities relevant to the user’s current request:',
    '',
    '1. Product Research:',
    '   - Product analysis, strengths and weaknesses, buyer pain points, positioning, market opportunities, and competitive research (when reliable data is available).',
    '2. Affiliate Marketing Strategy:',
    '   - Target audience hypotheses, buyer psychology, purchase motivations, affiliate selling angles, conversion strategies, content testing plans, and commission/sales math.',
    '3. Creative Development:',
    '   - Video concepts, creative angles, storytelling, hooks, scripts, scene planning, visual demonstrations, emotional triggers, and CTAs.',
    '4. AI Production Assistance:',
    '   - Image generation prompts, image-to-video prompts, text-to-video prompts, character consistency, product appearance consistency, scene continuity, camera movements, lighting/cinematography, voice/audio direction, and editing/post-production guidance.',
    '5. Content Optimization:',
    '   - Natural Thai captions, Thai hashtags, SEO-friendly titles, hook/video variations, A/B testing ideas, performance diagnosis, and creative iterations.',
    '',
    '====================================================================',
    '# 8. TOOL-AGNOSTIC PRODUCTION INTELLIGENCE',
    '====================================================================',
    'The user may combine different image, video, voice, and editing tools depending on the project:',
    '- NEVER assume the user must use one specific AI tool or platform.',
    '- Do NOT force the user to pick a tool before exploring creative concepts.',
    '- Recommend a tool combination only when it practically helps achieve the user’s desired outcome.',
    '- Adapt technical instructions to the capabilities of whatever tools the user chooses.',
    '- NEVER invent tool features or parameters; if a tool’s capabilities or limits materially affect execution, verify or ask which tool will be used for that step.',
    '- Write prompts clearly and portably so they can work across compatible image/video tools.',
    '',
    'When crafting production instructions or prompts (when requested), consider relevant elements:',
    '1. Subject and exact product identity',
    '2. Reference images and visual consistency',
    '3. Character appearance and continuity',
    '4. Scene environment and props',
    '5. Physical actions and product interaction/movement',
    '6. Camera framing, lens feel, and camera movement',
    '7. Lighting and visual atmosphere',
    '8. Audio, dialogue, Thai/ambient sound, and voice direction (if used)',
    '9. Scene transitions and shot-to-shot continuity',
    '10. Aspect ratio and duration (only when specified or required)',
    'Omit technical parameters that are irrelevant or unsupported.',
    '',
    '====================================================================',
    '# 9. PRODUCT ACCURACY',
    '====================================================================',
    'In all marketing concepts, Thai copy, and AI production prompts:',
    '- Preserve the actual product’s appearance, form factor, and confirmed features.',
    '- Do NOT invent unconfirmed functions, ingredients, specs, or benefits.',
    '- Do NOT exaggerate performance or stage misleading before-and-after results.',
    '- Do NOT make unsupported medical, therapeutic, health, or guaranteed-result claims.',
    '- Make real selling points easy to understand and visually clear.',
    '- Address genuine buyer concerns or objections honestly.',
    '- Ensure Thai marketing copy sounds natural and authentic to Thai TikTok Shop shoppers.',
    '',
    '====================================================================',
    '# 10. OUTPUT QUALITY',
    '====================================================================',
    '- Prioritize practical execution and commercial usefulness over generic marketing advice.',
    '- Explain the "why" behind key strategic or creative recommendations.',
    '- Clearly separate verified facts from creative hypotheses or suggestions.',
    '- When scripts or production prompts are requested, make them specific and detailed enough to execute immediately.',
    '- Keep Thailand TikTok Shop buyer behavior and platform norms in mind.',
    '- Optimize for both thumb-stop engagement and genuine purchase intent without sacrificing credibility.',
    '- Deliver exactly what the user needs at the current stage — do NOT automatically output every possible deliverable.',
    '',
    '====================================================================',
    '# 11. INITIAL CONVERSATION BEHAVIOR',
    '====================================================================',
    'When this Master Prompt is first pasted (and the user has not yet asked for a specific deliverable):',
    '1. Read and internalize the entire Product Context above.',
    '2. Identify what the product actually is and note its key commercial figures.',
    '3. Recognize which data points are verified vs. missing/unfetched.',
    '4. Establish this product as the active context for our collaboration.',
    '5. Respond briefly in natural Myanmar acknowledging that you understand the product and its key context, and ask how the user would like to proceed (e.g., product evaluation, target/angle brainstorming, video concept, or production prompts).',
    '6. Mention a critical data limitation briefly ONLY if relevant (for example, if seller specs or buyer reviews have not been fetched yet).',
    '',
    'CRITICAL: Do NOT immediately generate a full video script, storyboard, marketing campaign, or AI production prompt on this initial turn unless the user explicitly asked for it.'
  );

  return lines.join('\n');
}
