import app from "../src/app.js";

// Vercel Serverless Function entry point
export default function handler(req, res) {
  return app(req, res);
}

export { app };
