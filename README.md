# gpse-search-mcp

A Model Context Protocol (MCP) server that provides web search via Google Programmable Search Engine and page content extraction.

Powered by Playwright headless browser. Supports domain whitelisting for high-quality, targeted search results.

## Features

- **Search** — Query Google Programmable Search Engine and get structured results (title, URL, snippet)
- **Fetch** — Extract clean text content from any webpage via headless browser
- **Domain whitelist** — Optionally restrict search results to specific domains via `--sites`
- **Headless browser** — Powered by Playwright, handles JS-rendered pages

## Prerequisites

- Node.js 20+
- A [Google Programmable Search Engine](https://programmablesearchengine.google.com/) account (free)
- Your search engine's **CX ID**

## Install & Usage

```bash
npx @befdev/gpse-search-mcp <YOUR_CX_ID>
```

With domain whitelist:

```bash
npx @befdev/gpse-search-mcp <YOUR_CX_ID> --sites "https://github.com/,https://arxiv.org/,https://wikipedia.org/"
```

## Configure in Your MCP Client

Add to your Claude desktop or other MCP client config:

```json
{
  "mcpServers": {
    "gpse-search": {
      "command": "npx",
      "args": ["@befdev/gpse-search-mcp", "YOUR_CX_ID"]
    }
  }
}
```

## Tools

### `search`

Search the web using Google Programmable Search Engine.

| Parameter  | Type   | Description                              |
| ---------- | ------ | ---------------------------------------- |
| `query`    | string | The search query                         |
| `maxResults` | number | Maximum results to return (default: 10) |

Returns an array of `{ title, url, snippet, displayUrl }`.

### `fetch`

Fetch and extract clean text content from a URL.

| Parameter | Type   | Description        |
| --------- | ------ | ------------------ |
| `url`     | string | The URL to fetch   |

Returns the cleaned text content of the page (scripts, styles, nav removed).

## Environment Variables

| Variable         | Default   | Description                        |
| ---------------- | --------- | ---------------------------------- |
| `BROWSER_TIMEOUT` | `30000` | Page load timeout in milliseconds |

## License

MIT
