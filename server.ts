import express from "express";
import path from "path";
import fs from "fs";
import admZip from "adm-zip";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "Inventário - QR SCANNER PRO" });
  });

  // API Download Source Code ZIP
  app.get("/api/download-zip", (req, res) => {
    try {
      const zip = new admZip();
      const projectRoot = process.cwd();
      const ignoreDirs = new Set(["node_modules", "dist", ".git", ".cache", "tmp", "bun.lock"]);

      function addDirectoryToZip(currentPath: string, zipPath: string) {
        const items = fs.readdirSync(currentPath);
        for (const item of items) {
          if (ignoreDirs.has(item)) continue;
          
          const fullPath = path.join(currentPath, item);
          const relativeZipPath = zipPath ? `${zipPath}/${item}` : item;
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            addDirectoryToZip(fullPath, relativeZipPath);
          } else {
            const content = fs.readFileSync(fullPath);
            zip.addFile(relativeZipPath, content);
          }
        }
      }

      addDirectoryToZip(projectRoot, "");

      const buffer = zip.toBuffer();
      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="inventario_codigo_fonte.zip"',
        "Content-Length": buffer.length.toString(),
      });
      res.send(buffer);
    } catch (err) {
      console.error("Erro ao gerar ZIP:", err);
      res.status(500).json({ error: "Falha ao gerar arquivo ZIP do código" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
