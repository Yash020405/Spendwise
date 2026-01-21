/**
 * API Response Cache Utility
 * Provides in-memory caching with TTL for API responses
 * Reduces network requests and improves perceived performance
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class ResponseCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly SHORT_TTL = 1 * 60 * 1000; // 1 minute
    private readonly LONG_TTL = 15 * 60 * 1000; // 15 minutes

    /**
     * Get cached response if valid
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    /**
     * Cache response with optional TTL
     */
    set<T>(key: string, data: T, ttl?: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl ?? this.DEFAULT_TTL,
        });
    }

    /**
     * Cache for short-lived data (1 min)
     */
    setShort<T>(key: string, data: T): void {
        this.set(key, data, this.SHORT_TTL);
    }

    /**
     * Cache for long-lived data (15 min)
     */
    setLong<T>(key: string, data: T): void {
        this.set(key, data, this.LONG_TTL);
    }

    /**
     * Invalidate specific cache entry
     */
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Invalidate all entries matching a prefix
     */
    invalidatePrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache stats for debugging
     */
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
}

// Singleton instance
export const responseCache = new ResponseCache();

/**
 * Higher-order function to wrap API calls with caching
 */
export function withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
): () => Promise<T> {
    return async () => {
        const cached = responseCache.get<T>(key);
        if (cached) {
            return cached;
        }

        const data = await fetcher();
        responseCache.set(key, data, ttl);
        return data;
    };
}

/**
 * Cache key generators for common API endpoints
 */
export const CacheKeys = {
    expenses: (userId?: string) => `expenses:${userId || 'default'}`,
    income: (userId?: string) => `income:${userId || 'default'}`,
    balance: (userId?: string) => `balance:${userId || 'default'}`,
    categories: () => 'categories',
    user: (userId?: string) => `user:${userId || 'default'}`,
};
