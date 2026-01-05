# EditedRoute Authentication Architecture

## Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         APP LAUNCH                               │
│                    app/_layout.tsx                               │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  1. Import 'react-native-url-polyfill/auto' (FIRST!)   │    │
│  │  2. Wrap with <ClerkProvider>                          │    │
│  │  3. Configure tokenCache (SecureStore)                 │    │
│  │  4. Enable Passkeys support                            │    │
│  │  5. Wrap with <ClerkLoaded>                           │    │
│  └────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│                    app/index.tsx                                 │
│              Check: isSignedIn?                                  │
└─────────────────────┬─────────────────┬─────────────────────────┘
                      │                 │
           ┌──────────┘                 └──────────┐
           │                                       │
           ▼ NO                                    ▼ YES
    ┌─────────────────┐                   ┌──────────────────┐
    │   (auth) group  │                   │   (main) group   │
    │                 │                   │                  │
    │  ┌───────────┐  │                   │  ┌────────────┐  │
    │  │_layout.tsx│  │                   │  │_layout.tsx │  │
    │  │ Redirects │  │                   │  │ Redirects  │  │
    │  │ if signed │  │                   │  │ if not     │  │
    │  │ in        │  │                   │  │ signed in  │  │
    │  └─────┬─────┘  │                   │  └──────┬─────┘  │
    │        │        │                   │         │        │
    │        ▼        │                   │         ▼        │
    │  ┌───────────┐  │                   │  ┌────────────┐  │
    │  │sign-in.tsx│  │                   │  │ index.tsx  │  │
    │  │           │  │                   │  │            │  │
    │  │ ┌───────┐ │  │                   │  │ Welcome!   │  │
    │  │ │🔑Pass │ │  │                   │  │ You are    │  │
    │  │ │ keys  │ │  │                   │  │ logged in  │  │
    │  │ └───────┘ │  │                   │  │ ✅         │  │
    │  │           │  │                   │  │            │  │
    │  │ ┌───────┐ │  │                   │  │ [Sign Out] │  │
    │  │ │🍎Apple│ │  │                   │  └────────────┘  │
    │  │ └───────┘ │  │                   │                  │
    │  │           │  │                   └──────────────────┘
    │  │ ┌───────┐ │  │
    │  │ │G Google│ │  │
    │  │ └───────┘ │  │
    │  │           │  │
    │  └─────┬─────┘  │
    └────────┼────────┘
             │
             │ Authentication Success
             │
             ▼
    ┌─────────────────────┐
    │  Clerk creates      │
    │  secure session     │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Token saved to     │
    │  SecureStore        │
    │  (utils/cache.ts)   │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────┐
    │  Auto redirect to   │
    │  (main)/index.tsx   │
    └─────────────────────┘
```

## Component Responsibilities

### 🔹 app/\_layout.tsx (Root)

**Purpose**: Application-wide authentication setup

- Imports URL polyfill FIRST (critical for auth)
- Wraps entire app with ClerkProvider
- Configures secure token storage
- Enables Passkeys support
- Provides ClerkLoaded wrapper for loading state

### 🔹 app/index.tsx (Router)

**Purpose**: Smart routing based on auth state

- Checks `isSignedIn` from useUser()
- Waits for auth state to load
- Redirects to (auth) or (main) appropriately

### 🔹 app/(auth)/\_layout.tsx

**Purpose**: Auth group container

- Prevents signed-in users from accessing sign-in
- Redirects authenticated users to main app
- Manages Stack navigation for auth screens

### 🔹 app/(auth)/sign-in.tsx

**Purpose**: Authentication interface

- Provides 3 sign-in methods
- Handles OAuth flows (Apple, Google)
- Manages Passkeys authentication
- Displays errors and loading states
- Completes WebBrowser auth sessions

### 🔹 app/(main)/\_layout.tsx

**Purpose**: Protected routes container

- Prevents unauthenticated access
- Redirects unsigned users to sign-in
- Manages Stack navigation for protected screens
- Configures headers and navigation options

### 🔹 app/(main)/index.tsx

**Purpose**: Main protected screen

- Displays welcome message
- Shows user information
- Provides sign-out functionality
- Only accessible when authenticated

### 🔹 utils/cache.ts

**Purpose**: Secure token storage

- Implements Clerk's TokenCache interface
- Uses Expo SecureStore for encryption
- Handles token retrieval and saving
- Provides error handling and cleanup

## Data Flow

```
┌─────────────┐
│   User      │
│   Action    │
└──────┬──────┘
       │
       ▼
