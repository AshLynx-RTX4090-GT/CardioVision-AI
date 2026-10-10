import app from "./src/app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = "0.0.0.0";

let server = null;

if (!process.env.VERCEL) {
  server = app.listen(PORT, HOST, () => {
    console.log(`CardioVision running at http://${HOST}:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} in use, retrying in 1s...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, HOST);
      }, 1000);
    } else {
      console.error("Server error:", err);
    }
  });

  process.on("SIGTERM", () => {
    if (server) server.close(() => process.exit(0));
  });

  process.on("SIGINT", () => {
    if (server) server.close(() => process.exit(0));
  });
}

export { server };
export default app;
