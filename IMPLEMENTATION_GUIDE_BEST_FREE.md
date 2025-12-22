# 🚀 IMPLEMENTATION GUIDE - Best Free Stack

**Step-by-step guide to deploy using Fly.io + Supabase + Cloudflare Pages (the ACTUALLY best free tier)**

---

## 📋 PREREQUISITES

Before starting, make sure you have:
- [ ] GitHub account (free)
- [ ] Code pushed to GitHub repository
- [ ] Critical security fixes applied (see `CRITICAL_FIXES_IMPLEMENTATION.md`)
- [ ] Google Maps API key (free tier: $200 credit/month)

---

## 🎯 STEP-BY-STEP IMPLEMENTATION

### PHASE 1: Fix Critical Security Issues (30 minutes)

**Before deploying, fix these critical issues:**

#### 1.1 Move Secrets to Environment Variables

**Create `.env.example`**:
```env
# Database (Supabase will provide this)
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Redis (Fly.io will provide this)
REDIS_URL=redis://default:[password]@[host]:6379

# Application
SECRET_KEY=generate-random-32-char-string-here
ENVIRONMENT=production

# Sentry (get from sentry.io)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Google Maps API
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-key-here
```

**Update `.gitignore`**:
```
.env
*.env
!.env.example
__pycache__/
*.pyc
venv/
node_modules/
```

#### 1.2 Update `backend/app.py` to Use Environment Variables

**Replace hardcoded passwords** (lines 65-91):
```python
import os
from dotenv import load_dotenv

load_dotenv()

# Get passwords from environment
DB_ROLES = {
    "readonly_user": {
        "username": "readonly_user",
        "password": os.getenv("READONLY_USER_PASSWORD", ""),
        "permissions": ["SELECT"]
    },
    "app_user": {
        "username": "app_user",
        "password": os.getenv("APP_USER_PASSWORD", ""),
        "permissions": ["SELECT", "INSERT", "UPDATE"]
    },
    "curator_user": {
        "username": "curator_user",
        "password": os.getenv("CURATOR_USER_PASSWORD", ""),
        "permissions": ["SELECT", "INSERT", "UPDATE", "ANALYTICS"]
    },
    "analyst_user": {
        "username": "analyst_user",
        "password": os.getenv("ANALYST_USER_PASSWORD", ""),
        "permissions": ["SELECT", "ANALYTICS"]
    },
    "admin_user": {
        "username": "admin_user",
        "password": os.getenv("ADMIN_USER_PASSWORD", ""),
        "permissions": ["ALL"]
    }
}

# Validate passwords are set
for role_name, role_info in DB_ROLES.items():
    if not role_info["password"]:
        raise ValueError(f"Missing password for role {role_name}. Set {role_name.upper()}_PASSWORD in .env")

# Strong secret key
app.secret_key = os.getenv("SECRET_KEY")
if not app.secret_key or app.secret_key == "dev-secret-key-change-in-production":
    raise ValueError("SECRET_KEY must be set in .env and must not be the default value")
```

#### 1.3 Implement Redis Token Storage

**Install Redis client**:
```bash
cd backend
pip install redis
```

**Update `requirements.txt`**:
```
redis==5.0.1
```

**Create `backend/token_storage.py`**:
```python
"""Redis-based token storage for scalable authentication."""
import redis
import json
import time
import os
from typing import Optional, Dict

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
TOKEN_TTL = 1800  # 30 minutes

class TokenStorage:
    def __init__(self):
        try:
            self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            # Test connection
            self.redis_client.ping()
        except redis.ConnectionError:
            raise RuntimeError(f"Failed to connect to Redis at {REDIS_URL}. Is Redis running?")
    
    def store_token(self, token: str, user_role: str, user_id: Optional[int] = None) -> None:
        """Store token with expiration."""
        token_data = {
            "user_role": user_role,
            "user_id": user_id,
            "created_at": time.time()
        }
        self.redis_client.setex(
            f"token:{token}",
            TOKEN_TTL,
            json.dumps(token_data)
        )
    
    def get_token_data(self, token: str) -> Optional[Dict]:
        """Get token data if valid."""
        if not token:
            return None
        
        data = self.redis_client.get(f"token:{token}")
        if not data:
            return None
        
        try:
            return json.loads(data)
        except json.JSONDecodeError:
            return None
    
    def delete_token(self, token: str) -> None:
        """Delete token."""
        self.redis_client.delete(f"token:{token}")

# Global instance
_token_storage = None

def get_token_storage() -> TokenStorage:
    """Get or create token storage instance."""
    global _token_storage
    if _token_storage is None:
        _token_storage = TokenStorage()
    return _token_storage
```