┌─────────────┐         ┌─────────────┐
│   Sign-In   │────────▶│    Clerk    │
│   Screen    │         │   Service   │
└─────────────┘         └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Create    │
                        │   Session   │
                        └──────┬──────┘
                               │
                               ▼
                        ┌─────────────┐
                        │    Save     │◀───┐
                        │   Token to  │    │
                        │ SecureStore │    │
                        └──────┬──────┘    │
                               │           │
                               ▼           │
                        ┌─────────────┐    │
                        │   Update    │    │
                        │  isSignedIn │    │
                        │    State    │    │
                        └──────┬──────┘    │
                               │           │
                               ▼           │
                        ┌─────────────┐    │
                        │  Redirect   │    │
                        │  to Main    │    │
                        │   Screen    │    │
                        └──────┬──────┘    │
                               │           │
                               ▼           │
                        ┌─────────────┐    │
                        │  Protected  │    │
                        │    Route    │    │
                        │  Accessed   │    │
                        └─────────────┘    │
                                           │
On subsequent app launches: ───────────────┘
Token retrieved from SecureStore,
user automatically authenticated
```

## Security Layers

```
┌──────────────────────────────────────────┐
│         Application Layer                │
│  (React Native + Expo Router)            │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│      Authentication Layer                │
│         (Clerk Service)                  │
│                                          │
│  • OAuth flows (Apple, Google)           │
│  • Passkeys management                   │
│  • Session creation & validation         │
│  • Token generation & refresh            │
└────────────────┬─────────────────────────┘
                 │
┌────────────────▼─────────────────────────┐
│        Storage Layer                     │
│      (Expo SecureStore)                  │
│                                          │
│  • Encrypted token storage               │
│  • Keychain/Keystore integration         │
│  • Automatic OS-level encryption         │
└──────────────────────────────────────────┘
```

## Route Protection Flow

```
User tries to access route
         │
         ▼
┌────────────────┐
│  Route Group   │
│   _layout.tsx  │
└────────┬───────┘
         │
         ▼
┌────────────────────┐      YES     ┌──────────────┐
│  Check isSignedIn  │─────────────▶│ Allow Access │
└────────┬───────────┘              └──────────────┘
         │
         │ NO
         ▼
┌────────────────────┐
│  Redirect to Auth  │
└────────────────────┘
```

## Environment Configuration

```
┌─────────────────────────────────────┐
│         Clerk Dashboard             │
│                                     │
│  1. Create Application              │
│  2. Enable OAuth Providers          │
│  3. Configure Redirect URLs         │
│  4. Get Publishable Key             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│          .env File                  │
│                                     │
│  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY  │
│  = pk_test_...                      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│        app/_layout.tsx              │
│                                     │
│  Reads key via:                     │
│  process.env.EXPO_PUBLIC_...        │
└─────────────────────────────────────┘
```

## Key Design Decisions

### 1. Route Groups

- **(auth)** for public authentication screens
- **(main)** for protected application screens
- Clean separation of concerns
- Easy to scale and add new screens

### 2. Token Storage

- Uses Expo SecureStore on native platforms
- Encrypted by default using OS keychain
- Automatic token refresh by Clerk
- No manual token management needed

### 3. URL Polyfill

- Imported FIRST before any other code
- Required for OAuth redirect handling
- Ensures compatibility across platforms

### 4. Loading States

- ClerkLoaded wrapper prevents flash of wrong content
- isLoaded check before routing decisions
- Smooth user experience during auth state resolution

### 5. Error Handling

- ClerkAPIError type checking
- User-friendly error messages
- Console logging for debugging
- Graceful fallbacks

## Testing Strategy

```
1. Sign-In Flow
   ├── Test Passkeys ✓
   ├── Test Apple ✓
   └── Test Google ✓

2. Route Protection
   ├── Access without auth → redirect ✓
   └── Access with auth → allow ✓

3. Session Persistence
   ├── Close app ✓
   ├── Reopen app ✓
   └── Still authenticated ✓

4. Sign-Out
   ├── Click sign out ✓
   ├── Redirect to sign-in ✓
   └── Cannot access protected routes ✓
```

---

This architecture provides a robust, scalable, and secure foundation for the EditedRoute application.
