// Dev-only preload shim — NOT part of the application.
//
// Some local networks refuse direct DNS queries from Node's c-ares resolver
// (ECONNREFUSED on port 53), which makes the registration email-deliverability
// check (`resolveMx` in auth.service.ts) reject every domain when the backend
// runs on such a machine. Production (Railway) is unaffected.
//
// Usage, only when local registrations fail with
// "Use an email address with a domain that can receive email.":
//
//   NODE_OPTIONS="--require ./staynex-backend/scripts/dev-dns-shim.cjs" pnpm dev:backend
//
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
