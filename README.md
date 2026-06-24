# Staynex

Staynex is a hospitality booking platform designed for city-by-city and country-by-country expansion, starting from Calabar.

## Monorepo

- `staynex-frontend` - Next.js frontend project for public booking, owner surfaces, and admin surfaces.
- `staynex-backend` - NestJS and Prisma backend project for booking, availability, payments, notifications, integrations, and shared contracts.
- `docs` - Architecture and planning documents.

## Current State

- The primary codebase scaffold lives at the repository root.
- The legacy prototype remains in `staynex-prototype` and is not the main architecture.
- Prisma replaces Drizzle in the main project structure.
