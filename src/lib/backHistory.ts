import { useEffect, useRef } from 'react';

interface ActiveHistoryLayer {
  token: string;
  onBack: () => void;
}

const activeLayerStack: ActiveHistoryLayer[] = [];
const closedViaPopStateTokens = new Set<string>();
let layerSequence = 0;
let listenerAttached = false;

function handleWindowPopState(event: PopStateEvent) {
  const rawStack =
    event.state &&
    typeof event.state === 'object' &&
    Array.isArray((event.state as { __siamLayerStack?: unknown }).__siamLayerStack)
      ? ((event.state as { __siamLayerStack: unknown[] }).__siamLayerStack.filter(
          (item): item is string => typeof item === 'string'
        ))
      : [];

  const targetTokenSet = new Set(rawStack);

  while (activeLayerStack.length > 0) {
    const top = activeLayerStack[activeLayerStack.length - 1];
    if (targetTokenSet.has(top.token)) {
      break;
    }
    activeLayerStack.pop();
    closedViaPopStateTokens.add(top.token);
    top.onBack();
  }
}

function ensurePopStateListener() {
  if (typeof window === 'undefined' || listenerAttached) return;
  window.addEventListener('popstate', handleWindowPopState);
  listenerAttached = true;
}

function removeFromActiveStack(token: string): boolean {
  const idx = activeLayerStack.findIndex((layer) => layer.token === token);
  if (idx === -1) return false;
  activeLayerStack.splice(idx, 1);
  return true;
}

/**
 * Integrates an overlay sheet, confirmation modal, or detail view with browser/Android
 * hardware Back navigation:
 * - Opening pushes a history state token.
 * - Hardware Back pops the top layer via its `onBackClose` callback.
 * - Closing via UI (`isOpen` -> false) calls `history.back()` to keep the history stack in sync.
 */
export function useBackHistoryLayer(
  isOpen: boolean,
  onBackClose: () => void,
  layerKey: string
) {
  const onBackRef = useRef(onBackClose);
  onBackRef.current = onBackClose;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    ensurePopStateListener();

    const token = `${layerKey}_${++layerSequence}`;
    activeLayerStack.push({
      token,
      onBack: () => onBackRef.current(),
    });

    const baseState =
      window.history.state && typeof window.history.state === 'object'
        ? (window.history.state as Record<string, unknown>)
        : {};

    try {
      window.history.pushState(
        {
          ...baseState,
          __siamLayerStack: activeLayerStack.map((layer) => layer.token),
        },
        ''
      );
    } catch {
      // Ignore restricted history environments gracefully
    }

    return () => {
      if (closedViaPopStateTokens.has(token)) {
        closedViaPopStateTokens.delete(token);
        return;
      }
      const wasActive = removeFromActiveStack(token);
      if (wasActive) {
        try {
          window.history.back();
        } catch {
          // Ignore restricted history environments
        }
      }
    };
  }, [isOpen, layerKey]);
}
