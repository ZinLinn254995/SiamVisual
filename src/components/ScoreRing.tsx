import type { ProductItem, ProductScoreBreakdown, ScoreGrade } from '../types';

export interface ScoreTone {
  stroke: string;
  textClass: string;
  labelClass: string;
  barClass: string;
  trackClass: string;
}

/**
 * Always returns a valid ProductScoreBreakdown — uses the server-computed
 * scoreBreakdown when present, or derives an instant baseline from price,
 * commission, and category for older locally saved products.
 */
export function getEffectiveScoreBreakdown(product: ProductItem): ProductScoreBreakdown {
  if (product.scoreBreakdown) {
    return product.scoreBreakdown;
  }

  const catVisual: Record<ProductItem['category'], number> = {
    beauty: 82,
    home: 83,
    gadget: 79,
    fashion: 75,
    pet: 80,
    wellness: 68,
  };
  const visualDemo = catVisual[product.category] ?? 76;
  const aiSuitability = Math.min(95, visualDemo + (product.imageUrl ? 2 : -4));

  const price = product.priceThb;
  const priceScore =
    price === null
      ? 72
      : price >= 99 && price <= 590
        ? 94
        : price <= 990
          ? 80
          : 64;
  const salesDemand = Math.round(72 * 0.6 + priceScore * 0.4);

  const commRate = product.commissionRate;
  const commissionValue =
    commRate !== null
      ? Math.max(25, Math.min(100, Math.round((commRate / 20) * 100)))
      : 60;

  const speechPenalty = product.category === 'wellness' ? 4 : 0;
  const total = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        visualDemo * 0.42 +
          aiSuitability * 0.26 +
          salesDemand * 0.18 +
          commissionValue * 0.14 -
          speechPenalty
      )
    )
  );
  const grade: ScoreGrade =
    total >= 85 ? 'top' : total >= 70 ? 'strong' : total >= 55 ? 'fair' : 'low';

  return {
    total,
    grade,
    visualDemo,
    aiSuitability,
    salesDemand,
    commissionValue,
    speechPenalty,
  };
}

export function getScoreTone(grade: ScoreGrade): ScoreTone {
  switch (grade) {
    case 'top':
      return {
        stroke: '#10B981', // Emerald 500
        textClass: 'text-emerald-600 dark:text-emerald-400',
        labelClass: 'text-emerald-700 dark:text-emerald-400',
        barClass: 'bg-emerald-500 dark:bg-emerald-400',
        trackClass: 'stroke-slate-200/80 dark:stroke-slate-800',
      };
    case 'strong':
      return {
        stroke: '#0D9488', // Teal 600
        textClass: 'text-teal-600 dark:text-teal-400',
        labelClass: 'text-teal-700 dark:text-teal-400',
        barClass: 'bg-teal-500 dark:bg-teal-400',
        trackClass: 'stroke-slate-200/80 dark:stroke-slate-800',
      };
    case 'fair':
      return {
        stroke: '#D97706', // Amber 600
        textClass: 'text-amber-600 dark:text-amber-400',
        labelClass: 'text-amber-700 dark:text-amber-400',
        barClass: 'bg-amber-500 dark:bg-amber-400',
        trackClass: 'stroke-slate-200/80 dark:stroke-slate-800',
      };
    case 'low':
    default:
      return {
        stroke: '#E11D48', // Rose 600
        textClass: 'text-rose-600 dark:text-rose-400',
        labelClass: 'text-rose-700 dark:text-rose-400',
        barClass: 'bg-rose-500 dark:bg-rose-400',
        trackClass: 'stroke-slate-200/80 dark:stroke-slate-800',
      };
  }
}

interface ScoreRingProps {
  score: number;
  grade: ScoreGrade;
  size?: number;
  strokeWidth?: number;
}

export function ScoreRing({
  score,
  grade,
  size = 44,
  strokeWidth = 3.5,
}: ScoreRingProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeScore / 100);
  const tone = getScoreTone(grade);
  const isLarge = size >= 60;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={tone.trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <span
        className={`absolute font-mono-num font-bold leading-none ${tone.textClass} ${
          isLarge ? 'text-xl' : 'text-xs'
        }`}
      >
        {safeScore}
      </span>
    </div>
  );
}
