interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Odoo MCP Pack — ERP/CRM via Odoo's external JSON-RPC API.
 *
 * BYO multi-credential SaaS connector. The user supplies their own Odoo
 * instance + credentials on every call; nothing is stored (stateless).
 *
 * Four required credentials (read + deleted from args on every tool):
 *   - url       Odoo instance base, e.g. https://mycompany.odoo.com
 *               (trailing slash stripped). Works for Odoo Online (SaaS),
 *               Odoo.sh, and self-hosted instances.
 *   - db        database name (the Odoo "database" — visible at /web/database
 *               or, on Odoo Online, usually the subdomain).
 *   - username  login email of the user the calls run as.
 *   - _apiKey   an Odoo API key OR the account password. Generate a key under
 *               Settings → Account Security → API Keys (recommended over the
 *               raw password).
 *
 * Protocol: every request is POST {url}/jsonrpc with body
 *   {"jsonrpc":"2.0","method":"call","params":{...}}
 *
 *   1. Authenticate: params {service:"common", method:"authenticate",
 *      args:[db, username, apiKey, {}]} → returns a numeric uid, or false on
 *      bad credentials.
 *   2. Query:        params {service:"object", method:"execute_kw",
 *      args:[db, uid, apiKey, model, method, [domain], {fields,limit,...}]}
 *
 * Domains use Odoo's list-of-triples syntax, e.g.
 *   [["is_company","=",true],["name","ilike","acme"]]
 * Triples in the same list are AND-ed by default.
 *
 * Note: cannot be fully exercised without a live instance — without valid
 * credentials authenticate() returns false (we throw a clear error) and
 * execute_kw returns a JSON-RPC error envelope (also thrown).
 */


const UA = 'pipeworx-mcp-odoo/1.0 (+https://pipeworx.io)';

interface Creds {
  url: string;
  db: string;
  username: string;
  apiKey: string;
}

/** Read the four credentials from args, delete them, and validate. */
function takeCreds(args: Record<string, unknown>): Creds {
  delete args._context;
  const url = args.url as string | undefined;
  const db = args.db as string | undefined;
  const username = args.username as string | undefined;
  const apiKey = args._apiKey as string | undefined;
  delete args.url;
  delete args.db;
  delete args.username;
  delete args._apiKey;

  if (!url || typeof url !== 'string' || !url.trim())
    throw new Error('Odoo: "url" is required (your instance base, e.g. https://mycompany.odoo.com).');
  if (!db || typeof db !== 'string' || !db.trim())
    throw new Error('Odoo: "db" is required (the Odoo database name).');
  if (!username || typeof username !== 'string' || !username.trim())
    throw new Error('Odoo: "username" is required (your Odoo login email).');
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim())
    throw new Error('Odoo: "_apiKey" is required (Odoo API key or password — Settings → Account Security → API Keys).');

  return { url: url.replace(/\/+$/, ''), db, username, apiKey };
}

