// Empaqueta cada función Lambda en backend/dist/<nombre>/index.mjs (ESM, Node 24, arm64).
// El AWS SDK v3 lo provee el runtime nodejs24.x, por eso se marca como externo.
import { build } from "esbuild";
import { rm } from "node:fs/promises";

const functions = {
  publicProjects: "src/projects/publicProjects.ts",
  manageProjects: "src/projects/manageProjects.ts",
  createDonation: "src/donations/createDonation.ts",
  simulateDonation: "src/donations/simulateDonation.ts",
  readDonations: "src/donations/readDonations.ts",
  audit: "src/audit/auditFn.ts",
  preAuth: "src/identity/preAuth.ts",
};

await rm("dist", { recursive: true, force: true });

await Promise.all(
  Object.entries(functions).map(([name, entry]) =>
    build({
      entryPoints: [entry],
      outfile: `dist/${name}/index.mjs`,
      bundle: true,
      platform: "node",
      target: "node24",
      format: "esm",
      minify: true,
      sourcemap: false,
      legalComments: "none",
      external: ["@aws-sdk/*"],
      banner: {
        js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
      },
    }),
  ),
);

console.log(`Funciones empaquetadas: ${Object.keys(functions).join(", ")}`);
