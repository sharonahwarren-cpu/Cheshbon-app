
# Authentication Setup Instructions

## Overview
This app uses a complete authentication system with:
- Email/Password authentication
- Google OAuth
- Apple Sign-In (iOS native)
- Biometric authentication (Face ID, Touch ID, Fingerprint)

## Backend Status
✅ Backend authentication endpoints are being built automatically.

The following endpoints will be available:
- `POST /api/auth/sign-up/email` - Create account with email/password
- `POST /api/auth/sign-in/email` - Sign in with email/password
- `POST /api/auth/sign-in/social/google` - Sign in with Google
- `POST /api/auth/sign-in/social/apple` - Sign in with Apple
- `GET /api/auth/me` - Get current user (requires Bearer token)
- `POST /api/auth/sign-out` - Sign out (requires Bearer token)

## Google OAuth Setup

### 1. Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"

### 2. Create OAuth Client IDs

You need to create **3 separate client IDs**:

#### iOS Client ID:
- Application type: **iOS**
- Bundle ID: `com.anonymous.Natively`
- Copy the Client ID

#### Android Client ID:
- Application type: **Android**
- Package name: `com.anonymous.Natively`
- SHA-1 certificate fingerprint: Get from your keystore
  - For development: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
- Copy the Client ID

#### Web Client ID:
- Application type: **Web application**
- Authorized JavaScript origins:
  - `http://localhost:8081`
  - `https://your-domain.com` (if deploying to web)
- Authorized redirect URIs:
  - `https://auth.expo.io/@your-username/Cheshbon`
  - `http://localhost:8081/auth-callback`
  - `https://your-domain.com/auth-callback`
- Copy the Client ID

### 3. Update Client IDs in Code

Open `contexts/AuthContext.tsx` and replace the placeholder client IDs:

```typescript
const GOOGLE_CLIENT_IDS = {
  ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  android: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  web: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};
```

### 4. Authorized Redirect URIs

Add these redirect URIs to your Google OAuth client:
- `cheshbon://auth-callback` (for native mobile)
- `https://auth.expo.io/@your-username/Cheshbon` (for Expo Go)
- Your backend callback: `https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev/api/auth/callback/google`

## Apple Sign-In Setup (iOS Only)

### 1. Apple Developer Account Configuration

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to "Certificates, Identifiers & Profiles"

### 2. Configure App ID

1. Select your App ID (`com.anonymous.Natively`)
2. Enable "Sign In with Apple" capability
3. Save changes

### 3. Create Services ID (for web/backend)

1. Create a new Services ID (e.g., `com.anonymous.Natively.service`)
2. Enable "Sign In with Apple"
3. Configure redirect URIs:
   - `https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev/api/auth/callback/apple`

### 4. Generate Private Key

1. Create a new Key
2. Enable "Sign In with Apple"
3. Download the `.p8` private key file
4. Note the Key ID
5. Provide this to your backend for server-side validation

### 5. Native iOS Configuration

The app is already configured for native Apple Sign-In:
- `expo-apple-authentication` plugin is installed
- `NSFaceIDUsageDescription` is set in `app.json`
- Native Apple Sign-In button is shown only on iOS devices

## Biometric Authentication Setup

### iOS (Face ID / Touch ID)
- Already configured with `NSFaceIDUsageDescription` in `app.json`
- Works automatically on devices with Face ID or Touch ID

### Android (Fingerprint / Face Unlock)
- Already configured with `USE_BIOMETRIC` and `USE_FINGERPRINT` permissions
- Works automatically on devices with biometric hardware

### How It Works
1. User signs in with email/password first
2. Credentials are stored securely in `expo-secure-store`
3. On subsequent launches, user can use biometrics
4. Biometric authentication retrieves stored credentials and signs in automatically

## Testing the Authentication Flow

### 1. Email/Password
```
1. Open the app
2. Tap "Sign Up" if new user
3. Enter email, password, and name
4. Tap "Sign Up" button
5. Should see console logs:
   - "📧 [EMAIL] Signing up with email: ..."
   - "✅ [EMAIL] Token stored securely"
   - "✅ [EMAIL] Session established"
6. Should redirect to home screen
```

