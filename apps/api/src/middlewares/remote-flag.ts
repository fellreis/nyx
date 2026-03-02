import type { Request, Response, NextFunction } from 'express';

const SHEET_ID = '1OFr88cnb0THMC01nFC4aJj_WoIEJ3bnSBz_JNzwdGeU';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const REQUEST_TIMEOUT_MS = 3000;

function getFirstCell(csvText: string) {
  const firstLine = csvText.split(/\r?\n/)[0] ?? '';
  const firstCellRaw = firstLine.split(',')[0] ?? '';
  return firstCellRaw.replace(/^"|"$/g, '').trim();
}

export async function requireRemoteFlag(_req: Request, res: Response, next: NextFunction) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CSV_URL, { signal: controller.signal });
    if (!response.ok) {
      return res.status(503).json({ error: 'Remote validation unavailable.' });
    }

    const csvText = await response.text();
    const flag = getFirstCell(csvText).toLowerCase();
    if (flag !== 'true') {
      return res.status(403).json({ error: 'Access disabled.' });
    }

    return next();
  } catch {
    return res.status(503).json({ error: 'Remote validation unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
}
