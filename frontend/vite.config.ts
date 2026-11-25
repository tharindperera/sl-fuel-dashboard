import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const ROOT_DATA_DIR = path.join(REPO_ROOT, "data");
const ROOT_CSV_PATH = path.join(REPO_ROOT, "cpc_petroleum_prices_original.csv");

/**
 * Serves repo-root `data/*.json` and `cpc_petroleum_prices_original.csv` during
 * dev/preview and bundles them into `dist/` during production builds so there is
 * a single source of truth updated by the daily GitHub Actions scraper.
 */
function syncFuelPipelineData(): Plugin {
  const resolveAsset = (reqPath: string): string | null => {
    const cleanPath = reqPath.split("?")[0];
    if (cleanPath.endsWith("/cpc_petroleum_prices_original.csv") || cleanPath === "/cpc_petroleum_prices_original.csv") {
      return ROOT_CSV_PATH;
    }
    const dataMatch = cleanPath.match(/\/data\/([a-zA-Z0-9_.-]+\.json)$/);
    if (dataMatch) {
      return path.join(ROOT_DATA_DIR, dataMatch[1]);
    }
    return null;
  };

  return {
    name: "sync-fuel-pipeline-data",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const filePath = resolveAsset(req.url);
        if (!filePath || !fs.existsSync(filePath)) return next();

        res.setHeader("Cache-Control", "no-store");
        res.setHeader(
          "Content-Type",
          filePath.endsWith(".csv") ? "text/csv; charset=utf-8" : "application/json; charset=utf-8"
        );
        fs.createReadStream(filePath).pipe(res);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const filePath = resolveAsset(req.url);
        if (!filePath || !fs.existsSync(filePath)) return next();

        res.setHeader("Cache-Control", "no-store");
        res.setHeader(
          "Content-Type",
          filePath.endsWith(".csv") ? "text/csv; charset=utf-8" : "application/json; charset=utf-8"
        );
        fs.createReadStream(filePath).pipe(res);
      });
    },
    writeBundle(options) {
      const outDir = options.dir ? path.resolve(options.dir) : path.resolve(__dirname, "dist");
      const targetDataDir = path.join(outDir, "data");
      fs.mkdirSync(targetDataDir, { recursive: true });

      if (fs.existsSync(ROOT_DATA_DIR)) {
        for (const entry of fs.readdirSync(ROOT_DATA_DIR)) {
          if (entry.endsWith(".json")) {
            fs.copyFileSync(path.join(ROOT_DATA_DIR, entry), path.join(targetDataDir, entry));
          }
        }
      }

      if (fs.existsSync(ROOT_CSV_PATH)) {
        fs.copyFileSync(ROOT_CSV_PATH, path.join(outDir, "cpc_petroleum_prices_original.csv"));
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), syncFuelPipelineData()],
});
