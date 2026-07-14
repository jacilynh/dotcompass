import { createContext, useContext, type ReactNode } from "react";

import type { Index } from "../types";
import { getIndex } from "./api";
import { useAsync } from "./useAsync";

/**
 * The index (stats + division names + every current section) is needed by almost every
 * screen, so it loads once here and is shared by context rather than refetched per route.
 */
const IndexContext = createContext<Index | null>(null);

export function IndexProvider({ children }: { children: (index: Index) => ReactNode }) {
  const { data, error, loading } = useAsync(getIndex, []);

  if (loading) return <FullPageMessage>Loading the specifications…</FullPageMessage>;
  if (error || !data)
    return (
      <FullPageMessage>
        Could not load the specification data. Check your connection and reload.
      </FullPageMessage>
    );

  return <IndexContext.Provider value={data}>{children(data)}</IndexContext.Provider>;
}

export function useIndex(): Index {
  const index = useContext(IndexContext);
  if (!index) throw new Error("useIndex must be used within an IndexProvider");
  return index;
}

function FullPageMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-muted">
      {children}
    </div>
  );
}
