import { Page } from 'playwright';

/**
 * Check if a URL hostname matches or is a subdomain of an allowed site URL.
 */
function isDomainAllowed(url: string, allowedSites: string[]): boolean {
  if (!allowedSites.length) return true;
  try {
    const host = new URL(url).hostname;
    for (const site of allowedSites) {
      const siteHost = new URL(site).hostname;
      if (host === siteHost || host.endsWith('.' + siteHost)) return true;
    }
  } catch { /* skip unparseable URLs */ }
  return false;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  displayUrl: string;
}

/**
 * Extract search results from a Google CSE iframe.
 * CSE renders results inside an iframe, so we query the frame directly.
 */
export async function extractSearchResults(
  page: Page,
  maxResults: number,
  allowedSites: string[] = [],
): Promise<SearchResult[]> {
  // CSE renders search results in the main frame (not an iframe).
  // Child iframes are for ads only.
  await page.waitForSelector('.gsc-result', { timeout: 15000 });

  let results = await page.$$eval(
    '.gsc-result',
    (elements, max) => {
      return elements.slice(0, max).map((el) => {
        const titleEl = el.querySelector('a.gs-title');
        const snippetEl = el.querySelector('.gs-snippet');
        const urlEl = el.querySelector('.gs-visibleUrl');
        const rawUrl = titleEl?.getAttribute('href') ?? '';

        // Strip Google redirect wrapper inline (runs in browser context)
        let url = rawUrl;
        try {
          const parsed = new URL(rawUrl);
          if (parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com') {
            const q = parsed.searchParams.get('q') || parsed.searchParams.get('url');
            if (q) url = decodeURIComponent(q);
          }
        } catch {
          // keep rawUrl
        }

        return {
          title: titleEl?.textContent?.trim() ?? '',
          url,
          snippet: snippetEl?.textContent?.trim() ?? '',
          displayUrl: urlEl?.textContent?.trim() ?? '',
        };
      });
    },
    maxResults,
  );

  // Filter by whitelist if provided
  if (allowedSites.length > 0) {
    results = results.filter(r => isDomainAllowed(r.url, allowedSites));
  }

  return results;
}

/**
 * Strip Google redirect wrapper from URLs.
 * CSE links look like: https://www.google.com/url?q=REAL_URL&sa=T&...
 */
function stripGoogleTracking(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com') {
      const q = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (q) return decodeURIComponent(q);
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * Extract clean text content from a page.
 * Removes scripts, styles, nav, etc. and prefers semantic content areas.
 */
export async function extractPageText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const clone = document.body?.cloneNode(true) as HTMLElement;
    if (!clone) return '';

    // Remove non-content elements
    clone.querySelectorAll(
      'script, style, nav, header, footer, aside, noscript, .sidebar, .nav, .ads, .ad, [role="complementary"]',
    ).forEach((el) => el.remove());

    // Try semantic content selectors first
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '#content',
      '.post',
      '.entry',
      '.article-body',
    ];

    let content = '';
    for (const sel of contentSelectors) {
      const el = clone.querySelector(sel);
      const text = el?.textContent?.trim() ?? '';
      if (text.length > 100) {
        content = text;
        break;
      }
    }

    // Fallback: full body text
    if (!content) {
      content = clone.textContent?.trim() ?? '';
    }

    // Normalize whitespace
    return content.replace(/\s+/g, ' ').trim();
  });
}
