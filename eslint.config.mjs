// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * Staynex lint rules.
 *
 * The point of this config is to make the architecture boundaries in
 * `docs/architecture.md` mechanically enforced instead of merely documented.
 * A rule that only lives in prose gets broken; a rule that fails CI does not.
 *
 * Style is handled by Prettier, not here. Rules in this file should be about
 * correctness and boundaries, so that a failure always means something real.
 */

/** Imports no client-side app is ever allowed to reach for. */
const SERVER_ONLY_IMPORTS = [
  {
    name: "@prisma/client",
    message:
      "Prisma is backend-only. Frontend and mobile consume the API through typed contracts. See docs/architecture.md.",
  },
  {
    name: "prisma",
    message:
      "Prisma is backend-only. Frontend and mobile consume the API through typed contracts. See docs/architecture.md.",
  },
  {
    name: "@nestjs/common",
    message:
      "NestJS is backend-only. Frontend and mobile must not import backend framework code.",
  },
];

const SERVER_ONLY_PATTERNS = [
  {
    group: ["**/staynex-backend/src/**", "@staynex/backend/src/**"],
    message:
      "Do not import backend services or database code. Import types from '@staynex/backend/types' instead. See docs/architecture.md.",
  },
  {
    group: ["**/dist/**"],
    message: "Import from source, not from build output.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/*.d.ts",
      "staynex-backend/prisma/migrations/**",
      "docs/archive/**",
      // Nested git worktree: a separate branch checked out inside this one.
      // It has its own history and lint baseline; linting it from here
      // reports issues that do not exist on this branch.
      "staynex-opay-review/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Unused vars are a real signal, but an underscore prefix is the
      // conventional way to say "intentionally unused".
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // `any` is a smell, not a build break. Surfaced, not enforced, so that a
      // red lint run always means something actionable.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // --- Boundary: the web app must stay a client of the API. ---
  {
    files: ["staynex-frontend/**/*.{ts,tsx,mjs,js}"],
    ignores: ["staynex-frontend/test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: SERVER_ONLY_IMPORTS, patterns: SERVER_ONLY_PATTERNS },
      ],
    },
  },

  // --- Boundary: the mobile app must stay a client of the API. ---
  {
    files: ["staynex-mobile/**/*.{ts,tsx,mjs,js}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: SERVER_ONLY_IMPORTS, patterns: SERVER_ONLY_PATTERNS },
      ],
    },
  },

  // --- Boundary: shared code is consumed by every app, so it may not
  // depend on any single one of them, or on server-only libraries. ---
  {
    files: ["packages/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: SERVER_ONLY_IMPORTS,
          patterns: [
            ...SERVER_ONLY_PATTERNS,
            {
              group: [
                "**/staynex-frontend/**",
                "**/staynex-backend/**",
                "**/staynex-mobile/**",
              ],
              message:
                "packages/shared is depended on by every app and must not depend on any of them.",
            },
            {
              group: ["react", "react-dom", "react-native", "next/*"],
              message:
                "packages/shared is framework-agnostic: it is consumed by Next.js and React Native alike. Keep framework code in the app that needs it.",
            },
          ],
        },
      ],
    },
  },

  // --- Build/tooling config files are CommonJS by requirement of the tools
  // that read them (Metro, Babel, PostCSS). ---
  {
    files: ["**/*.config.{js,cjs}", "**/*.cjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // --- Test files run in Node and are looser by design. ---
  {
    files: ["**/test/**", "**/*.test.*", "**/scripts/**"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Test doubles legitimately use `async *fn() { throw ... }` to simulate a
      // stream that fails before emitting its first token.
      "require-yield": "off",
    },
  },
);