**Update `backend/app.py`** to use Redis:
```python
from token_storage import get_token_storage

# Replace TOKEN_STORAGE = {} with Redis
def generate_token(username, user_id=None):
    """Generate a token and store in Redis."""
    secret = app.secret_key
    timestamp = str(time.time())
    token_string = f"{username}:{timestamp}:{secret}"
    token = hashlib.sha256(token_string.encode()).hexdigest()
    
    # Store in Redis
    storage = get_token_storage()
    storage.store_token(token, username, user_id)
    
    return token

def validate_token(token):
    """Validate token from Redis."""
    if not token:
        return None
    
    storage = get_token_storage()
    token_data = storage.get_token_data(token)
    
    if not token_data:
        return None
    
    return token_data.get("user_role")
```

#### 1.4 Add Rate Limiting

**Install Flask-Limiter**:
```bash
pip install Flask-Limiter
```

**Update `requirements.txt`**:
```
Flask-Limiter==3.5.0
```

**Update `backend/app.py`**:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379/0")
)

# Apply to endpoints
@app.get("/within_radius")
@limiter.limit("30 per minute")
def within_radius():
    ...

@app.post("/auth/login")
@limiter.limit("5 per minute")  # Prevent brute force
def login():
    ...
```

#### 1.5 Add Gunicorn for Production

**Update `requirements.txt`**:
```
gunicorn==21.2.0
```

**Create `backend/Procfile`** (for Fly.io):
```
web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 2
```

#### 1.6 Commit Changes
```bash
git add .
git commit -m "Fix critical security issues: env vars, Redis, rate limiting"
git push origin main
```

---

### PHASE 2: Set Up Supabase (Database) (15 minutes)

#### 2.1 Sign Up for Supabase
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" (free)
3. Sign up with GitHub (recommended)
4. Verify email if needed

#### 2.2 Create New Project
1. Click "New Project"
2. Fill in:
   - **Name**: `geoapp` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free
3. Click "Create new project"
4. Wait 2-3 minutes for setup

#### 2.3 Enable PostGIS Extension
1. Go to **SQL Editor** in left sidebar
2. Click "New query"
3. Run:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
4. Click "Run" (or Cmd/Ctrl + Enter)
5. Verify: Run `SELECT PostGIS_version();` - should return version

#### 2.4 Create Database Schema
1. In SQL Editor, create new query
2. Copy contents of `db/schema.sql`
3. Paste and run
4. Verify tables created: Go to **Table Editor** - should see `places` table

#### 2.5 Set Up Database Roles (Optional but Recommended)
1. In SQL Editor, run:
```sql
-- Create roles (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'readonly_user') THEN
        CREATE ROLE readonly_user WITH LOGIN PASSWORD 'your_secure_password_here';
    END IF;
    -- Repeat for other roles...
END
$$;

-- Grant permissions
GRANT SELECT ON places TO readonly_user;
-- Add more grants as needed
```

#### 2.6 Get Connection String
1. Go to **Settings** → **Database**
2. Scroll to **Connection string**
3. Copy the **URI** format:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with your database password
5. **Save this** - you'll need it for Fly.io

#### 2.7 Test Connection Locally (Optional)
```bash
psql "your-connection-string" -c "SELECT 1;"
```

---

### PHASE 3: Set Up Fly.io (Backend Hosting) (20 minutes)

#### 3.1 Install Fly CLI
**macOS**:
```bash
# Using Homebrew (recommended)
brew install flyctl

# Or direct install
curl -L https://fly.io/install.sh | sh
```

**Linux**:
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows**:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

#### 3.2 Sign Up for Fly.io
```bash
fly auth signup
```
- Opens browser for signup
- Sign up with GitHub (recommended)
- Verify email if needed

#### 3.3 Login
```bash
fly auth login
```

#### 3.4 Create Fly.io App
```bash
cd backend
fly launch
```

**Follow prompts**:
- **App name**: `your-geoapp-backend` (or auto-generated)
- **Region**: Choose closest to you (e.g., `iad` for US East)
- **PostgreSQL**: **No** (we're using Supabase)
- **Redis**: **Yes** (Fly.io will create it)
- **Deploy now**: **No** (we'll configure first)

#### 3.5 Configure fly.toml
Edit `fly.toml` (created by `fly launch`):
```toml
app = "your-geoapp-backend"
primary_region = "iad"  # Change to your region

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "requests"
    hard_limit = 25
    soft_limit = 20

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    grace_period = "5s"
    method = "GET"
    path = "/health"
    protocol = "http"
