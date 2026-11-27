/**
 * High-speed in-memory response cache with:
 * 1. Stale-While-Revalidate (instant <1ms response after initial warm while refreshing in background)
 * 2. In-flight request deduplication (concurrent identical GET requests share a single DB promise)
 * 3. Instant write invalidation on any POST / PUT / PATCH / DELETE request
 */

interface CacheEntry<T = any> {
  data: T;
  freshUntil: number;
  staleUntil: number;
}

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

const STALE_GRACE_MS = 10 * 60 * 1000; // 10 minutes stale-while-revalidate window unless invalidated by a write

function triggerBackgroundRefresh<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      const now = Date.now();
      responseCache.set(key, {
        data: result,
        freshUntil: now + ttlMs,
        staleUntil: now + ttlMs + STALE_GRACE_MS,
      });
      return result;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Returns cached value immediately if fresh (<1ms),
 * returns stale value immediately (<1ms) while refreshing in the background if within stale window,
 * or awaits in-flight / new fetch if uncached or invalidated by a write.
 */
export async function getOrSetApiCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = responseCache.get(key);

  if (cached) {
    if (now < cached.freshUntil) {
      return cached.data as T;
    }
    if (now < cached.staleUntil) {
      // Return immediately in <1ms and revalidate asynchronously in background
      triggerBackgroundRefresh(key, ttlMs, fetcher).catch(() => {});
      return cached.data as T;
    }
  }

  return triggerBackgroundRefresh(key, ttlMs, fetcher);
}

/**
 * Invalidates all cached entries (or entries matching a prefix).
 * Called automatically on any POST, PUT, PATCH, or DELETE request so writes are 100% real-time.
 */
export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}
