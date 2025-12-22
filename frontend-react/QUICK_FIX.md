# 🚨 Quick Fix: Google Maps Not Loading

## The Problem
You're seeing "This page can't load Google Maps correctly" because the Google Maps API key is missing or invalid.

## ✅ Solution (3 Steps)

### Step 1: Get Your API Key

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create/Select Project**: Create a new project or select existing
3. **Enable Billing**: Click "Enable Billing" (required, but free tier available - $200/month credit)
4. **Enable APIs**:
   - Go to **APIs & Services** → **Library**
   - Search for "Maps JavaScript API" → Click **Enable**
   - Search for "Places API" → Click **Enable**
5. **Create API Key**:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - **Copy your API key** (starts with `AIza...`)

### Step 2: Add API Key to Your Project

**Option A: Use the setup script (Easiest)**
```bash
cd frontend-react
./setup-env.sh
# Enter your API key when prompted
```

**Option B: Manual setup**
1. Open `frontend-react/.env` file (create it if it doesn't exist)
2. Add this line:
```env
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
REACT_APP_API_BASE=http://localhost:5001
```
3. Replace `YOUR_API_KEY_HERE` with your actual API key

### Step 3: Restart Your Server

**IMPORTANT**: You MUST restart the React development server for changes to take effect!

```bash
# Stop the server (press Ctrl+C in the terminal where it's running)
# Then restart:
cd frontend-react
npm start
```

## 🔍 Verify It's Working

1. Open browser console (F12)
2. Look for: `✅ Google Maps API loaded successfully`
3. The map should load without errors

## ❌ Still Not Working?

### Check These:

1. **API Key Format**: Should start with `AIza` and be about 39 characters long
2. **APIs Enabled**: Make sure both "Maps JavaScript API" and "Places API" are enabled
3. **Billing**: Must be enabled (even for free tier)
4. **Server Restarted**: Did you restart the development server after adding the key?
5. **File Location**: Is the `.env` file in the `frontend-react/` directory (not the root)?

### Common Errors:

- **"RefererNotAllowedMapError"**: 
  - Go to your API key settings in Google Cloud Console
  - Under "Application restrictions", add: `localhost:3000/*`

- **"This API project is not authorized"**:
  - Make sure you enabled "Maps JavaScript API" and "Places API"

- **"Billing account required"**:
  - Enable billing in Google Cloud Console (free tier still requires billing setup)

## 💡 Need More Help?

See `GOOGLE_MAPS_SETUP.md` for detailed instructions.

