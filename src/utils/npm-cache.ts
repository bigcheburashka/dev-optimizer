/**
 * NPM command result cache
 * Reduces npm outdated/audit execution time by caching results
 */

import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = '.dev-optimizer';
const OUTDATED_CACHE = 'npm-outdated-cache.json';
const AUDIT_CACHE = 'npm-audit-cache.json';

const OUTDATED_TTL = 24 * 60 * 60 * 1000; // 24 hours
const AUDIT_TTL = 6 * 60 * 60 * 1000; // 6 hours (shorter for security)

interface CacheEntry {
  timestamp: number;
  data: any;
}

function getCachePath(projectPath: string, filename: string): string {
  return path.join(projectPath, CACHE_DIR, filename);
}

function readCache(cachePath: string, maxAge: number): any | null {
  try {
    if (fs.existsSync(cachePath)) {
      const cache: CacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cache.timestamp && (Date.now() - cache.timestamp) < maxAge) {
        return cache.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function writeCache(cachePath: string, data: any): void {
  try {
    const cacheDir = path.dirname(cachePath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const entry: CacheEntry = { timestamp: Date.now(), data };
    fs.writeFileSync(cachePath, JSON.stringify(entry));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Get cached npm outdated result
 * @returns cached data or null if not found/expired
 */
export function getCachedOutdated(projectPath: string): Record<string, any> | null {
  return readCache(getCachePath(projectPath, OUTDATED_CACHE), OUTDATED_TTL);
}

/**
 * Cache npm outdated result
 */
export function setCachedOutdated(projectPath: string, data: Record<string, any>): void {
  writeCache(getCachePath(projectPath, OUTDATED_CACHE), data);
}

/**
 * Get cached npm audit result
 * @returns cached data or null if not found/expired
 */
export function getCachedAudit(projectPath: string): any | null {
  return readCache(getCachePath(projectPath, AUDIT_CACHE), AUDIT_TTL);
}

/**
 * Cache npm audit result
 */
export function setCachedAudit(projectPath: string, data: any): void {
  writeCache(getCachePath(projectPath, AUDIT_CACHE), data);
}

/**
 * Clear all caches
 */
export function clearCache(projectPath: string): void {
  const files = [OUTDATED_CACHE, AUDIT_CACHE];
  for (const file of files) {
    const cachePath = getCachePath(projectPath, file);
    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch {
      // Ignore errors
    }
  }
}