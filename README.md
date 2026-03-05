# Arkadium BizDev Hub (MVP)

Internal web app to manage the business development pipeline for game sourcing, evaluation, deal-making, and follow-up operations.

## Tech
- React + Vite
- Supabase (Postgres + Auth + API)

## What this MVP includes
- Studios directory
- Opportunity pipeline with fit/monetization/strategic scoring
- Contract tracking with revenue and microtransaction share fields
- Task tracking and near-term workload dashboard cards

## Local setup
1. Install dependencies:
   - `npm install`
2. Create env file:
   - Copy `.env.example` to `.env`
   - Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. In Supabase SQL Editor, run:
   - `sql/001_init.sql`
4. Start app:
   - `npm run dev`

## Next implementation targets
- Add login page (Supabase Auth)
- Add update/edit workflows and stage drag-and-drop
- Add contract expiry reminders and email integrations
- Add analytics for acceptance rate and studio performance

## Security note
- Current SQL policies allow `anon` for fast MVP testing without login.
- Before production use, switch to authenticated-only policies and add role-based access.
