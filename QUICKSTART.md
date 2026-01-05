# Quick Start Guide

## Get Up and Running in 5 Minutes

### Step 1: Get Clerk API Key

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Sign up or log in
3. Click **"+ Create application"**
4. Name it "EditedRoute" (or any name you prefer)
5. Select authentication methods:
   - ✅ Google
   - ✅ Apple
   - ✅ Passkeys
6. Click **"Create application"**
7. Copy your **Publishable Key** (starts with `pk_test_`)

### Step 2: Add API Key to Project

Create a `.env` file in the EditedRoute root directory:

```bash
cd EditedRoute
touch .env
```

Add your key:

```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Step 3: Configure Redirect URLs in Clerk

In your Clerk Dashboard:

1. Go to **"Redirect URLs"**
2. Add these URLs:
   ```
   exp://localhost:8081
   editedroute://
   ```

### Step 4: Run the App

```bash
# For iOS
npx expo run:ios

# For Android
npx expo run:android

# For development server
npx expo start
```

### Step 5: Test Authentication

1. App should open to sign-in screen
2. Try signing in with:
   - **Passkeys** (Face ID/Touch ID)
   - **Apple Sign-In**
   - **Google Sign-In**
3. After successful sign-in, you'll see the welcome screen ✅

## That's It! 🎉

Your authentication is now fully configured and working.

## Need Help?

Check the full documentation in [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md)

## Common First-Time Issues

**Error: "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"**

- Make sure `.env` file is in the project root
- Restart Expo after creating `.env`

**OAuth Not Working**

- Verify redirect URLs in Clerk Dashboard
- Make sure you enabled the provider in Clerk settings

**Passkeys Not Showing**

- Enable Passkeys in Clerk Dashboard under Settings → Authentication