/** Low-level JSON-RPC POST to {url}/jsonrpc. Throws on transport or RPC error. */
async function jsonRpc(url: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params }),
  });
  if (!res.ok) throw new Error(`Odoo: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { result?: unknown; error?: { message?: string; data?: { message?: string } } };
  if (body.error) {
    const detail = body.error.data?.message || body.error.message || JSON.stringify(body.error).slice(0, 300);
    throw new Error(`Odoo: ${detail}`);
  }
  return body.result;
}

/** Authenticate → uid, then run execute_kw against a model. Stateless. */
async function execKw(
  c: Creds,
  model: string,
  method: string,
  positional: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  const uid = await jsonRpc(c.url, {
    service: 'common',
    method: 'authenticate',
    args: [c.db, c.username, c.apiKey, {}],
  });
  if (!uid || typeof uid !== 'number') {
    throw new Error('Odoo: authentication failed — check url, db, username, and API key (Settings → Account Security → API Keys).');
  }
  return jsonRpc(c.url, {
    service: 'object',
    method: 'execute_kw',
    args: [c.db, uid, c.apiKey, model, method, positional, kwargs],
  });
}

/** Convenience: search_read with a domain + read kwargs. */
function searchRead(
  c: Creds,
  model: string,
  domain: unknown[],
  kwargs: Record<string, unknown>,
): Promise<unknown> {
  return execKw(c, model, 'search_read', [domain], kwargs);
}

const credProps = {
  url: { type: 'string' as const, description: 'Odoo instance base URL, e.g. https://mycompany.odoo.com (trailing slash optional). Works for Odoo Online and self-hosted.' },
  db: { type: 'string' as const, description: 'Odoo database name.' },
  username: { type: 'string' as const, description: 'Odoo login email.' },
  _apiKey: { type: 'string' as const, description: 'Odoo API key (Settings → Account Security → API Keys) or account password.' },
};
const credRequired = ['url', 'db', 'username', '_apiKey'];

// -- Tool definitions --------------------------------------------------------

const tools: McpToolExport['tools'] = [
  {
    name: 'odoo_search_partners',
    description:
      'Search Odoo contacts & companies (res.partner) by name, email, or company flag. Returns id, name, email, phone, and company/customer flags. Use for "find the contact/customer named X" or "list companies".',
    inputSchema: {
      type: 'object',
      properties: {
        ...credProps,
        name: { type: 'string', description: 'Case-insensitive substring match on partner name (ilike).' },
        email: { type: 'string', description: 'Case-insensitive substring match on email (ilike).' },
        is_company: { type: 'boolean', description: 'Filter to companies (true) or individuals (false). Omit for both.' },
        limit: { type: 'number', description: 'Max records (default 20).' },
      },
      required: credRequired,
    },
  },
  {
    name: 'odoo_list_sale_orders',
    description:
      'List Odoo sales orders / quotations (sale.order). Returns name, customer (partner_id), amount_total, state (draft/sent/sale/done/cancel), and date_order. Optionally filter by state. Use for "recent sales orders" or "open quotations".',
    inputSchema: {
      type: 'object',
      properties: {
        ...credProps,
        state: { type: 'string', description: 'Filter by order state: draft, sent, sale, done, or cancel. Omit for all.' },
        limit: { type: 'number', description: 'Max records (default 20).' },
      },
      required: credRequired,
    },
  },
  {
    name: 'odoo_list_crm_leads',
    description:
      'List Odoo CRM leads & opportunities (crm.lead). Returns name, contact, email_from, expected_revenue, probability, stage_id, and type (lead/opportunity). Use for "open opportunities" or "sales pipeline".',
    inputSchema: {
      type: 'object',
      properties: {
        ...credProps,
        type: { type: 'string', description: 'Filter by record type: "lead" or "opportunity". Omit for both.' },
        limit: { type: 'number', description: 'Max records (default 20).' },
      },
      required: credRequired,
    },
  },
  {
    name: 'odoo_list_invoices',
    description:
      'List Odoo customer invoices (account.move where move_type=out_invoice). Returns name, partner_id, amount_total, amount_residual, state (draft/posted/cancel), payment_state, and invoice_date. Use for "unpaid invoices" or "recent customer invoices".',
    inputSchema: {
      type: 'object',
      properties: {
        ...credProps,
        state: { type: 'string', description: 'Filter by invoice state: draft, posted, or cancel. Omit for all.' },
        limit: { type: 'number', description: 'Max records (default 20).' },
      },
      required: credRequired,
    },
  },
  {
    name: 'odoo_query_model',
    description:
      'Power-user generic query: run search_read on ANY Odoo model. Provide model (e.g. "product.template"), domain (Odoo list-of-triples, e.g. [["list_price",">",100]]), fields, and limit. Use when no specific tool above fits.',
    inputSchema: {
      type: 'object',
      properties: {
        ...credProps,
        model: { type: 'string', description: 'Odoo model name, e.g. "product.template", "stock.picking", "hr.employee".' },
        domain: {
          type: 'array',
          description: 'Odoo search domain — a list of triples [field, operator, value], e.g. [["active","=",true],["name","ilike","acme"]]. Empty array [] matches all.',
          items: {},
        },
        fields: {
          type: 'array',
          description: 'Field names to return, e.g. ["name","create_date"]. Omit to let Odoo return its default field set.',
          items: { type: 'string' },
        },
        limit: { type: 'number', description: 'Max records (default 20).' },
        offset: { type: 'number', description: 'Number of records to skip (pagination).' },
        order: { type: 'string', description: 'Sort spec, e.g. "create_date desc".' },
      },
      required: [...credRequired, 'model'],
    },
  },
];

// -- callTool dispatcher -----------------------------------------------------

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const c = takeCreds(args);
  const limit = typeof args.limit === 'number' ? args.limit : 20;

  switch (name) {
    case 'odoo_search_partners': {
      const domain: unknown[] = [];
      if (typeof args.name === 'string' && args.name.trim()) domain.push(['name', 'ilike', args.name]);
      if (typeof args.email === 'string' && args.email.trim()) domain.push(['email', 'ilike', args.email]);
      if (typeof args.is_company === 'boolean') domain.push(['is_company', '=', args.is_company]);
      return searchRead(c, 'res.partner', domain, {
        fields: ['id', 'name', 'email', 'phone', 'is_company', 'customer_rank', 'supplier_rank', 'city', 'country_id'],
        limit,
      });
    }
    case 'odoo_list_sale_orders': {
      const domain: unknown[] = [];
      if (typeof args.state === 'string' && args.state.trim()) domain.push(['state', '=', args.state]);
      return searchRead(c, 'sale.order', domain, {
        fields: ['name', 'partner_id', 'amount_total', 'state', 'date_order'],
        limit,
        order: 'date_order desc',
      });
    }
    case 'odoo_list_crm_leads': {
      const domain: unknown[] = [];
      if (typeof args.type === 'string' && args.type.trim()) domain.push(['type', '=', args.type]);
      return searchRead(c, 'crm.lead', domain, {
        fields: ['name', 'contact_name', 'email_from', 'expected_revenue', 'probability', 'stage_id', 'type'],
        limit,
        order: 'create_date desc',
      });
    }
    case 'odoo_list_invoices': {
      const domain: unknown[] = [['move_type', '=', 'out_invoice']];
      if (typeof args.state === 'string' && args.state.trim()) domain.push(['state', '=', args.state]);
      return searchRead(c, 'account.move', domain, {
        fields: ['name', 'partner_id', 'amount_total', 'amount_residual', 'state', 'payment_state', 'invoice_date'],
        limit,
        order: 'invoice_date desc',
      });
    }
    case 'odoo_query_model': {
      const model = args.model;
      if (typeof model !== 'string' || !model.trim())
        throw new Error('Odoo: "model" is required (e.g. "product.template").');
      const domain = Array.isArray(args.domain) ? (args.domain as unknown[]) : [];
      const kwargs: Record<string, unknown> = { limit };
      if (Array.isArray(args.fields)) kwargs.fields = args.fields;
      if (typeof args.offset === 'number') kwargs.offset = args.offset;
      if (typeof args.order === 'string' && args.order.trim()) kwargs.order = args.order;
      return searchRead(c, model, domain, kwargs);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
