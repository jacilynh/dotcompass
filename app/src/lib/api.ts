import type { Index, Requirement, SectionHistory, SectionText } from "../types";

/**
 * Data access. Everything is static JSON under `public/data`, fetched relative to the
 * deployed base so the same build works at a domain root or a Pages subpath. Each
 * fetched file is cached in memory for the session — the index once, and each
 * division's text/history the first time it's opened.
 */

const base = import.meta.env.BASE_URL; // e.g. "/" or "/dotcompass/"

const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  const url = `${base}data/${path}`;
  let pending = cache.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
      return res.json() as Promise<T>;
    });
    // Don't cache a rejected fetch — a transient failure should be retryable.
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

export const getIndex = () => load<Index>("index.json");

export const getDivisionText = (division: number) =>
  load<Record<string, SectionText>>(`sections/${division}.json`);

export const getDivisionHistory = (division: number) =>
  load<Record<string, SectionHistory>>(`history/${division}.json`);

export const getDivisionRequirements = (division: number) =>
  load<Requirement[]>(`requirements/${division}.json`);
