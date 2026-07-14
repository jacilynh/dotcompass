import { useEffect, useState } from "react";

export interface AsyncState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/**
 * Run an async loader and track loading/error/data, cancelling stale updates when the
 * dependency key changes (navigating from one section to the next before the first
 * fetch resolves must not paint the wrong section).
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let live = true;
    setState({ loading: true });
    loader().then(
      (data) => live && setState({ data, loading: false }),
      (error) => live && setState({ error, loading: false }),
    );
    return () => {
      live = false;
    };
    // The caller declares the real dependencies; the loader identity is intentionally
    // not one of them (it's recreated each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
