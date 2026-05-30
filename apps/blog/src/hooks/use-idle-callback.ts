"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

const requestIdleCallbackPolyfill = (
  cb: (deadline: IdleDeadline) => void,
  options?: { timeout?: number },
): number => {
  const start = Date.now();
  return window.setTimeout(() => {
    cb({
      didTimeout: options?.timeout
        ? Date.now() - start >= options.timeout
        : false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1) as unknown as number;
};

const cancelIdleCallbackPolyfill = (id: number) => {
  window.clearTimeout(id);
};

function requestIdle(
  cb: (d: IdleDeadline) => void,
  options?: { timeout?: number },
): number {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    return (window.requestIdleCallback as typeof requestIdleCallbackPolyfill)(
      cb,
      options,
    );
  }
  return requestIdleCallbackPolyfill(cb, options);
}

function cancelIdle(id: number) {
  if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
    (window.cancelIdleCallback as typeof cancelIdleCallbackPolyfill)(id);
    return;
  }
  cancelIdleCallbackPolyfill(id);
}

export function useIdleCallback<T>(
  factory: () => T | Promise<T>,
  options: { timeout?: number } = {},
): { value: T | null; ensure: () => Promise<T> } {
  const [value, setValue] = useState<T | null>(null);
  const promiseRef = useRef<Promise<T> | null>(null);
  const idleHandleRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);
  const factoryRef = useRef(factory);
  // Keep the latest factory reachable from the idle callback closure. Updating
  // a ref during render is the canonical "store-latest-value" pattern; not a
  // reactive write so it doesn't trigger re-renders.
  // eslint-disable-next-line react-hooks/refs
  factoryRef.current = factory;

  const execute = useCallback(async (): Promise<T> => {
    if (resolvedRef.current && value !== null) return value;
    if (promiseRef.current) return promiseRef.current;
    promiseRef.current = Promise.resolve(factoryRef.current()).then(
      (result) => {
        setValue(result);
        resolvedRef.current = true;
        return result;
      },
    );
    return promiseRef.current;
  }, [value]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    idleHandleRef.current = requestIdle(
      () => {
        execute();
      },
      { timeout: options.timeout ?? 2000 },
    );
    return () => {
      if (idleHandleRef.current !== null) {
        cancelIdle(idleHandleRef.current);
        idleHandleRef.current = null;
      }
    };
  }, [execute, options.timeout]);

  const ensure = useCallback(async (): Promise<T> => {
    if (idleHandleRef.current !== null) {
      cancelIdle(idleHandleRef.current);
      idleHandleRef.current = null;
    }
    return execute();
  }, [execute]);

  return { value, ensure };
}

export function useIdlePrefetch(
  componentImport: () => Promise<unknown>,
  options: { timeout?: number } = {},
): { loaded: boolean; ensure: () => Promise<unknown> } {
  const { value, ensure } = useIdleCallback(componentImport, options);
  return { loaded: value !== null, ensure };
}
