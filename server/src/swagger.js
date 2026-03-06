// server/src/swagger.js
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Windows'ta glob için backslash -> slash
function toGlob(p) {
  return p.replace(/\\/g, "/");
}

export function setupSwagger(app) {
  const options = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Staj Sistem V2 API",
        version: "1.0.0",
      },
      servers: [{ url: "/" }],
    },

    // ✅ JSDoc taranacak yerler
    // - routes + middleware
    // - ayrıca server/index.js (swagger comments orada ise)
    apis: [
      toGlob(path.join(__dirname, "routes/**/*.js")),
      toGlob(path.join(__dirname, "middleware/**/*.js")),
      toGlob(path.join(__dirname, "../index.js")), // ✅ server/index.js
    ],
  };

  const spec = swaggerJSDoc(options);

  // JSON
  app.get("/api/docs.json", (req, res) => res.json(spec));

  // UI
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
}