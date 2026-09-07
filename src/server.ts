import { createMcpHandler } from "agents/mcp/server";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const SHOPIFY_USER_AGENT = "ShoppingTools/1.0";

type Env = {};

type CheckoutMeta = {
  "ucp-agent": {
    profile: string;
  };
  "idempotency-key"?: string;
};

type CreateCheckoutArgs = {
  merchant_mcp_url: string;
  meta: CheckoutMeta;
  cart_id?: string;
  checkout?: Record<string, unknown>;
};

type CheckoutArgs = {
  merchant_mcp_url: string;
  meta: CheckoutMeta;
  id: string;
  checkout?: Record<string, unknown>;
};

function createServer(env: Env) {
  const server = new McpServer({
    name: "MCP Checkout Agents",
    version: "1.0.0",
  });

  server.registerTool(
    "create_checkout",
    {
      description:
        "Create a checkout when the buyer is ready to purchase. You may provide cart_id to convert an existing cart, or provide checkout details directly.",
      inputSchema: z.object({
        merchant_mcp_url: z.string().url(),
        meta: z.object({
          "ucp-agent": z.object({
            profile: z.string().url(),
          }),
        }),
        cart_id: z.string().optional(),
        checkout: z
          .object({
            currency: z.string(),
            line_items: z
              .array(
                z.object({
                  quantity: z.number().int().min(1),
                  item: z.object({
                    id: z.string(),
                  }),
                })
              ),
            buyer: z.record(z.string(), z.unknown()),
            context: z
              .object({
                address_country: z.string().optional(),
                address_region: z.string().optional(),
                postal_code: z.string().optional(),
                intent: z.string().optional(),
                language: z.string().optional(),
                currency: z.string().optional(),
                eligibility: z.array(z.string()).optional(),
              })
              .optional(),
            attribution: z.record(z.string(), z.string()).optional(),
            fulfillment: z.record(z.string(), z.unknown()).optional(),
            payment: z.record(z.string(), z.unknown()).optional(),
            discounts: z.record(z.string(), z.unknown()).optional(),
          })
          .passthrough()
          .optional(),
      }).superRefine(({ cart_id, checkout }, context) => {
        if (!cart_id && !checkout) {
          context.addIssue({
            code: "custom",
            path: ["checkout"],
            message: "checkout is required when cart_id is not provided",
          });
        }
      }),
    },
    async ({ merchant_mcp_url, meta, cart_id, checkout }: CreateCheckoutArgs) => {
      const merchantRequest = {
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: "create_checkout",
          arguments: {
            meta,
            ...(cart_id ? { cart_id } : {}),
            ...(checkout ? { checkout } : {}),
          },
        },
      };

      const merchantResponse = await fetch(merchant_mcp_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": SHOPIFY_USER_AGENT,
        },
        body: JSON.stringify(merchantRequest),
      });

      const merchantReply = await merchantResponse.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(merchantReply),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_checkout",
    {
      description:
        "Get the current state of an existing checkout, including status, required buyer actions, messages, totals, and continue_url.",
      inputSchema: z.object({
        merchant_mcp_url: z.string().url(),
        meta: z.object({
          "ucp-agent": z.object({
            profile: z.string().url(),
          }),
        }),
        id: z.string(),
      }),
    },
    async ({ merchant_mcp_url, meta, id }: CheckoutArgs) => {
      const merchantRequest = {
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: "get_checkout",
          arguments: {
            meta,
            id,
          },
        },
      };

      const merchantResponse = await fetch(merchant_mcp_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": SHOPIFY_USER_AGENT,
        },
        body: JSON.stringify(merchantRequest),
      });

      const merchantReply = await merchantResponse.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(merchantReply),
          },
        ],
      };
    }
  );

  server.registerTool(
    "update_checkout",
    {
      description:
        "Replace the complete state of an existing checkout. Send all fields that should remain, because checkout updates use PUT semantics rather than partial merge.",
      inputSchema: z.object({
        merchant_mcp_url: z.string().url(),
        meta: z.object({
          "ucp-agent": z.object({
            profile: z.string().url(),
          }),
        }),
        id: z.string(),
        checkout: z
          .object({
            currency: z.string().optional(),
            line_items: z
              .array(
                z.object({
                  id: z.string().optional(),
                  quantity: z.number().int().min(1),
                  item: z.object({
                    id: z.string(),
                  }),
                })
              ),
            buyer: z.record(z.string(), z.unknown()),
            context: z
              .object({
                address_country: z.string().optional(),
                address_region: z.string().optional(),
                postal_code: z.string().optional(),
                intent: z.string().optional(),
                language: z.string().optional(),
                currency: z.string().optional(),
                eligibility: z.array(z.string()).optional(),
              })
              .optional(),
            attribution: z.record(z.string(), z.string()).optional(),
            fulfillment: z.record(z.string(), z.unknown()).optional(),
            payment: z.record(z.string(), z.unknown()).optional(),
            discounts: z.record(z.string(), z.unknown()).optional(),
          })
          .passthrough(),
      }),
    },
    async ({ merchant_mcp_url, meta, id, checkout }: CheckoutArgs) => {
      const merchantRequest = {
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: "update_checkout",
          arguments: {
            meta,
            id,
            checkout,
          },
        },
      };

      const merchantResponse = await fetch(merchant_mcp_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": SHOPIFY_USER_AGENT,
        },
        body: JSON.stringify(merchantRequest),
      });

      const merchantReply = await merchantResponse.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(merchantReply),
          },
        ],
      };
    }
  );

  server.registerTool(
    "complete_checkout",
    {
      description:
        "Complete a checkout and place the order. Use only when the checkout status is ready_for_complete, payment authorization is present, and the buyer has explicitly confirmed the purchase. If the checkout requires escalation, use continue_url instead.",
      inputSchema: z.object({
        merchant_mcp_url: z.string().url(),
        meta: z.object({
          "ucp-agent": z.object({
            profile: z.string().url(),
          }),
          "idempotency-key": z.string().uuid(),
        }),
        id: z.string(),
        checkout: z
          .object({
            payment: z.record(z.string(), z.unknown()).optional(),
          })
          .passthrough(),
      }),
    },
    async ({ merchant_mcp_url, meta, id, checkout }: CheckoutArgs) => {
      const merchantRequest = {
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: "complete_checkout",
          arguments: {
            meta,
            id,
            checkout,
          },
        },
      };

      const merchantResponse = await fetch(merchant_mcp_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": SHOPIFY_USER_AGENT,
        },
        body: JSON.stringify(merchantRequest),
      });

      const merchantReply = await merchantResponse.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(merchantReply),
          },
        ],
      };
    }
  );

  server.registerTool(
    "cancel_checkout",
    {
      description:
        "Cancel an active checkout. Use only when the buyer explicitly asks to cancel. A canceled checkout cannot be resumed.",
      inputSchema: z.object({
        merchant_mcp_url: z.string().url(),
        meta: z.object({
          "ucp-agent": z.object({
            profile: z.string().url(),
          }),
          "idempotency-key": z.string().uuid(),
        }),
        id: z.string(),
      }),
    },
    async ({ merchant_mcp_url, meta, id }: CheckoutArgs) => {
      const merchantRequest = {
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
          name: "cancel_checkout",
          arguments: {
            meta,
            id,
          },
        },
      };

      const merchantResponse = await fetch(merchant_mcp_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": SHOPIFY_USER_AGENT,
        },
        body: JSON.stringify(merchantRequest),
      });

      const merchantReply = await merchantResponse.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(merchantReply),
          },
        ],
      };
    }
  );

  return server;
}

export default {
  fetch(request, env, ctx) {
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;