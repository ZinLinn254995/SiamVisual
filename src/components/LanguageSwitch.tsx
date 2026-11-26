import type { Language } from '../types';

interface LanguageSwitchProps {
  language: Language;
  onToggle: () => void;
}

function MyanmarFlag({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full overflow-hidden shrink-0 ring-1 ring-black/10 dark:ring-white/15 transition-[filter] duration-150 ${
        active ? 'grayscale-0' : 'grayscale-[35%]'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top stripe: Yellow */}
        <rect x="0" y="0" width="24" height="8" fill="#FECB00" />
        {/* Middle stripe: Green */}
        <rect x="0" y="8" width="24" height="8" fill="#34B233" />
        {/* Bottom stripe: Red */}
        <rect x="0" y="16" width="24" height="8" fill="#EA2839" />
        {/* Centered White 5-pointed Star */}
        <polygon
          points="12,5.3 13.55,10.05 18.55,10.05 14.5,12.98 16.05,17.75 12,14.8 7.95,17.75 9.5,12.98 5.45,10.05 10.45,10.05"
          fill="#FFFFFF"
        />
      </svg>
    </span>
  );
}

function EnglishFlag({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full overflow-hidden shrink-0 ring-1 ring-black/10 dark:ring-white/15 transition-[filter] duration-150 ${
        active ? 'grayscale-0' : 'grayscale-[35%]'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Royal Blue Field */}
        <rect width="24" height="24" fill="#012169" />
        {/* White Diagonal Saltire */}
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#FFFFFF" strokeWidth="4.4" />
        {/* Red Diagonal Saltire */}
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#C8102E" strokeWidth="2.1" />
        {/* White Upright Cross */}
        <path d="M12,0 V24 M0,12 H24" stroke="#FFFFFF" strokeWidth="6.4" />
        {/* Red Upright Cross */}
        <path d="M12,0 V24 M0,12 H24" stroke="#C8102E" strokeWidth="3.6" />
      </svg>
    </span>
  );
}

/**
 * Tactile sliding language switch combining crisp inline SVG flags (Myanmar / English)
 * with a compositor-only sliding thumb for instant, unambiguous state recognition.
 */
export function LanguageSwitch({ language, onToggle }: LanguageSwitchProps) {
  const isEnglish = language === 'en';
  const ariaLabel = isEnglish
    ? 'Current language: English. Switch to Myanmar'
    : 'လက်ရှိဘာသာစကား: မြန်မာ။ English သို့ ပြောင်းရန် နှိပ်ပါ';
  const titleText = isEnglish
    ? 'English — Click to switch to မြန်မာ'
    : 'မြန်မာ — English သို့ ပြောင်းရန် နှိပ်ပါ';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isEnglish}
      aria-label={ariaLabel}
      title={titleText}
      onClick={onToggle}
      className='group relative h-9 w-[90px] sm:w-[100px] lg:w-[104px] p-0.5 rounded-full border border-slate-200/95 dark:border-slate-700/90 bg-slate-100/95 dark:bg-[#0E151D] hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#0B1117] select-none before:content-[""] before:absolute before:-inset-y-1 before:inset-x-0 sm:before:hidden'
    >
      {/* Sliding active thumb (pure compositor transform) */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-white dark:bg-[#1B2735] border border-slate-200/85 dark:border-teal-400/35 shadow-[0_1px_2px_rgba(15,23,42,0.10)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none will-change-transform ${
          isEnglish ? 'translate-x-full' : 'translate-x-0'
        }`}
      />

      {/* Flag + Language Code Track */}
      <span className="relative z-10 grid grid-cols-2 h-full w-full items-center">
        <span
          className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-opacity duration-150 ${
            !isEnglish ? 'opacity-100' : 'opacity-50 group-hover:opacity-80'
          }`}
        >
          <MyanmarFlag active={!isEnglish} />
          <span
            className={`text-[10.5px] sm:text-[11px] font-bold tracking-tight leading-none whitespace-nowrap ${
              !isEnglish
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            MY
          </span>
        </span>

        <span
          className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-opacity duration-150 ${
            isEnglish ? 'opacity-100' : 'opacity-50 group-hover:opacity-80'
          }`}
        >
          <EnglishFlag active={isEnglish} />
          <span
            className={`text-[10.5px] sm:text-[11px] font-bold tracking-tight leading-none whitespace-nowrap ${
              isEnglish
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            EN
          </span>
        </span>
      </span>
    </button>
  );
}
