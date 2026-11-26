import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

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
  const listboxId = `${id ?? generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((o) => o.value === value)
    )
  );
  const [coords, setCoords] = useState<MenuCoords | null>(null);

  const selectedOption = options.find((o) => o.value === value) ?? options[0];

  const updateCoords = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 36 + 12, 260);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
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
    updateCoords();
    const selectedIdx = options.findIndex((o) => o.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [isOpen, value, options.length]);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, activeIndex, options, onChange]);

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
      ? 'h-8 px-2.5 rounded-lg text-[11px] gap-1.5'
      : 'h-10 px-3 rounded-xl text-xs gap-2';

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
              : 'rotate-0 text-slate-400 dark:text-slate-500'
          }`}
        />
      </button>

      {canPortal &&
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
                className="rounded-xl border border-slate-200/95 dark:border-slate-700/90 bg-white dark:bg-[#16202B] p-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.65)] max-h-64 overflow-y-auto"
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
                        size === 'sm' ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-2.5 text-xs'
                      } ${
                        mono ? 'font-mono-num tabular-nums' : ''
                      } rounded-lg flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
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