```

#### 3.6 Set Environment Variables
```bash
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Set secrets in Fly.io
fly secrets set SECRET_KEY="your-generated-secret-key"
fly secrets set ENVIRONMENT="production"
fly secrets set DATABASE_URL="your-supabase-connection-string"
fly secrets set SENTRY_DSN="your-sentry-dsn"  # We'll get this later
```

#### 3.7 Get Redis URL
```bash
# List Redis instances
fly redis list

# Get connection info (if Redis was created)
fly redis status <redis-app-name>
```

Or create Redis manually:
```bash
fly redis create
# Follow prompts, then get connection string
```

**Set Redis URL**:
```bash
fly secrets set REDIS_URL="redis://default:[password]@[host]:6379"
```

#### 3.8 Update app.py for Fly.io
Make sure your `app.py` reads `PORT` from environment:
```python
import os

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

But for production, use Gunicorn (already in Procfile).

#### 3.9 Deploy to Fly.io
```bash
fly deploy
```

**Watch the deployment** - it will:
1. Build your app
2. Deploy to Fly.io
3. Show you the URL

**Your backend URL**: `https://your-geoapp-backend.fly.dev`

#### 3.10 Verify Deployment
```bash
# Check status
fly status

# View logs
fly logs

# Test health endpoint
curl https://your-geoapp-backend.fly.dev/health
```

---

### PHASE 4: Set Up Cloudflare Pages (Frontend) (15 minutes)

#### 4.1 Sign Up for Cloudflare
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Click "Get started" (free)
3. Sign up (or login if you have account)
4. Verify email if needed

#### 4.2 Connect GitHub
1. Go to **Pages** dashboard
2. Click "Create a project"
3. Click "Connect to Git"
4. Authorize Cloudflare to access GitHub
5. Select your repository

#### 4.3 Configure Build Settings
**Project name**: `your-geoapp-frontend` (or auto-generated)

**Build settings**:
- **Framework preset**: Create React App
- **Build command**: `npm run build`
- **Build output directory**: `build`
- **Root directory**: `frontend-react`

#### 4.4 Add Environment Variables
Click "Environment variables" and add:
```
REACT_APP_API_BASE=https://your-geoapp-backend.fly.dev
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

#### 4.5 Deploy
1. Click "Save and Deploy"
2. Cloudflare will:
   - Install dependencies
   - Build your React app
   - Deploy to global CDN
3. Wait 2-3 minutes

**Your frontend URL**: `https://your-geoapp-frontend.pages.dev`

#### 4.6 Update CORS in Backend
Update `backend/app.py`:
```python
CORS(app, 
     supports_credentials=True,
     origins=[
         "https://your-geoapp-frontend.pages.dev",
         "http://localhost:3000"  # For local dev
     ])
```

**Redeploy backend**:
```bash
cd backend
fly deploy
```

---

### PHASE 5: Set Up Sentry (Monitoring) (10 minutes)

