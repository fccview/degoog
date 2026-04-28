import { Hono } from "hono";
import { registerAiChatRoute } from "./search/_ai-chat-route";
import { registerLuckyRoute } from "./search/_lucky-route";
import { registerSearchRoutes } from "./search/_search-routes";
import { registerSearchTabsRoutes } from "./search/_search-tabs-route";
import { registerTabSearchRoute } from "./search/_tab-search-route";

const router = new Hono();

registerSearchRoutes(router);
registerAiChatRoute(router);
registerLuckyRoute(router);
registerSearchTabsRoutes(router);
registerTabSearchRoute(router);

export default router;
