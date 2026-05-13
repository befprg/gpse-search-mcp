import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { chromium, Browser, BrowserContext } from 'playwright';
import { z } from 'zod';
import pkg from './package.json' assert { type: 'json' };
import { extractSearchResults, extractPageText, SearchResult } from './src/extraction';

const CX = process.argv[2];
if (!CX) {
  console.error('Usage: npx gpse-search-mcp <cx>');
  console.error('  cx:     Your Google Programmable Search Engine CX ID');
  console.error('  --sites: Comma-separated list of allowed site URLs (optional)');
  process.exit(1);
}

// Parse --sites whitelist flag
let allowedSites: string[] = [];
const sitesIdx = process.argv.indexOf('--sites');
if (sitesIdx !== -1 && sitesIdx + 1 < process.argv.length) {
  allowedSites = process.argv[sitesIdx + 1].split(',').map(s => s.trim()).filter(Boolean);
} else {
  const sitesFlag = process.argv.find(a => a.startsWith('--sites='));
  if (sitesFlag) {
    allowedSites = sitesFlag.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
  }
}

const BROWSER_TIMEOUT = parseInt(process.env.BROWSER_TIMEOUT ?? '30000', 10);

// Browser singleton — lazily started, lives for process lifetime
let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
    browserContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
  }
  return browserContext;
}

async function shutdown() {
  if (browser) {
    await browser.close();
  }
}

process.on('SIGINT', () => shutdown().then(() => process.exit(0)));
process.on('SIGTERM', () => shutdown().then(() => process.exit(0)));

// --- Server setup ---

const server = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

// Tool: search
server.registerTool(
  'search',
  {
    description: 'Search the web using Google Custom Search Engine. Returns titles, URLs, and snippets.',
    inputSchema: {
      query: z.string().describe('The search query'),
      maxResults: z.number().default(10).describe('Maximum number of results (default 10)'),
    },
  },
  async ({ query, maxResults }) => {
    try {
      const ctx = await getBrowser();
      const page = await ctx!.newPage();
      await page.goto(
        `https://cse.google.com/cse?cx=${CX}&q=${encodeURIComponent(query)}`,
        { timeout: BROWSER_TIMEOUT },
      );

      const results = await extractSearchResults(page, maxResults, allowedSites);
      await page.close();

      const text = formatSearchResults(results);
      return {
        content: [{ type: 'text', text }],
        structuredContent: { results },
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Search failed: ${message}` }],
        isError: true,
      };
    }
  },
);

// Tool: fetch
server.registerTool(
  'fetch',
  {
    description: 'Fetch and extract clean text content from a URL.',
    inputSchema: {
      url: z.string().describe('The URL to fetch'),
    },
  },
  async ({ url }) => {
    try {
      const ctx = await getBrowser();
      const page = await ctx!.newPage();
      await page.goto(url, { timeout: BROWSER_TIMEOUT, waitUntil: 'networkidle' });

      const text = await extractPageText(page);
      await page.close();

      return {
        content: [{ type: 'text', text }],
        structuredContent: { url, text },
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Fetch failed for ${url}: ${message}` }],
        isError: true,
      };
    }
  },
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();

// --- Helpers ---

function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return 'No search results found.';

  const lines = [`Found ${results.length} search result(s):`];
  results.forEach((r, i) => {
    lines.push(`\n${i + 1}. ${r.title}`);
    lines.push(`   URL: ${r.url}`);
    lines.push(`   Summary: ${r.snippet}`);
  });
  return lines.join('\n');
}
