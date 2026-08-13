# Поток

Поток is a demo-ready SaaS MVP for managing B2B contacts, building personalized email campaigns, and measuring outreach in one workspace.

## Product areas

- Responsive marketing site, login, and registration
- Dashboard with campaign and audience performance
- Contact database with search, saved views, filters, selection, and profiles
- Companies, dynamic segments, and a four-step import demo
- Campaign list, campaign detail, and audience-to-send wizard
- Interactive email builder with blocks, personalization, undo/redo, previews, and test sends
- Template library, analytics funnel, and workspace settings

The main demo flow starts in Contacts: apply the Lawyer + Moscow + Active filter, create a campaign for the matching audience, choose a template, edit the email, and continue through review to the simulated send result.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm test
```

`npm test` builds the Cloudflare-compatible application and verifies that every key route renders successfully.

## Structure

- `app/` — application routes and metadata
- `components/ui/` — shared design-system primitives
- `components/layout/` — responsive product shell and navigation
- `components/*` — product feature modules
- `config/brand.ts` — replaceable product identity and demo workspace defaults
- `data/` — realistic mock contacts, companies, campaigns, segments, templates, and analytics
- `types/` — shared domain models

This MVP intentionally simulates authentication, sending, importing, and persistence. Production SMTP, identity, billing, and backend services can be connected behind the existing product surfaces.