#### 5.1 Sign Up for Sentry
1. Go to [sentry.io](https://sentry.io)
2. Click "Get started" (free)
3. Sign up with GitHub (recommended)
4. Verify email if needed

#### 5.2 Create Project
1. Click "Create Project"
2. Select **Flask**
3. Project name: `geoapp-backend`
4. Click "Create Project"

#### 5.3 Get DSN
1. Copy your DSN (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)
2. Save it

#### 5.4 Add to Backend
**Update `requirements.txt`**:
```
sentry-sdk[flask]==1.40.0
```

**Update `backend/app.py`**:
```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
import os

# Initialize Sentry (only in production)
if os.getenv("ENVIRONMENT") == "production":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        integrations=[FlaskIntegration()],
        traces_sample_rate=0.1,
        environment="production"
    )
```

**Set Sentry DSN in Fly.io**:
```bash
fly secrets set SENTRY_DSN="your-sentry-dsn"
```

**Redeploy**:
```bash
fly deploy
```

#### 5.5 Test Error Tracking
Trigger a test error (e.g., visit a non-existent endpoint) and check Sentry dashboard.

---

### PHASE 6: Set Up GitHub Actions (CI/CD) (10 minutes)

#### 6.1 Create Workflow File
Create `.github/workflows/test.yml`:
```yaml
name: Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: test-secret-key-for-ci
        run: |
          cd backend
          pytest tests/ -v --cov=backend --cov-report=xml || true
```

#### 6.2 Commit and Push
```bash
git add .github/workflows/test.yml
git commit -m "Add CI/CD with GitHub Actions"
git push origin main
```

**GitHub Actions will automatically run tests on every push!**

---

### PHASE 7: Load Initial Data (10 minutes)

#### 7.1 Run ETL Script
```bash
cd backend
python etl_openbrewerydb.py
```

**Or connect to Supabase and run**:
```bash
# Set DATABASE_URL temporarily
export DATABASE_URL="your-supabase-connection-string"
python etl_openbrewerydb.py
```

#### 7.2 Verify Data
1. Go to Supabase dashboard
2. Go to **Table Editor**
3. Click on `places` table
4. Should see brewery data

---

## ✅ VERIFICATION CHECKLIST

After completing all phases:

- [ ] Backend deployed on Fly.io (test `/health` endpoint)
- [ ] Frontend deployed on Cloudflare Pages (test URL)
- [ ] Database connected (Supabase dashboard shows data)
- [ ] Redis connected (test token storage)
- [ ] Sentry tracking errors (trigger test error)
- [ ] GitHub Actions running tests (check Actions tab)
- [ ] Environment variables set correctly
- [ ] CORS configured properly
- [ ] SSL certificates working (HTTPS)
- [ ] Frontend can connect to backend (test API calls)

---

## 🚀 DEPLOYMENT COMMANDS REFERENCE

### Backend (Fly.io)
```bash
# Deploy
cd backend
fly deploy

# View logs
fly logs

# Check status
fly status

# Set secrets
fly secrets set KEY="value"

# SSH into app
fly ssh console
```

### Frontend (Cloudflare Pages)
- Auto-deploys on push to main branch
- Or manually trigger from dashboard

### Database (Supabase)
- Access via SQL Editor or Table Editor in dashboard
- Or use `psql` with connection string

---

## 🔧 TROUBLESHOOTING

### Backend Not Connecting to Database
- Verify `DATABASE_URL` is set correctly in Fly.io secrets
- Check Supabase dashboard - is database running?
- Test connection: `psql "your-connection-string" -c "SELECT 1;"`

### Frontend Can't Reach Backend
- Verify `REACT_APP_API_BASE` is set in Cloudflare Pages
- Check CORS allows Cloudflare domain
- Test backend URL directly: `curl https://your-backend.fly.dev/health`

### Redis Connection Issues
- Verify `REDIS_URL` is set correctly
- Check Redis is running: `fly redis status <name>`
- Test connection locally first

### Build Failures
- Check logs: `fly logs` or Cloudflare Pages build logs
- Verify all dependencies in `requirements.txt`
- Check environment variables are set

---

## 📊 MONITORING

### Fly.io Monitoring
- **Logs**: `fly logs` or dashboard
- **Metrics**: Dashboard shows CPU, memory, network
- **Alerts**: Email notifications (configure in dashboard)

### Sentry Monitoring
- **Errors**: Automatic error tracking
- **Performance**: Request timing
- **Alerts**: Email/Slack notifications (configure in Sentry)

### Cloudflare Analytics
- **Traffic**: Built-in analytics dashboard
- **Performance**: Page load times
- **Security**: DDoS protection stats

---

## 💰 COST TRACKING

**All services are FREE within limits:**

| Service | Free Tier | Your Usage | Status |
|---------|-----------|------------|--------|
| Fly.io | 3 VMs | Monitor in dashboard | ✅ Free |
| Supabase | 500MB DB | Check in dashboard | ✅ Free |
| Cloudflare | Unlimited | Unlimited | ✅ Free |
| Sentry | 5,000 errors/month | Check in dashboard | ✅ Free |
| GitHub | Unlimited | Unlimited | ✅ Free |

**Monitor usage in each service's dashboard!**

---

## 🎉 YOU'RE LIVE!

Your app is now deployed using the **BEST free tier stack**:

- ✅ **Backend**: Fly.io (better than Railway)
- ✅ **Database**: Supabase (better than Railway DB)
- ✅ **Frontend**: Cloudflare Pages (better than Vercel)
- ✅ **Monitoring**: Sentry (actually good)
- ✅ **CI/CD**: GitHub Actions (free)

**Total Cost**: **$0/month** 🎉

---

## 📚 NEXT STEPS

1. **Monitor**: Check all dashboards regularly
2. **Optimize**: Review logs, fix errors
3. **Scale**: Upgrade only when you hit limits
4. **Learn**: Understand each service better

**Congratulations! You're running on the best free tier stack!** 🚀

