# mcp-odoo

Odoo MCP Pack — ERP/CRM via Odoo's external JSON-RPC API.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Odoo data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
