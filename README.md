# mcp-odoo

Odoo MCP Pack — ERP/CRM via Odoo's external JSON-RPC API.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1679+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `odoo_search_partners` | Search Odoo contacts & companies (res.partner) by name, email, or company flag. Returns id, name, email, phone, and company/customer flags. Use for "find the contact/customer named X" or "list companies". |
| `odoo_list_sale_orders` | List Odoo sales orders / quotations (sale.order). Returns name, customer (partner_id), amount_total, state (draft/sent/sale/done/cancel), and date_order. Optionally filter by state. Use for "recent sales orders" or "open quotations". |
| `odoo_list_crm_leads` | List Odoo CRM leads & opportunities (crm.lead). Returns name, contact, email_from, expected_revenue, probability, stage_id, and type (lead/opportunity). Use for "open opportunities" or "sales pipeline". |
| `odoo_list_invoices` | List Odoo customer invoices (account.move where move_type=out_invoice). Returns name, partner_id, amount_total, amount_residual, state (draft/posted/cancel), payment_state, and invoice_date. Use for "unpaid invoices" or "recent customer invoices". |
| `odoo_query_model` | Power-user generic query: run search_read on ANY Odoo model. Provide model (e.g. "product.template"), domain (Odoo list-of-triples, e.g. [["list_price",">",100]]), fields, and limit. Use when no specific tool above fits. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "odoo": {
      "url": "https://gateway.pipeworx.io/odoo/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/odoo/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1679+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

This pack takes your own API key (`_apiKey`) — we don't front one for it, so there's no curl here that would run without it. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/odoo_search_partners`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Standalone (no gateway account)

This package also runs as a local stdio MCP server — no Pipeworx account, no
gateway round-trip:

```json
{
  "mcpServers": {
    "odoo": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-odoo"]
    }
  }
}
```

Or run it directly to confirm it starts:

```bash
npx -y @pipeworx/mcp-odoo
```

It speaks MCP over stdin/stdout and answers `initialize`/`tools/list`/`tools/call`
for **only** this pack's tools — none of the shared meta-tools the gateway
connection above adds. Same source, same tools, no ask_pipeworx routing.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Odoo data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
