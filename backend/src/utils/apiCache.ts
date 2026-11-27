/**
 * High-speed in-memory response cache with in-flight request deduplication
 * and automatic invalidation on any write (POST / PUT / PATCH / DELETE).
 */

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Returns cached value if fresh, shares in-flight promise if an identical request
 * is currently executing, or runs fetcher and caches the result.
 */
export async function getOrSetApiCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const existingInFlight = inFlightRequests.get(key);
  if (existingInFlight) {
    return existingInFlight as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fetcher();
      responseCache.set(key, {
        data: result,
        expiresAt: Date.now() + ttlMs,
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
 * Invalidates all cached entries (or entries matching a prefix).
 * Called automatically on any POST, PUT, PATCH, or DELETE request.
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
