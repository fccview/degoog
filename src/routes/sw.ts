import { Hono } from "hono";
import pkg from "../../package.json";

const router = new Hono();

router.get("/sw.js", async () => {
  const body = await Bun.file("src/public/sw.js").text();
  const out = body.replaceAll("__APP_VERSION__", pkg.version);
  return new Response(out, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
    },
  });
});

export default router;
