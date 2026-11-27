import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useBackHistoryLayer } from '../lib/backHistory';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  historyKey: string;
  variant?: 'sheet' | 'dialog';
  maxWidthClass?: string;
  zIndexClass?: string;
  backdropClassName?: string;
  labelledBy?: string;
  ariaLabel?: string;
  panelClassName?: string;
  showHandleOnDesktop?: boolean;
  showMobileHandle?: boolean;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

let bodyScrollLockCount = 0;
let savedBodyOverflow = '';
const activeSheetStack: symbol[] = [];

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0
  );
}

export function BottomSheet({
  isOpen,
  onClose,
  historyKey,
  variant = 'sheet',
  maxWidthClass = 'max-w-xl',
  zIndexClass = 'z-50',
  backdropClassName = 'bg-slate-950/50 backdrop-blur-[2px]',
  labelledBy,
  ariaLabel,
  panelClassName = '',
  showHandleOnDesktop = false,
  showMobileHandle = true,
  children,
}: BottomSheetProps) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const sheetTokenRef = useRef<symbol | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [viewportMetrics, setViewportMetrics] = useState<{
    maxHeightPx: number | null;
    keyboardInsetPx: number;
  }>({ maxHeightPx: null, keyboardInsetPx: 0 });

  useBackHistoryLayer(isOpen, onClose, historyKey);

  // Body scroll lock (nest-safe), topmost Escape handling, focus trap & restore, and keyboard viewport metrics
  useEffect(() => {
    if (!isOpen) return;

    const token = Symbol(historyKey);
    sheetTokenRef.current = token;
    activeSheetStack.push(token);

    if (bodyScrollLockCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    bodyScrollLockCount += 1;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusRaf = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.contains(document.activeElement)) return;
      const focusables = getFocusableElements(panel);
      if (focusables.length > 0) {
        focusables[0].focus({ preventScroll: true });
      } else {
        panel.focus({ preventScroll: true });
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeSheetStack[activeSheetStack.length - 1] !== token) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = getFocusableElements(panel);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (!active || active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (!active || active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const syncVisualViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setViewportMetrics({ maxHeightPx: null, keyboardInsetPx: 0 });
        return;
      }
      const layoutH = window.innerHeight || document.documentElement.clientHeight;
      const inset = Math.max(0, Math.round(layoutH - vv.height - (vv.offsetTop || 0)));
      const nextKeyboardInset = inset > 60 ? inset : 0;
      const nextMaxHeight = Math.max(240, Math.round(vv.height * 0.9));
      setViewportMetrics({
        maxHeightPx: nextMaxHeight,
        keyboardInsetPx: nextKeyboardInset,
      });
    };

    syncVisualViewport();
    const vv = window.visualViewport;
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', syncVisualViewport, { passive: true });
    vv?.addEventListener('resize', syncVisualViewport, { passive: true });
    vv?.addEventListener('scroll', syncVisualViewport, { passive: true });

    return () => {
      window.cancelAnimationFrame(focusRaf);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', syncVisualViewport);
      vv?.removeEventListener('resize', syncVisualViewport);
      vv?.removeEventListener('scroll', syncVisualViewport);

      const idx = activeSheetStack.lastIndexOf(token);
      if (idx !== -1) {
        activeSheetStack.splice(idx, 1);
      }

      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow;
      }

      const prevEl = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prevEl && prevEl.isConnected) {
        window.requestAnimationFrame(() => {
          prevEl.focus({ preventScroll: true });
        });
      }
    };
  }, [isOpen, historyKey]);

  // Scroll-aware swipe-down dismiss gesture on panel handle or top of scroll area
  useEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;

    let eligible = false;
    let dragging = false;
    let fromHandle = false;
    let startX = 0;
    let startY = 0;
    let currentDragY = 0;

    const resetTransform = () => {
      currentDragY = 0;
      panel.style.transition = '';
      panel.style.transform = '';
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest('input, textarea, select, [role="slider"]')) {
        eligible = false;
        return;
      }

      fromHandle = Boolean(target.closest('[data-sheet-handle]'));
      if (fromHandle) {
        eligible = true;
      } else {
        const scrollEl =
          target.closest<HTMLElement>('[data-sheet-scroll]') ??
          panel.querySelector<HTMLElement>('[data-sheet-scroll]');
        eligible = (scrollEl?.scrollTop ?? 0) <= 0;
      }

      dragging = false;
      currentDragY = 0;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!eligible || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!dragging) {
        if (dy < -4) {
          eligible = false;
          return;
        }
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          eligible = false;
          return;
        }
        const threshold = fromHandle ? 4 : 10;
        if (dy > threshold && dy > Math.abs(dx)) {
          dragging = true;
          panel.style.transition = 'none';
        } else {
          return;
        }
      }

      if (dragging) {
        currentDragY = Math.max(0, dy);
        panel.style.transform = `translate3d(0, ${currentDragY}px, 0)`;
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const onTouchEnd = () => {
      if (!dragging) {
        eligible = false;
        return;
      }
      const shouldClose = currentDragY >= 64;
      dragging = false;
      eligible = false;
      if (shouldClose) {
        resetTransform();
        onCloseRef.current();
      } else {
        panel.style.transition = 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)';
        panel.style.transform = 'translate3d(0, 0, 0)';
        window.setTimeout(() => {
          if (panelRef.current === panel) {
            panel.style.transition = '';
            panel.style.transform = '';
          }
        }, 190);
      }
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: false });
    panel.addEventListener('touchend', onTouchEnd, { passive: true });
    panel.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      resetTransform();
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isOpen]);

  const wrapperAlignClass =
    variant === 'dialog'
      ? 'items-end sm:items-center justify-center p-0 sm:p-6'
      : 'items-end justify-center p-0';

  const panelShapeClass =
    variant === 'dialog'
      ? 'rounded-t-3xl sm:rounded-2xl max-h-[90dvh] sm:max-h-[88vh] border-t border-x sm:border shadow-xl'
      : 'rounded-t-3xl max-h-[90dvh] border-t border-x shadow-[0_-16px_48px_-12px_rgba(15,23,42,0.28)] dark:shadow-[0_-16px_48px_-12px_rgba(0,0,0,0.65)]';

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 ${zIndexClass} flex ${wrapperAlignClass}`}
          style={
            viewportMetrics.keyboardInsetPx > 0
              ? { paddingBottom: `${viewportMetrics.keyboardInsetPx}px` }
              : undefined
          }
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-label={!labelledBy ? ariaLabel : undefined}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.16 }}
            onClick={onClose}
            className={`fixed inset-0 ${backdropClassName}`}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : variant === 'dialog'
                  ? { opacity: 0, y: 24 }
                  : { y: '100%' }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : variant === 'dialog'
                  ? { opacity: 0, y: 24 }
                  : { y: '100%' }
            }
            transition={{
              duration: prefersReducedMotion ? 0.01 : variant === 'dialog' ? 0.18 : 0.26,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              willChange: 'transform',
              maxHeight:
                viewportMetrics.maxHeightPx !== null
                  ? `${viewportMetrics.maxHeightPx}px`
                  : undefined,
            }}
            className={`relative z-10 w-full ${maxWidthClass} flex flex-col overflow-hidden bg-white dark:bg-[#131B24] border-slate-200/90 dark:border-slate-800 focus:outline-none mobile-landscape-sheet-panel ${panelShapeClass} ${panelClassName}`}
          >
            {showMobileHandle && (
              <div
                data-sheet-handle="true"
                className={`${showHandleOnDesktop ? 'flex' : 'flex sm:hidden'} pt-2.5 pb-1 mobile-landscape-sheet-handle justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing`}
              >
                <span
                  aria-hidden="true"
                  className="w-10 h-1 rounded-full bg-slate-300/90 dark:bg-slate-700"
                />
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
