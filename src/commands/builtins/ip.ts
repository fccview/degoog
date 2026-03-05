import type { BangCommand, CommandResult, CommandContext } from "../../types";

export const ipCommand: BangCommand = {
  name: "IP Lookup",
  description: "Look up IP geolocation info (optionally specify an IP)",
  trigger: "ip",
  async execute(args: string, context?: CommandContext): Promise<CommandResult> {
    let raw = args.trim() || context?.clientIp || "";
    const ip = raw.replace(/^::ffff:/, "");
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(ip)) {
      return {
        title: "IP Lookup",
        html: `__DETECT_CLIENT_IP__`,
      };
    }
    try {
      const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
      const data = await res.json();
      if (data.status === "fail") {
        return {
          title: "IP Lookup",
          html: `<div class="command-result"><p>Lookup failed: ${data.message}</p></div>`,
        };
      }
      const fields = [
        ["IP", data.query],
        ["City", data.city],
        ["Region", data.regionName],
        ["Country", data.country],
        ["ISP", data.isp],
        ["Org", data.org],
        ["Lat/Lon", `${data.lat}, ${data.lon}`],
      ];
      const rows = fields
        .map(([k, v]) => `<div class="ip-row"><span class="ip-label">${k}</span><span class="ip-value">${v || "N/A"}</span></div>`)
        .join("");
      return {
        title: `IP Info: ${data.query}`,
        html: `<div class="command-result command-ip-info">${rows}</div>`,
      };
    } catch {
      return {
        title: "IP Lookup",
        html: `<div class="command-result"><p>Failed to fetch IP data. Please try again.</p></div>`,
      };
    }
  },
};
