import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BottomSheet } from './BottomSheet';

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  options: readonly CustomSelectOption[];
  onChange: (nextValue: string) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  mono?: boolean;
  isHighlighted?: boolean;
  disabled?: boolean;
  className?: string;
}

interface MenuCoords {
  left: number;
  top?: number;
  bottom?: number;
  minWidth: number;
  placement: 'bottom' | 'top';
}

export function CustomSelect({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  size = 'md',
  fullWidth = false,
  mono = false,
  isHighlighted = false,
  disabled = false,
  className = '',
}: CustomSelectProps) {
  const prefersReducedMotion = useReducedMotion();
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const listboxId = `${baseId}-listbox`;
  const sheetTitleId = `${baseId}-sheet-title`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value)
    )
  );
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    const syncViewport = () => {
      setIsMobileSheet(window.innerWidth < 640);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport, { passive: true });
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const updateCoords = () => {
    const trigger = triggerRef.current;
    if (!trigger || isMobileSheet) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 42 + 12, 260);
    const bottomClearance = window.innerWidth < 1024 ? 76 : 12;
    const spaceBelow = window.innerHeight - rect.bottom - bottomClearance;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const minWidth = Math.max(rect.width, size === 'sm' ? 148 : 176);
    const maxLeft = Math.max(8, window.innerWidth - minWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    if (openUpward) {
      setCoords({
        left,
        bottom: window.innerHeight - rect.top + 6,
        minWidth,
        placement: 'top',
      });
    } else {
      setCoords({
        left,
        top: rect.bottom + 6,
        minWidth,
        placement: 'bottom',
      });
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const selectedIdx = options.findIndex((o) => o.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    if (!isMobileSheet) {
      updateCoords();
    }
  }, [isOpen, isMobileSheet, value, options.length]);

  useEffect(() => {
    if (!isOpen || isMobileSheet) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(Math.max(0, options.length - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const picked = options[activeIndex];
        if (picked) {
          onChange(picked.value);
        }
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'Tab') {
        setIsOpen(false);
      }
    };

    const handleViewportChange = () => {
      updateCoords();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen, isMobileSheet, activeIndex, options, onChange]);

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    }
  }

  const triggerSizeClass =
    size === 'sm'
      ? 'relative h-9 sm:h-8 px-2.5 rounded-lg text-xs sm:text-[11px] gap-1.5 before:content-[""] before:absolute before:-inset-1 sm:before:hidden'
      : 'h-11 sm:h-10 px-3 rounded-xl text-sm sm:text-xs gap-2';

  const triggerToneClass = isOpen
    ? 'border-teal-500 dark:border-teal-400 bg-white dark:bg-[#0E151D] text-slate-900 dark:text-slate-100 ring-2 ring-teal-500/20'
    : isHighlighted
      ? 'border-teal-300/95 dark:border-teal-700/90 bg-teal-50/70 dark:bg-teal-950/35 text-teal-900 dark:text-teal-200 hover:border-teal-400 dark:hover:border-teal-600'
      : 'border-slate-200/95 dark:border-slate-700/90 bg-white dark:bg-[#131B24] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600';

  const canPortal = typeof document !== 'undefined';

  return (
    <div className={`relative inline-block ${fullWidth ? 'w-full' : ''} ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`${fullWidth ? 'w-full' : ''} ${triggerSizeClass} ${triggerToneClass} ${
          mono ? 'font-mono-num tabular-nums' : 'font-medium'
        } border inline-flex items-center justify-between transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500`}
      >
        <span className="truncate text-left">{selectedOption?.label ?? ''}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
            isOpen
              ? 'rotate-180 text-teal-600 dark:text-teal-400'
              : 'rotate-0 text-slate-500 dark:text-slate-400'
          }`}
        />
      </button>

      {/* Mobile (<640px): Unified Thumb-Zone Bottom Sheet Picker */}
      {canPortal &&
        isMobileSheet &&
        createPortal(
          <BottomSheet
            isOpen={isOpen}
            onClose={() => {
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
            historyKey={`select_${baseId}`}
            variant="sheet"
            maxWidthClass="max-w-lg"
            zIndexClass="z-[70]"
            backdropClassName="bg-slate-950/50 backdrop-blur-[2px]"
            labelledBy={ariaLabel ? sheetTitleId : undefined}
            ariaLabel={ariaLabel || selectedOption?.label}
          >
            <div
              data-sheet-handle="true"
              className="px-4 pt-1 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 touch-none"
            >
              <h2
                id={sheetTitleId}
                className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate"
              >
                {ariaLabel || selectedOption?.label}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close"
                className="h-10 w-10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center shrink-0 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div
              data-sheet-scroll="true"
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
            >
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left text-sm transition-colors cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                      mono ? 'font-mono-num tabular-nums' : ''
                    } ${
                      isSelected
                        ? 'bg-teal-50/95 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold'
                        : 'text-slate-800 dark:text-slate-200 font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </BottomSheet>,
          document.body
        )}

      {/* Tablet / Desktop (>=640px): Floating Popover Select */}
      {canPortal &&
        !isMobileSheet &&
        createPortal(
          <AnimatePresence>
            {isOpen && coords && (
              <motion.div
                ref={menuRef}
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.placement === 'top' ? 4 : -4, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: coords.placement === 'top' ? 4 : -4, scale: 0.98 }
                }
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.14, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'fixed',
                  left: coords.left,
                  top: coords.top,
                  bottom: coords.bottom,
                  minWidth: coords.minWidth,
                  maxWidth: 'calc(100vw - 16px)',
                  zIndex: 80,
                }}
                className="rounded-xl border border-slate-200/95 dark:border-slate-700/90 bg-white dark:bg-[#16202B] p-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] max-h-64 overflow-y-auto overscroll-contain"
              >
                {options.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isFocused = idx === activeIndex;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        triggerRef.current?.focus();
                      }}
                      className={`w-full ${
                        size === 'sm'
                          ? 'min-h-[42px] sm:min-h-0 sm:h-8 px-3 sm:px-2.5 text-xs sm:text-[11px]'
                          : 'min-h-[44px] sm:min-h-0 sm:h-9 px-3 sm:px-2.5 text-sm sm:text-xs'
                      } ${
                        mono ? 'font-mono-num tabular-nums' : ''
                      } rounded-lg flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                        isSelected
                          ? 'bg-teal-50/90 dark:bg-teal-950/55 text-teal-800 dark:text-teal-300 font-semibold'
                          : isFocused
                            ? 'bg-slate-100 dark:bg-slate-800/85 text-slate-900 dark:text-slate-100 font-medium'
                            : 'text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
