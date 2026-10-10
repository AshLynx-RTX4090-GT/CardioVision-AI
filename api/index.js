import app from "../src/app.js";

export default function handler(req, res) {
  // Normalize URL when Vercel rewrites to this serverless function
  const matched = req.headers["x-matched-path"];
  if (matched && typeof matched === "string") {
    const rawUrl = req.url || "/";
    const queryIdx = rawUrl.indexOf("?");
    const query = queryIdx !== -1 && !matched.includes("?") ? rawUrl.slice(queryIdx) : "";
    req.url = matched + query;
  } else if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/auth") && req.url !== "/" && !req.url.startsWith("/.")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
  }
  return app(req, res);
}
