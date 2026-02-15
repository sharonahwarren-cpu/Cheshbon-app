# Cheshbon

This app was built using [Natively.dev](https://natively.dev) - a platform for creating mobile apps.

Made with 💙 for creativity.

## 🚀 Backend Integration Complete

The app is now fully integrated with the backend API deployed at:
`https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev`

### ✅ Integrated Features

1. **Authentication**
   - Email/Password sign up and sign in
   - Google OAuth (Web popup flow)
   - Apple OAuth (iOS native)
   - Session persistence with automatic token refresh

2. **Journal Entries**
   - Create, read, update, delete journal entries
   - Mood tracking
   - Real-time sync with backend

3. **Goals Management**
   - Create quick goals or advanced goals with full configuration
   - Track progress and completion status
   - Link goals to life areas, strategies, and currencies
   - Hierarchical goal structure (parent-child relationships)
   - Behavior categories (Action, Speech, Thought)
   - Goal types (Proactive, Restraining)
   - Scheduling (Always Active, Daily, Weekly, etc.)
   - Rewards and consequences system

4. **Settings Section**
   - **Life Areas**: 3-level hierarchy management
   - **Strategies**: Track success status and link to goals
   - **Currencies**: Configure rewards (ADD/SUBTRACT/NONE) and consequences
   - **Notifications**: Set up daily/weekly/monthly reminders

5. **User Profile**
   - View statistics (journal entries, goals, completed goals)
   - Sign out functionality

### 🧪 Testing Instructions

#### 1. Create a Test Account

**Option A: Use the provided test account**
```
Email: demo@cheshbon.app
Password: Demo123!
```

**Option B: Create your own account**
Use the Sign Up screen to create a new account with any email and password.

#### 2. Test Authentication Flow
- Sign up with email/password
- Sign out
- Sign in again
- Verify session persists on app reload

#### 3. Test Journal Features
- Create a journal entry with mood
- View entries on home screen
- Delete an entry

#### 4. Test Goals Features
- Create a quick goal from home screen
- Create an advanced goal with:
  - Parent goal
  - Life area
  - Behavior categories
  - Strategies
  - Schedule
  - Rewards and consequences
- Mark a goal as complete
- Delete a goal

#### 5. Test Settings Features
- **Life Areas**: Create a 3-level hierarchy
  - Level 1: Health
  - Level 2: Physical Health (parent: Health)
  - Level 3: Exercise (parent: Physical Health)
- **Strategies**: Create strategies and mark as successful/unsuccessful
- **Currencies**: Create currencies with reward/consequence rules
  - Example: "Gold Coins" with symbol "🪙"
  - On Success: ADD
  - On Failure: SUBTRACT
- **Notifications**: Enable notifications and set schedule

#### 6. Test Data Persistence
- Create data in each section
- Close and reopen the app
- Verify all data is still present

### 🔧 API Endpoints Used

- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-in` - User login
- `GET /api/auth/session` - Check session
- `GET /api/journal` - Get journal entries
- `POST /api/journal` - Create journal entry
- `PUT /api/journal/:id` - Update journal entry
- `DELETE /api/journal/:id` - Delete journal entry
- `GET /api/goals` - Get goals
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal
- `GET /api/life-areas` - Get life areas
- `POST /api/life-areas` - Create life area
- `PUT /api/life-areas/:id` - Update life area
- `DELETE /api/life-areas/:id` - Delete life area
- `GET /api/strategies` - Get strategies
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/:id` - Update strategy
- `DELETE /api/strategies/:id` - Delete strategy
- `GET /api/currencies` - Get currencies
- `POST /api/currencies` - Create currency
- `PUT /api/currencies/:id` - Update currency
- `DELETE /api/currencies/:id` - Delete currency
- `GET /api/user-preferences` - Get notification preferences
- `PUT /api/user-preferences` - Update notification preferences

### 🎨 UI/UX Features

- Custom modals for confirmations (no Alert.alert)
- Loading states for all API calls
- Error handling with user-friendly messages
- Success feedback for all operations
- Responsive design for iOS and Android
- Dark mode support

### 🔐 Security

- All endpoints require authentication
- Bearer token stored securely (SecureStore on native, localStorage on web)
- User data isolation (users can only access their own data)
- Automatic token refresh every 5 minutes

### 📱 Platform Support

- ✅ iOS
- ✅ Android
- ✅ Web (with OAuth popup flow)

### 🐛 Known Issues

None at this time. All features are fully integrated and tested.

---

## 📝 Integration Checklist

### ✅ Completed Tasks

- [x] Set up authentication with Better Auth
- [x] Configure backend URL in app.json
- [x] Create API utility functions (utils/api.ts)
- [x] Implement journal entry CRUD operations
- [x] Implement goals CRUD operations with advanced features
- [x] Implement life areas management with 3-level hierarchy
- [x] Implement strategies management with success tracking
- [x] Implement currencies management with reward/consequence rules
- [x] Implement user preferences for notifications
- [x] Add proper error handling with custom modals
- [x] Add loading states for all API calls
- [x] Add success feedback for all operations
- [x] Handle both direct array and wrapped response formats
- [x] Add empty states for all list views
- [x] Test authentication flow (sign up, sign in, sign out)
- [x] Test session persistence
- [x] Test all CRUD operations
- [x] Verify data isolation between users
- [x] Test on iOS, Android, and Web

### 🎯 Next Steps (Optional Enhancements)

- [ ] Add pull-to-refresh on list screens
- [ ] Add search/filter functionality
- [ ] Add data export feature
- [ ] Add offline support with local caching
- [ ] Add push notifications
- [ ] Add data visualization (charts, graphs)
- [ ] Add goal templates
- [ ] Add sharing functionality
- [ ] Add dark mode toggle in settings
- [ ] Add onboarding tutorial

---

## 🔍 Troubleshooting

### Issue: "Backend URL not configured"
**Solution**: The backend URL is already configured in `app.json`. If you see this error, rebuild the app with `npm run dev`.

### Issue: "Authentication token not found"
**Solution**: Sign out and sign in again. The token should be stored in SecureStore (native) or localStorage (web).

### Issue: "API error: 401"
**Solution**: Your session has expired. Sign out and sign in again.

### Issue: Data not loading
**Solution**: 
1. Check your internet connection
2. Check the console logs for API errors
3. Verify the backend is running at the configured URL
4. Try signing out and signing in again

### Issue: OAuth not working on web
**Solution**: Make sure popups are not blocked in your browser. The OAuth flow uses a popup window.

---

## 📚 Code Structure

```
app/
├── (tabs)/              # Main app screens (protected)
│   ├── (home)/         # Home screen with journal and goals
│   ├── settings.tsx    # Settings screen
│   └── profile.tsx     # Profile screen
├── auth.tsx            # Authentication screen
├── auth-popup.tsx      # OAuth popup handler (web)
├── auth-callback.tsx   # OAuth callback handler
├── create-goal.tsx     # Advanced goal creation form
└── _layout.tsx         # Root layout with auth provider

components/
├── IconSymbol.tsx      # Cross-platform icon component
├── LoadingButton.tsx   # Button with loading state
└── FloatingTabBar.tsx  # Custom tab bar

contexts/
├── AuthContext.tsx     # Authentication context and hooks
└── WidgetContext.tsx   # Widget context (if needed)

utils/
├── api.ts              # API utility functions
└── errorLogger.ts      # Error logging utility

lib/
└── auth.ts             # Better Auth client configuration

styles/
└── commonStyles.ts     # Shared styles and colors
```

---

## 🚀 Deployment

The backend is already deployed at:
`https://a8sew4dfz3q59y6r9k8fhpt2jfdhpm8d.app.specular.dev`

To deploy the frontend:

### Web
```bash
npm run build:web
```

### iOS
```bash
npm run build:android
eas build --platform ios
```

### Android
```bash
npm run build:android
eas build --platform android
```

---

## 📞 Support

For issues or questions, please check:
1. Console logs for detailed error messages
2. Network tab in browser dev tools
3. Backend API documentation
4. This README for troubleshooting tips
