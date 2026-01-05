# EditedRoute - Stage 1: Authentication Setup ✅

## Overview

Full authentication implementation using Clerk with support for:

- 🍎 Apple Sign-In
- 🔍 Google Sign-In
- 🔑 Passkeys Authentication

## Project Structure

```
EditedRoute/
├── app/
│   ├── _layout.tsx                 # Root layout with ClerkProvider
│   ├── index.tsx                   # Initial redirect handler
│   ├── (auth)/
│   │   ├── _layout.tsx            # Auth group layout
│   │   └── sign-in.tsx            # Sign-in screen
│   └── (main)/
│       ├── _layout.tsx            # Protected app layout
│       └── index.tsx              # Main welcome screen
└── utils/
    └── cache.ts                   # Secure token storage
```

## Setup Instructions

### 1. Install Dependencies

All required dependencies are already installed:

- ✅ @clerk/clerk-expo
- ✅ @clerk/expo-passkeys
- ✅ @clerk/types
- ✅ react-native-url-polyfill
- ✅ expo-secure-store
- ✅ expo-auth-session
- ✅ expo-web-browser

### 2. Configure Clerk

1. **Create a Clerk Account**

   - Go to [https://dashboard.clerk.com/](https://dashboard.clerk.com/)
   - Create a new application

2. **Configure OAuth Providers**

   - Enable Google OAuth in Clerk Dashboard
   - Enable Apple OAuth in Clerk Dashboard
   - Enable Passkeys in Clerk Dashboard

3. **Get Your Publishable Key**

   - Navigate to API Keys in your Clerk dashboard
   - Copy your Publishable Key

4. **Add Environment Variable**
   ```bash
   # Create .env file in project root
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   ```

### 3. Configure Redirect URLs

Add these redirect URLs in your Clerk Dashboard under "Redirect URLs":

For Development:

```
exp://localhost:8081
```

For Production:

```
your-app-scheme://
```

### 4. Configure app.json

Ensure your `app.json` has a scheme defined:

```json
{
  "expo": {
    "scheme": "editedroute"
  }
}
```

## Running the App

### iOS

```bash
npx expo run:ios
```

### Android

```bash
npx expo run:android
```

### Development Mode

```bash
npx expo start
```

## Authentication Flow

### 1. **Initial Load**

- App checks authentication state via `useUser()` hook
- Unauthenticated users → Redirect to sign-in screen
- Authenticated users → Redirect to main screen

### 2. **Sign-In Process**

Users can authenticate using:

- **Passkeys**: Biometric authentication (Face ID, Touch ID)
- **Apple**: Native Apple Sign-In
- **Google**: OAuth Google Sign-In

### 3. **Session Management**

- Tokens stored securely in Expo SecureStore
- Automatic session persistence
- Secure token refresh handled by Clerk

### 4. **Protected Routes**

- `(main)` group requires authentication
- Automatic redirect to sign-in if session expires
- ClerkProvider wraps entire app for global auth state

## Key Features

### 🔒 Security

- Secure token storage using Expo SecureStore
- Automatic session management
- Support for biometric authentication via Passkeys

### 🎨 User Experience

- Clean, modern UI with dark theme
- Loading states during authentication
- Error handling with user-friendly messages
- Smooth navigation between auth states

### 🏗️ Architecture

- Modular component structure
- TypeScript for type safety
- Route groups for clean organization
- Comprehensive error handling

## File Descriptions

### `app/_layout.tsx`

Root layout that:

- Imports URL polyfill first (required for Clerk)
- Wraps app with `ClerkProvider`
- Enables Passkeys support
- Provides token caching

### `app/index.tsx`

Initial route that:

- Checks authentication state
- Redirects to appropriate screen based on auth status

### `app/(auth)/sign-in.tsx`

Sign-in screen featuring:

- Three authentication methods (Passkeys, Apple, Google)
- Error handling and display
- Loading states
- Modern, accessible UI

### `app/(main)/index.tsx`

Protected main screen that:

- Displays welcome message
- Shows user information
- Provides sign-out functionality

### `utils/cache.ts`

Token cache utility that:

- Implements Clerk's TokenCache interface
- Uses Expo SecureStore for native platforms
- Handles errors gracefully

## Testing Checklist

- [ ] App starts without errors
- [ ] Sign-in screen appears when not authenticated
- [ ] Apple Sign-In works correctly
- [ ] Google Sign-In works correctly
- [ ] Passkeys authentication works
- [ ] User redirected to main screen after sign-in
- [ ] Main screen shows user information
- [ ] Sign-out functionality works
- [ ] User redirected to sign-in after sign-out
- [ ] Session persists across app restarts

## Troubleshooting

### Common Issues

**1. "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" Error**

- Create `.env` file in project root
- Add your Clerk publishable key

**2. OAuth Redirect Issues**

- Verify redirect URLs in Clerk Dashboard
- Check app.json scheme configuration
- Ensure WebBrowser.maybeCompleteAuthSession() is called

**3. Passkeys Not Working**

- Enable Passkeys in Clerk Dashboard
- Test on physical device (not simulator for iOS)
- Ensure biometrics are set up on device

**4. Build Errors**

- Clear cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Clean builds: `cd ios && rm -rf Pods && pod install`

## Next Steps

Stage 1 is now complete! You can proceed with:

- Stage 2: Database integration
- Stage 3: Additional app features
- Stage 4: Enhanced user profiles
- Stage 5: Push notifications

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Native Documentation](https://reactnative.dev/)

## Support

If you encounter issues:

1. Check the error messages in the console
2. Review Clerk Dashboard configuration
3. Verify environment variables
4. Check redirect URLs match your setup

---

**Stage 1 Status**: ✅ Complete

All authentication flows implemented and ready for testing!
