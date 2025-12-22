# Google Maps API Setup Guide

## ⚠️ Error: "This page can't load Google Maps correctly"

This error occurs when the Google Maps API key is missing, invalid, or not properly configured.

## 🔧 Quick Fix Steps

### 1. Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing (required for Maps API)
4. Go to **APIs & Services** → **Library**
5. Search and enable these APIs:
   - **Maps JavaScript API** (required)
   - **Places API** (required for search)
   - **Geocoding API** (optional, for address conversion)

### 2. Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy your API key

### 3. Configure API Key Restrictions (Recommended for Production)

1. Click on your API key to edit it
2. Under **Application restrictions**, select **HTTP referrers (web sites)**
3. Add your domains:
   - `localhost:3000/*` (for development)
   - `localhost:5001/*` (for development)
   - Your production domain (e.g., `yourdomain.com/*`)
4. Under **API restrictions**, select **Restrict key**
5. Select only:
   - Maps JavaScript API
   - Places API
   - Geocoding API (if enabled)

### 4. Set API Key in Your Project

Create or edit `.env` file in `frontend-react/` directory:

```env
REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
REACT_APP_API_BASE=http://localhost:5001
```

**Important**: Replace `YOUR_API_KEY_HERE` with your actual API key.

### 5. Restart Development Server

After setting the API key, restart your React development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
cd frontend-react
npm start
```

## ✅ Verification

1. Open browser console (F12)
2. Look for: `✅ Google Maps API loaded successfully`
3. If you see errors, check:
   - API key is correct
   - Required APIs are enabled
   - Billing is enabled
   - No domain restrictions blocking localhost

## 💰 Free Tier Limits

Google Maps offers a **$200 free credit per month**, which typically covers:
- 28,000 map loads
- 40,000 Places API requests
- 40,000 Geocoding requests

For development and small projects, this is usually sufficient.

## 🚨 Common Issues

### Issue: "RefererNotAllowedMapError"
**Solution**: Add `localhost:3000/*` to your API key's HTTP referrer restrictions

### Issue: "This API project is not authorized to use this API"
**Solution**: Enable the required APIs in Google Cloud Console

### Issue: "Billing account required"
**Solution**: Enable billing in Google Cloud Console (free tier still requires billing setup)

### Issue: API key works but Places Autocomplete doesn't
**Solution**: Make sure Places API is enabled (not just Maps JavaScript API)

## 📝 Example .env File

```env
# Frontend Environment Variables
REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_API_BASE=http://localhost:5001
```

## 🔒 Security Note

**Never commit your `.env` file to Git!** It's already in `.gitignore`, but double-check before pushing to GitHub.

