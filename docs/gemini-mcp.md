# Gemini CLI MCP setup

This project exposes a local MCP server so Gemini CLI can use the shop as a tool source after the user signs in with a Google account. The server does not call Gemini API and does not need a Gemini API key.

## What it exposes

- `search_products`: search active products.
- `list_products`: list best sellers, newest, featured, sale, or all products.
- `get_product_detail`: get public detail for a product by `product_id` or `slug`.
- `list_categories`: list active storefront categories.
- `get_storefront_info`: get public store, payment, shipping, return, and support context.
- `search_store_knowledge`: search static policy/support knowledge.
- `track_order`: public order tracking by order code and customer phone number.

## Run locally

```powershell
npm run mcp:shop
```

The command uses stdio transport, so it is meant to be started by an MCP client. The `.gemini/settings.json` file already points Gemini CLI to `scripts/mcp-shop-server.js`.

## Use from the local web chat

Set this in `.env`:

```env
AI_PROVIDER=gemini_cli
GEMINI_CLI_MODEL=gemini-2.5-flash-lite
GEMINI_CLI_TIMEOUT_MS=120000
```

Then restart the Node app. The `/chat/send` endpoint will call Gemini CLI locally, and Gemini CLI will use the `wind-of-fall-shop` MCP server.

For images, the local web flow keeps uploaded image files temporarily and passes their local paths to Gemini CLI. This is intended for local development only.

## Use with Gemini CLI

From the project root:

```powershell
gemini --skip-trust
```

Choose **Sign in with Google** when prompted. Then check MCP status inside Gemini CLI:

```text
/mcp
```

If you start Gemini without `--skip-trust`, the CLI may ignore project MCP settings until the folder is trusted. In the interactive UI, use `/permissions` to trust this project permanently.

Example prompts:

```text
Tim ao polo nam mau den size M trong shop.
Lay thong tin chinh sach thanh toan va doi tra cua WIND OF FALL.
Tra cuu don hang ORD... voi so dien thoai ... .
```

## Notes

- `APP_BASE_URL` or `PUBLIC_BASE_URL` controls product/category URLs. It defaults to `http://localhost:3000`.
- The MCP server reads the existing MySQL database settings from `.env`.
- `track_order` only returns limited public tracking data and requires the order phone number.
