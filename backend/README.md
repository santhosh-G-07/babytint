# BabyTint Backend

FastAPI backend for BabyTint Photography.

## Setup

```bash
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Env (`.env`)

Use `.env.example` as template.

## API Groups

- `/api/auth` current user
- `/api/frames` frame listing + admin CRUD
- `/api/orders` checkout, customer orders, admin status updates, cart
- `/api/upload` user uploads + admin frame uploads
- `/api/payment` razorpay order + webhook
- `/api/admin` dashboard metrics

## Deploy On Railway

This backend includes `railway.toml` for Railway deployment.

1. Create a Railway service from this repo.
2. Set the service root directory to `backend`.
3. Attach a Railway Volume and mount it at `/data`.
4. Add environment variables:
   - `APP_ENV=production`
   - `APP_HOST=0.0.0.0`
   - `DATABASE_URL=sqlite:////data/babytint.db`
   - `CORS_ORIGINS=https://<your-frontend-domain>`
   - `ADMIN_LOGIN_EMAIL=<your-admin-email>`
   - `ADMIN_LOGIN_PASSWORD=<strong-password>`
   - `ADMIN_TOKEN_SALT=<random-long-secret>`
   - `RAZORPAY_KEY_ID=<key>`
   - `RAZORPAY_KEY_SECRET=<secret>`
   - `RAZORPAY_WEBHOOK_SECRET=<secret>`
   - Optional Supabase keys if you use Supabase auth/storage.
   - Optional for testing without Supabase storage:
     - `ALLOW_LOCAL_STORAGE_FALLBACK=true`
     - `PUBLIC_BASE_URL=https://<your-backend-domain>`
5. Keep backend replicas at `1` when using SQLite.

Without a volume, SQLite data will be lost on redeploy/restart.
