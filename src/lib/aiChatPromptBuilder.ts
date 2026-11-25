import type { ProductItem } from '../types';
import { getTikTokShopProductUrl } from './tiktokLink';

function formatGrowthPct(rate: number): string {
  const pct =
    Math.abs(rate) <= 3 && rate !== 0
      ? Math.round(rate * 1000) / 10
      : Math.round(rate * 10) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
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
    (typeof m?.salesVolume7d === 'number' && Number.isFinite(m.salesVolume7d)) ||
      (typeof m?.revenueThb7d === 'number' && Number.isFinite(m.revenueThb7d)) ||
      (typeof m?.videoRevenueThb7d === 'number' && Number.isFinite(m.videoRevenueThb7d))
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
  const inv = getIncludedDataInventory(product);

  const hasSalesVol = typeof m?.salesVolume7d === 'number' && Number.isFinite(m.salesVolume7d);
  const hasRev = typeof m?.revenueThb7d === 'number' && Number.isFinite(m.revenueThb7d);
  const hasVideoRev =
    typeof m?.videoRevenueThb7d === 'number' && Number.isFinite(m.videoRevenueThb7d);
  const hasLiveRev =
    typeof m?.liveRevenueThb7d === 'number' && Number.isFinite(m.liveRevenueThb7d);
  const hasGrowth =
    typeof m?.revenueGrowthRate === 'number' && Number.isFinite(m.revenueGrowthRate);
  const hasCreators = typeof m?.creatorCount === 'number' && Number.isFinite(m.creatorCount);
  const hasRating = typeof m?.rating === 'number' && Number.isFinite(m.rating);
  const hasReviewCount = typeof m?.reviewCount === 'number' && Number.isFinite(m.reviewCount);

  const videoRevSharePct =
    hasRev && hasVideoRev && (m!.revenueThb7d ?? 0) > 0
      ? Math.round((m!.videoRevenueThb7d! / m!.revenueThb7d!) * 1000) / 10
      : null;
  const avgDailySales = hasSalesVol ? Math.round((m!.salesVolume7d! / 7) * 10) / 10 : null;
  const unitsFor1k =
    product.commissionThb && product.commissionThb > 0
      ? Math.ceil(1000 / product.commissionThb)
      : null;
  const unitsFor10k =
    product.commissionThb && product.commissionThb > 0
      ? Math.ceil(10000 / product.commissionThb)
      : null;

  const lines: string[] = [
    '# ROLE',
    'You are a **Thailand TikTok Shop Affiliate Strategist** and **AI Video Creative Director**.',
    '',
    'I am going to create an **AI-generated video** to promote and sell the Thailand TikTok Shop product below.',
    '- Please **reply in natural, clear Myanmar (Burmese) language by default**.',
    '- Rely strictly on the real product data below (do not invent missing numbers, specs, or reviews).',
    '',
    '---',
    '',
    '# PRODUCT DATA',
    `- **Product ID:** \`${product.id}\``,
    `- **Original Thai Listing Title:** ${product.thaiTitle}`,
  ];

  lines.push(
    `- **Category:** ${product.categoryLabel.en} (${product.categoryLabel.my})${product.kalodataCategoryId ? ` [ID: ${product.kalodataCategoryId}]` : ''}`,
    `- **Shop Name:** ${product.shopName}`
  );

  const resolvedProductUrl = getTikTokShopProductUrl(product);
  if (resolvedProductUrl) {
    lines.push(`- **TikTok Shop Product Link:** ${resolvedProductUrl}`);
  }

  lines.push(
    `- **Price (THB):** ${product.priceThb !== null ? `฿${product.priceThb.toLocaleString()}` : '[Not available]'}`,
    `- **Affiliate Commission:** ${
      product.commissionRate !== null
        ? `${product.commissionRate}%${product.commissionThb !== null ? ` (฿${product.commissionThb.toLocaleString()} per sale)` : ''}`
        : '[Not available]'
    }`
  );

  if (unitsFor1k !== null && unitsFor10k !== null) {
    lines.push(
      `- **Commission Math:** ${unitsFor1k.toLocaleString()} sales for ฿1,000 · ${unitsFor10k.toLocaleString()} sales for ฿10,000`
    );
  }

  lines.push(
    '',
    '## Kalodata 7-Day Performance Metrics',
    `- **7d Units Sold:** ${hasSalesVol ? `${m!.salesVolume7d!.toLocaleString()} units${avgDailySales !== null ? ` (~${avgDailySales}/day)` : ''}` : '[Not available]'}`,
    `- **7d Total Revenue:** ${hasRev ? `฿${m!.revenueThb7d!.toLocaleString()}` : '[Not available]'}`,
    `- **7d Video Revenue:** ${
      hasVideoRev
        ? `฿${m!.videoRevenueThb7d!.toLocaleString()}${videoRevSharePct !== null ? ` (${videoRevSharePct}% of total revenue)` : ''}`
        : '[Not available]'
    }`
  );

  if (hasLiveRev) {
    lines.push(`- **7d Live Revenue:** ฿${m!.liveRevenueThb7d!.toLocaleString()}`);
  }

  lines.push(
    `- **Revenue Growth Rate:** ${hasGrowth ? formatGrowthPct(m!.revenueGrowthRate!) : '[Not available]'}`,
    `- **Active Affiliate Creators:** ${hasCreators ? `${m!.creatorCount!.toLocaleString()} creators` : '[Not available]'}`
  );

  if (hasRating || hasReviewCount) {
    lines.push(
      `- **Product Rating / Reviews:** ${hasRating ? `${m!.rating}/5` : '—'}${hasReviewCount ? ` (${m!.reviewCount!.toLocaleString()} reviews)` : ''}`
    );
  }

  if (product.scoreBreakdown) {
    const sb = product.scoreBreakdown;
    lines.push(
      `- **Silent-Visual Score:** ${sb.total}/100 (Visual Demo ${sb.visualDemo}, AI Video Fit ${sb.aiSuitability}, Demand ${sb.salesDemand}, Commission ${sb.commissionValue}, Speech Penalty -${sb.speechPenalty})`
    );
  }

  lines.push('', '## Kalodata Deep Data');
  if (inv.hasDetails && d?.description) {
    lines.push(`- **Seller Description:** ${d.description}`);
  } else {
    lines.push('- **Seller Description:** [Not fetched yet]');
  }
  if (inv.hasSpecs && d?.highlights?.length) {
    lines.push(`- **Selling Specs & Highlights:** ${d.highlights.join(' | ')}`);
  } else {
    lines.push('- **Selling Specs & Highlights:** [Not fetched yet]');
  }
  if (d?.painPoints?.length) {
    lines.push(
      '- **Thai Buyer Pain Points (from Reviews):**',
      ...d.painPoints.map((pt) => `  - ${pt}`)
    );
  } else {
    lines.push('- **Thai Buyer Pain Points:** [Not fetched yet]');
  }
  if (d?.usageScenarios?.length) {
    lines.push(
      '- **Buyer Usage Scenarios (from Reviews):**',
      ...d.usageScenarios.map((u) => `  - ${u}`)
    );
  } else {
    lines.push('- **Buyer Usage Scenarios:** [Not fetched yet]');
  }

  return lines.join('\n');
}
