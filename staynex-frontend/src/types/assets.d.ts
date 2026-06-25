// Ambient declarations so `tsc --noEmit` and the editor accept non-code imports.
// Next.js handles the actual bundling of these at build time.

declare module "*.css";
declare module "*.scss";
