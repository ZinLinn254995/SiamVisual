import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

export interface InfoTooltipProps {
  /** Optional bold heading shown at the top of the tooltip popover */
  title?: string;
  /** Primary explanation text (single string or multiple paragraphs) */
  content: string | string[];
  /** Optional bullet list rendered cleanly beneath the main explanation */
  bullets?: string[];
  /** Optional muted footer/disclaimer line */
  footer?: string;
  /** Accessible label for the trigger button */
  ariaLabel?: string;
  /** Visual size of the trigger button ('sm' for compact rows, 'md' for section headers) */
  size?: 'sm' | 'md';
  /** Optional tone override for tinted banners (e.g. amber/slate) */
  tone?: 'neutral' | 'teal' | 'amber';
  /** Optional extra classes for the wrapper */
  className?: string;
}

const TOOLTIP_OPEN_EVENT = 'siamvisual:tooltip-open';

interface PopoverCoords {
  top: number;
  left: number;
  arrowLeft: number;
  placement: 'bottom' | 'top';
}

export function InfoTooltip({
  title,
  content,
  bullets,
  footer,
  ariaLabel,
  size = 'sm',
  tone = 'neutral',
  className = '',
}: InfoTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords>({
    top: -9999,
    left: 12,
    arrowLeft: 16,
    placement: 'bottom',
  });

  const paragraphs = Array.isArray(content)
    ? content.filter((item) => Boolean(item && item.trim()))
    : content && content.trim()
      ? [content]
      : [];
  const bulletItems = (bullets ?? []).filter((item) => Boolean(item && item.trim()));

  const srSummary = [title, ...paragraphs, ...bulletItems, footer].filter(Boolean).join(' — ');

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const broadcastOpen = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(TOOLTIP_OPEN_EVENT, { detail: tooltipId }));
  }, [tooltipId]);

  const closeAll = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
    setIsPinned(false);
  }, [clearCloseTimer]);

  const scheduleHoverClose = useCallback(() => {
    if (isPinned || typeof window === 'undefined') return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 120);
  }, [clearCloseTimer, isPinned]);

  // Listen for other InfoTooltips opening so only one stays open at a time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOtherOpen = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail !== tooltipId) {
        clearCloseTimer();
        setIsOpen(false);
        setIsPinned(false);
      }
    };
    window.addEventListener(TOOLTIP_OPEN_EVENT, handleOtherOpen);
    return () => {
      window.removeEventListener(TOOLTIP_OPEN_EVENT, handleOtherOpen);
    };
  }, [tooltipId, clearCloseTimer]);

  useEffect(() => {
    return () => clearCloseTimer();
  }, [clearCloseTimer]);

  // Dismiss on outside click / tap or Escape key when open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      closeAll();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeAll();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, closeAll]);

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popRect = popoverRef.current?.getBoundingClientRect();

    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bottomClearance = vw < 1024 ? 76 : 12;
    const gap = 8;
    const popW = popRect?.width && popRect.width > 0 ? popRect.width : Math.min(340, vw - margin * 2);
    const popH = popRect?.height && popRect.height > 0 ? popRect.height : 120;

    const triggerCenterX = triggerRect.left + triggerRect.width / 2;
    const desiredLeft = triggerCenterX - popW / 2;
    const clampedLeft = Math.max(margin, Math.min(vw - popW - margin, desiredLeft));

    const spaceBelow = vh - triggerRect.bottom - gap - bottomClearance;
    const spaceAbove = triggerRect.top - gap - margin;
    const placement: 'bottom' | 'top' =
      spaceBelow >= popH || spaceBelow >= spaceAbove ? 'bottom' : 'top';

    const rawTop =
      placement === 'bottom' ? triggerRect.bottom + gap : triggerRect.top - popH - gap;
    const clampedTop = Math.max(margin, Math.min(vh - popH - bottomClearance, rawTop));
    const arrowLeft = Math.max(14, Math.min(popW - 14, triggerCenterX - clampedLeft));

    setCoords({
      top: clampedTop,
      left: clampedLeft,
      arrowLeft,
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition, srSummary]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updatePosition]);

  function handleTriggerClick(e: ReactMouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    clearCloseTimer();
    if (isOpen && isPinned) {
      closeAll();
    } else {
      broadcastOpen();
      setIsPinned(true);
      setIsOpen(true);
    }
  }

  function handleTriggerKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      closeAll();
    }
  }

  function handleMouseEnter() {
    clearCloseTimer();
    if (!isOpen) {
      broadcastOpen();
      setIsOpen(true);
    }
  }

  function handleFocus() {
    clearCloseTimer();
    if (!isOpen) {
      broadcastOpen();
      setIsOpen(true);
    }
  }

  function handleBlur() {
    if (isPinned) return;
    scheduleHoverClose();
  }

  if (paragraphs.length === 0 && bulletItems.length === 0 && !footer) {
    return null;
  }

  const buttonSizeClass = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';
  const iconSizeClass = size === 'md' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5';

  const toneClass =
    tone === 'amber'
      ? 'text-amber-600/85 hover:text-amber-800 dark:text-amber-400/85 dark:hover:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/40'
      : tone === 'teal'
        ? 'text-teal-600/85 hover:text-teal-800 dark:text-teal-400/85 dark:hover:text-teal-200 hover:bg-teal-100/60 dark:hover:bg-teal-900/40'
        : isOpen
          ? 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60'
          : 'text-slate-400 hover:text-teal-700 dark:text-slate-500 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800/80';

  return (
    <span className={`inline-flex items-center align-middle shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={scheduleHoverClose}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleTriggerKeyDown}
        aria-expanded={isOpen}
        aria-describedby={tooltipId}
        aria-label={ariaLabel || title || 'More info'}
        className={`relative before:content-[''] before:absolute before:-inset-2.5 ${buttonSizeClass} inline-flex items-center justify-center rounded-full transition-colors duration-150 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${toneClass}`}
      >
        <Info className={iconSizeClass} aria-hidden="true" />
      </button>

      {/* Screen-reader & SSR accessible full tooltip text (visually hidden until opened) */}
      <span id={tooltipId} role="tooltip" className="sr-only">
        {srSummary}
      </span>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={ariaLabel || title || 'Info'}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleHoverClose}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 80,
            }}
            className="w-max max-w-[min(calc(100vw-24px),22rem)] rounded-xl border border-slate-200/95 dark:border-slate-700 bg-white dark:bg-[#17212C] text-slate-700 dark:text-slate-200 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)] px-3.5 py-3 text-xs leading-relaxed pointer-events-auto"
          >
            {/* Subtle Directional Arrow */}
            <span
              aria-hidden="true"
              style={{ left: `${coords.arrowLeft}px` }}
              className={`absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-white dark:bg-[#17212C] border-slate-200/95 dark:border-slate-700 ${
                coords.placement === 'bottom'
                  ? '-top-[6px] border-l border-t'
                  : '-bottom-[6px] border-r border-b'
              }`}
            />

            <div className="relative space-y-2">
              {(title || isPinned) && (
                <div className="flex items-start justify-between gap-2">
                  {title ? (
                    <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      {title}
                    </div>
                  ) : (
                    <span />
                  )}
                  {isPinned && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeAll();
                      }}
                      aria-label="Close"
                      className="relative before:content-[''] before:absolute before:-inset-2 h-6 w-6 -mr-1 -mt-0.5 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {paragraphs.map((text, idx) => (
                <p key={idx} className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {text}
                </p>
              ))}

              {bulletItems.length > 0 && (
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                  {bulletItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}

              {footer && (
                <p className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {footer}
                </p>
              )}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
