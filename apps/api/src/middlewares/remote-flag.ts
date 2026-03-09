import type { Request, Response, NextFunction } from 'express';

const SHEET_ID = '1OFr88cnb0THMC01nFC4aJj_WoIEJ3bnSBz_JNzwdGeU';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const REQUEST_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedFlag: boolean | null = null;
let cacheExpiresAt = 0;

function getFirstCell(csvText: string) {
  const firstLine = csvText.split(/\r?\n/)[0] ?? '';
  const firstCellRaw = firstLine.split(',')[0] ?? '';
  return firstCellRaw.replace(/^"|"$/g, '').trim();
}

async function fetchFlag(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CSV_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const csvText = await response.text();
    const flag = getFirstCell(csvText).toLowerCase() === 'true';

    // Update cache
    cachedFlag = flag;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return flag;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requireRemoteFlag(_req: Request, res: Response, next: NextFunction) {
  try {
    // Return cached value if still fresh
    if (cachedFlag !== null && Date.now() < cacheExpiresAt) {
      if (!cachedFlag) {
        return res.status(403).json({ error: 'Access disabled.' });
      }
      return next();
    }

    const flag = await fetchFlag();
    if (!flag) {
      return res.status(403).json({ error: 'Access disabled.' });
    }

    return next();
  } catch {
    // On error, fall back to last known value if available
    if (cachedFlag !== null) {
      if (!cachedFlag) {
        return res.status(403).json({ error: 'Access disabled.' });
      }
      return next();
    }
    return res.status(503).json({ error: 'Remote validation unavailable.' });
  }
}
