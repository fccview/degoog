import type { Hono } from "hono";
import { chatFollowUp } from "../../extensions/commands/builtins/ai-summary/index";
import { _applyRateLimit } from "../../utils/search";

export function registerAiChatRoute(router: Hono): void {
  router.post("/api/ai-chat", async (c) => {
    const limitRes = await _applyRateLimit(c);
    if (limitRes) return limitRes;
    let body: { messages?: { role: string; content: string }[] };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return c.json({ error: "Missing messages" }, 400);
    }
    const reply = await chatFollowUp(
      body.messages as {
        role: "system" | "user" | "assistant";
        content: string;
      }[],
    );
    if (!reply) return c.json({ error: "AI request failed" }, 502);
    return c.json({ reply });
  });
}
