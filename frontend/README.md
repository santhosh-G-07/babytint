# BabyTint Frontend

Next.js 14 App Router frontend for BabyTint Photography.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Required Env (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_RAZORPAY_KEY_ID=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=
```

## Key Routes

- `/` homepage
- `/shop` listing
- `/shop/[id]` frame detail
- `/editor/[id]` Konva customization editor
- `/cart`, `/checkout`, `/orders`
- `/login`, `/register`
- `/admin`, `/admin/frames`, `/admin/orders`, `/admin/settings`
- `/api/razorpay/webhook` webhook proxy route

## Deploy Frontend

Recommended: Vercel

1. Import this repo in Vercel.
2. Set root directory to `frontend`.
3. Add env variables:
   - `NEXT_PUBLIC_API_URL=https://<your-railway-backend-domain>`
   - `NEXT_PUBLIC_SITE_URL=https://<your-frontend-domain>`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID=<key>`
   - Supabase env vars only if you use Supabase auth.
4. Deploy.
5. For Supabase free-tier wake-up, this project includes a Vercel Cron job (`/api/cron/supabase-warm`) every 12 hours.
   Set `CRON_SECRET` in Vercel so only Vercel Cron can call the route.

SEO files included:
- `app/robots.ts`
- `app/sitemap.ts`
- global metadata in `app/layout.tsx`
