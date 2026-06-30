// Metro config for the Staynex pnpm monorepo.
//
// pnpm symlinks workspace packages into node_modules, so Metro must:
//   1. watch the workspace root (to follow symlinks to @staynex/shared source), and
//   2. resolve modules from both the app's and the root's node_modules.
//
// `@staynex/backend/types` is imported `import type` only — it is erased before
// bundling, so Metro never resolves it at runtime (tsc validates it instead).

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so changes in packages/shared trigger reloads.
config.watchFolders = [workspaceRoot];

// 2. Resolve from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm's nested, symlinked layout breaks Metro's default hierarchical lookup.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
