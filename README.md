# Xidaa Discount Calculator

**Xidaa Moto Private Limited** — B2B Order Management & Smart Discount Intelligence System.
Tagline: *Ride The Electric Thunder.*

An internal business application for managing B2B electric scooter orders,
calculating transport charges, comparing dealer discount options, protecting company profit,
and saving order records permanently.

> **No login system.** The app opens straight to a role picker (Administrator /
> Sales Executive). Access control is role-based at the UI level; the Supabase
> database is protected by the project's network-level security and its API keys.

---

## 1. Features

| Area | What you get |
| --- | --- |
| Entry | No login — role picker (Admin / Sales) on open; switch role any time from the header. |
| Roles | Administrator (all orders, financial rules, audit) vs Sales Executive (create orders, view options, save/generate summaries — cannot touch financial rules). |
| Catalog | 23 Xidaa models seeded from the supplied catalogues (13 core models + verified additional models). Every model is admin-mapped to **DL / Other**; approved prices and costs are configured by admins. |
| Orders | Multiple scooter models per order, model-wise quantities, DL/Other totals, independent battery lines (3 variants, ₹500 default battery discount, per-row eligibility), touch quantity selector (1–32 presets + custom). |
| Transport | 12/32/55-scooter trucks (configurable rates ₹40/₹55/₹65 per km), multi-truck planner, auto-allocation suggestion, 10% additional charge, 5% GST, single-application guarantee. |
| Discount engine | Option A Scooter Price Discount, Option B 50% Transport Support (eligibility = scooter allowance ≥ support; unused allowance stays unused), Option C No Discount, separate battery discount. Single-allocation rule enforced. |
| Profit | Verified only when admin prices/costs exist; otherwise clearly labelled **Profitability Not Verified — Administrator cost data required**. Recommendation maximises verified profit subject to the minimum-profit rule. |
| Persistence | Supabase PostgreSQL (12 tables), searchable order history, safe delete confirmations, audit log for financial/rule changes. |
| PDF | Professional A4 portrait summaries with official logo, Inter typography, saffron/green identity, multi-page support, page numbers, compliance footer ("INTERNAL ORDER CALCULATION — SUBJECT TO APPROVAL · NOT A TAX INVOICE"). |
| UX | Premium glassmorphism, light saffron/green/white theme, black logo, mobile-first with fixed bottom navigation + safe-area support, 320–430px verified. |
| Tests | Vitest suite covering every required financial test case (see `src/domain/calculations.test.ts`). |

## 2. Tech stack

- React 18 + TypeScript (strict) + Vite 6
- Tailwind CSS v4 (brand theme tokens)
- Supabase PostgreSQL
- pdf-lib (PDF generation) + Inter (embedded)
- Lucide icons, Vitest

## 3. Project structure

```
supabase/migrations/20261103_init_xidaa_schema.sql  # full schema + seeds
scripts/
  run-migration-api.mjs   # apply the migration via Supabase Management API
  apply-migrations.mjs    # psql fallback / printer
  verify-setup.mjs        # integration readiness check
src/
  domain/calculations.ts        # ALL financial formulas (single source of truth)
  domain/calculations.test.ts    # required test cases 1–12
  utils/currency.ts              # integer paise arithmetic + INR formatting
  storage/ (demo + supabase adapters)
  context/RoleContext.tsx, AppContext.tsx
  components/ (RoleSelect, Navigation, Home, OrderForm, QuantitySelector, Results,
               SavedOrders, Settings, PdfExport, ui, Toast)
  lib/supabase.ts
```

## 4. Supabase setup (done for this project)

The live project is already configured:

| Item | Value |
| --- | --- |
| Project | `motoxidaa@gmail.com's Project` (`ehsivyhydesyluvhcxzn`) |
| Region | ap-southeast-1 (Singapore) |
| Database | PostgreSQL 17 (resumed from paused) |
| Schema migration | Applied — 12 tables + seeds |
| `.env` | populated with project URL + anon key |

Re-run the readiness check any time:

```bash
node scripts/verify-setup.mjs
```

For a fresh project, the steps are:

1. Create a Supabase project.
2. `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `SUPABASE_ACCESS_TOKEN` (account access token for the migration script).
3. `npm run db:apply` — applies `supabase/migrations/20261103_init_xidaa_schema.sql`
   statement-by-statement via the Management API.

## 5. Development

```bash
npm install
npm run dev      # http://localhost:5173 (uses live Supabase when configured)
npm test         # 19 financial tests
npm run build    # production build
```

## 6. Security notes

- There is intentionally **no per-user authentication**; the app is an internal
  tool. Protect access at the network level (e.g. Vercel/Cloudflare Access,
  VPN, or Supabase project settings) and keep the anon key private to the org.
- Role selection is stored locally (`localStorage`) and only gates the UI.
- All money math is integer paise; no floating-point currency calculations.
- Do not put `SUPABASE_ACCESS_TOKEN` in the browser bundle — it is for scripts only.
