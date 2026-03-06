import fs from "fs";
import path from "path";

const routesDir = path.join(process.cwd(), "src", "routes");

function scanDir(dir) {
  const files = fs.readdirSync(dir);

  for (const f of files) {
    const full = path.join(dir, f);

    if (fs.statSync(full).isDirectory()) {
      scanDir(full);
      continue;
    }

    if (!f.endsWith(".js")) continue;

    const txt = fs.readFileSync(full, "utf8");

    const matches = txt.match(/router\.(get|post|put|delete)\("([^"]+)"/g);

    if (!matches) continue;

    console.log("\n📄", full.replace(process.cwd(), ""));

    matches.forEach((m) => {
      const parts = m.match(/router\.(get|post|put|delete)\("([^"]+)"/);
      console.log("   ", parts[1].toUpperCase(), parts[2]);
    });
  }
}

console.log("\n========== API ROUTES ==========");
scanDir(routesDir);
console.log("\n================================\n");