### 2. Google Sign-In
```
1. Tap "Continue with Google" button
2. Should see console logs:
   - "📱 [GOOGLE] Redirect URI: ..."
   - "📱 [GOOGLE] Calling promptAsync..."
3. Browser should open with Google sign-in
4. After signing in, should see:
   - "📱 [GOOGLE] Browser result type: success"
   - "💾 [GOOGLE] Sending provider token to backend..."
   - "✅ [GOOGLE] Session established via backend"
5. Should redirect to home screen
```

### 3. Apple Sign-In (iOS only)
```
1. Tap "Continue with Apple" button
2. Should see console logs:
   - "📞 [APPLE] Apple Authentication available: true"
   - "📞 [APPLE] Calling signInWithApple..."
3. Native Apple Sign-In sheet should appear
4. After signing in, should see:
   - "✅ [APPLE] Apple credential received"
   - "💾 [APPLE] Sending provider token to backend..."
   - "✅ [APPLE] Session established via backend"
5. Should redirect to home screen
```

### 4. Biometric Sign-In
```
1. Sign in with email/password first (to store credentials)
2. Sign out
3. On auth screen, should see biometric button (Face ID/Touch ID/Fingerprint)
4. Tap biometric button
5. Should see console logs:
   - "🔐 [BIOMETRIC] Stored credentials found"
   - "🔐 [BIOMETRIC] Authentication result: true"
   - "✅ [BIOMETRIC] Biometric authentication successful"
6. Should redirect to home screen
```

## Troubleshooting

### Google Sign-In Not Working
- Check that client IDs are correct in `AuthContext.tsx`
- Verify redirect URIs in Google Cloud Console
- Check console logs for error messages
- Ensure `expo-web-browser` is installed

### Apple Sign-In Not Available
- Only works on iOS devices (not Android or web)
- Check that App ID has "Sign In with Apple" enabled
- Verify `expo-apple-authentication` plugin is in `app.json`

### Biometric Not Available
- Check device has biometric hardware
- Ensure biometrics are enrolled in device settings
- Verify permissions in `app.json`

### 401 Unauthorized Errors
- Check that backend endpoints are deployed
- Verify Bearer token is being sent in Authorization header
- Check token expiration (30 days)
- Look at backend logs for detailed error messages

## Console Log Prefixes

The authentication system uses prefixed console logs for easy debugging:
- `📧 [EMAIL]` - Email/password authentication
- `📱 [GOOGLE]` - Google OAuth
- `📞 [APPLE]` - Apple Sign-In
- `🔐 [BIOMETRIC]` - Biometric authentication
- `🔄 [AUTH]` - General auth operations
- `🚪 [AUTH]` - Sign out operations
- `[API]` - API calls

## Security Notes

1. **Secure Storage**: All tokens and credentials are stored using `expo-secure-store`
2. **Bearer Tokens**: All authenticated requests include `Authorization: Bearer <token>` header
3. **Token Expiration**: Session tokens expire after 30 days
4. **Password Hashing**: Passwords are hashed with bcrypt on the backend
5. **HTTPS Only**: All API calls use HTTPS in production

## Next Steps

1. ✅ Install dependencies (already done)
2. ⏳ Wait for backend to finish building
3. 🔧 Configure Google OAuth client IDs
4. 🔧 Configure Apple Sign-In (iOS only)
5. ✅ Test authentication flows
6. 🚀 Deploy to production

## Files Created

- `contexts/AuthContext.tsx` - Authentication context and logic
- `app/auth.tsx` - Authentication screen UI
- `app/auth-callback.tsx` - OAuth callback handler
- `app/(tabs)/_layout.tsx` - Protected route wrapper
- `app/(tabs)/_layout.ios.tsx` - iOS-specific protected route wrapper
- `app/(tabs)/profile.tsx` - Profile screen with sign-out
- `app/(tabs)/profile.ios.tsx` - iOS-specific profile screen
- `utils/api.ts` - Updated with Bearer token support

## Dependencies Installed

- `expo-auth-session` - OAuth flow management
- `expo-web-browser` - Opens web pages for OAuth
- `expo-crypto` - Cryptographic functions
- `expo-apple-authentication` - Native Apple Sign-In
- `expo-secure-store` - Secure token storage
- `expo-local-authentication` - Biometric authentication
