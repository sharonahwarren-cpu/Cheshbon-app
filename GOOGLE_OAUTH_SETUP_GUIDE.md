
# Google OAuth Setup Guide for Cheshbon App

## The Problem
Your app is showing the error: **"Google Sign-In is not configured on this server"** because the backend environment variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are not set in your Specular dashboard.

## The Solution (Step-by-Step)

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Select **Application type: Web application**
6. Give it a name (e.g., "Cheshbon Web Client")
7. Under **Authorized redirect URIs**, add:
   ```
   https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev/api/auth/callback/google
   ```
8. Click **CREATE**
9. A dialog will appear with your **Client ID** and **Client Secret**
10. **Copy both values** - you'll need them in the next step

### Step 2: Add Environment Variables to Specular Dashboard

1. Go to [Specular Dashboard](https://specular.dev/dashboard)
2. Log in to your account
3. Select your **backend project** (the one for Cheshbon)
4. Navigate to **Environment Variables** section
5. Add two new environment variables:
   - **Key:** `GOOGLE_CLIENT_ID`
   - **Value:** (paste the Client ID you copied from Google Cloud Console)
   
   - **Key:** `GOOGLE_CLIENT_SECRET`
   - **Value:** (paste the Client Secret you copied from Google Cloud Console)
6. **Save** your changes
7. **Redeploy** your backend service (there should be a deploy/restart button)

### Step 3: Verify the Configuration

1. Open your Cheshbon app
2. Go to **Settings** → **OAuth Configuration**
3. You should see:
   - ✅ GOOGLE_CLIENT_ID: SET (with first 10 characters shown)
   - ✅ GOOGLE_CLIENT_SECRET: SET
4. Try signing in with Google - it should now work!

## Troubleshooting

### "I can't find the Environment Variables section in Specular"
- Look for sections named: "Environment Variables", "Config", "Settings", or "Env Vars"
- It's usually in the project settings or deployment configuration

### "Google Sign-In still doesn't work after adding the variables"
1. Make sure you **redeployed** the backend after adding the variables
2. Wait 1-2 minutes for the deployment to complete
3. Check the OAuth Configuration screen in the app to verify the variables are set
4. Make sure you copied the **entire** Client ID and Client Secret (no extra spaces)

### "I get a redirect URI mismatch error"
- Make sure the redirect URI in Google Cloud Console **exactly matches**:
  ```
  https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev/api/auth/callback/google
  ```
- No trailing slashes, no extra characters

## Need More Help?

Use the **OAuth Configuration** screen in your app (Settings → OAuth Configuration) to:
- Check which environment variables are set
- See your backend URLs
- Get direct links to Google Cloud Console and Specular Dashboard
- View step-by-step instructions

---

**Note:** I (the AI assistant) cannot directly access or modify your Specular dashboard. Only you can add these environment variables through the Specular web interface.
