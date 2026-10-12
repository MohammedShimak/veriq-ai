import { fork } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function startServer() {
  console.log("🚀 Starting LexAgent Node Server on Port 5000...");
  const child = fork(path.join(__dirname, "server.js"));

  child.on("exit", (code, signal) => {
    console.warn(`⚠️ Server process exited with code ${code} / signal ${signal}. Restarting in 2 seconds...`);
    setTimeout(startServer, 2000);
  });
}

startServer();
