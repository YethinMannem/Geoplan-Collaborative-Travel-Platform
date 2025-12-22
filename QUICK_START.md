# ⚡ QUICK START - Best Free Stack

**Get your app deployed in 90 minutes using the best free tier stack.**

---

## 🎯 What You'll Deploy

- **Backend**: Fly.io (Flask API)
- **Database**: Supabase (PostgreSQL + PostGIS)
- **Frontend**: Cloudflare Pages (React)
- **Monitoring**: Sentry (Error tracking)
- **CI/CD**: GitHub Actions (Automated testing)

**Total Cost**: $0/month

---

## ⏱️ Time Breakdown

- **Phase 1**: Fix Security Issues (30 min)
- **Phase 2**: Set Up Supabase (15 min)
- **Phase 3**: Deploy to Fly.io (20 min)
- **Phase 4**: Deploy to Cloudflare (15 min)
- **Phase 5**: Set Up Sentry (10 min)
- **Total**: ~90 minutes

---

## 📋 Prerequisites Checklist

- [ ] GitHub account
- [ ] Code pushed to GitHub
- [ ] Google Maps API key
- [ ] Terminal/Command line access
- [ ] 90 minutes of time

---

## 🚀 Quick Start Steps

### 1. Fix Security (30 min)
```bash
# Follow Phase 1 in IMPLEMENTATION_GUIDE_BEST_FREE.md
# - Move secrets to .env
# - Add Redis token storage
# - Add rate limiting
```

### 2. Set Up Supabase (15 min)
1. Go to [supabase.com](https://supabase.com)
2. Create project
3. Enable PostGIS: `CREATE EXTENSION postgis;`
4. Run schema: Copy `db/schema.sql` to SQL Editor
5. Get connection string

### 3. Deploy Backend (20 min)
```bash
# Install Fly CLI
brew install flyctl  # or see guide for other OS

# Sign up and login
fly auth signup
fly auth login

# Create app
cd backend
fly launch

# Set secrets
fly secrets set SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
fly secrets set DATABASE_URL="your-supabase-connection-string"
fly secrets set ENVIRONMENT="production"

# Deploy
fly deploy
```

### 4. Deploy Frontend (15 min)
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Create project → Connect GitHub
3. Set build: `npm run build`, output: `build`, root: `frontend-react`
4. Add env vars:
   - `REACT_APP_API_BASE=https://your-backend.fly.dev`
   - `REACT_APP_GOOGLE_MAPS_API_KEY=your-key`
5. Deploy

### 5. Set Up Monitoring (10 min)
1. Go to [sentry.io](https://sentry.io)
2. Create Flask project
3. Copy DSN
4. Add to Fly.io: `fly secrets set SENTRY_DSN="your-dsn"`
5. Redeploy: `fly deploy`

---

## ✅ Verification

Test these URLs:
- Backend: `https://your-backend.fly.dev/health`
- Frontend: `https://your-frontend.pages.dev`
- Database: Supabase dashboard
- Monitoring: Sentry dashboard

---

## 📚 Full Guide

For detailed step-by-step instructions, see:
**[IMPLEMENTATION_GUIDE_BEST_FREE.md](IMPLEMENTATION_GUIDE_BEST_FREE.md)**

---

## 🆘 Need Help?

- **Backend issues**: Check `fly logs`
- **Frontend issues**: Check Cloudflare Pages build logs
- **Database issues**: Check Supabase dashboard
- **Full troubleshooting**: See IMPLEMENTATION_GUIDE_BEST_FREE.md

---

**You're ready to deploy! Follow the full guide for detailed instructions.** 🚀

