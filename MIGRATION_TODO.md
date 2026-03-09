
# Supabase Migration TODO

## ✅ Completed

1. **Database Schema Created** - All tables created in Supabase with RLS policies
2. **Supabase API Helper Created** - `utils/supabaseApi.ts` with all CRUD functions
3. **Old API Deprecated** - `utils/api.ts` now throws errors to identify unmigrated code
4. **Data Management Updated** - `app/data-management.tsx` now uses Supabase functions
5. **Migration Documentation** - `SUPABASE_MIGRATION_COMPLETE.md` created

## 🔄 Files That Need Migration

The following files still import from `@/utils/api` and need to be updated to use `@/utils/supabaseApi`:

### High Priority (Core Functionality)

1. **app/(tabs)/(home)/index.tsx** - Home screen with goals
   - Replace: `authenticatedGet`, `authenticatedPost`, `authenticatedDelete`, `authenticatedPut`
   - Use: `getGoalsWithDailyEntries`, `createDailyEntry`, `deleteDailyEntry`, `getReflections`, `getJournals`, `createJournal`, `updateJournal`

2. **app/(tabs)/(home)/index.ios.tsx** - iOS home screen
   - Same as above

3. **app/(tabs)/settings.tsx** - Settings screen
   - Replace: `authenticatedGet`, `authenticatedPost`, `authenticatedPut`, `authenticatedDelete`
   - Use: `getLifeAreas`, `createLifeArea`, `updateLifeArea`, `deleteLifeArea`, `reorderLifeAreas`, `getStrategies`, `createStrategy`, `updateStrategy`, `deleteStrategy`, `getCurrencies`, `createCurrency`, `updateCurrency`, `deleteCurrency`, `getGainsLosses`, `createGainLoss`, `updateGainLoss`, `deleteGainLoss`, `getGainLossCategories`, `createGainLossCategory`, `updateGainLossCategory`, `deleteGainLossCategory`, `getReflectionMotivations`, `createReflectionMotivation`, `updateReflectionMotivation`, `deleteReflectionMotivation`, `getUserPreferences`, `updateUserPreferences`, `getCurrencyBalances`, `createCurrencyTransaction`

4. **app/(tabs)/settings.ios.tsx** - iOS settings screen
   - Same as above

5. **app/(tabs)/reflect.tsx** - Reflections screen
   - Replace: `authenticatedGet`, `authenticatedPost`, `authenticatedPut`, `authenticatedDelete`
   - Use: `getReflections`, `createReflection`, `updateReflection`, `deleteReflection`, `getGoals`, `getCurrencies`, `getGainsLosses`, `getStrategies`, `getReflectionMotivations`, `getUserPreferences`, `getJournals`, `createJournal`, `updateJournal`

6. **app/(tabs)/reflect.ios.tsx** - iOS reflections screen
   - Same as above

7. **app/(tabs)/reports.tsx** - Reports screen
   - Replace: `authenticatedGet`, `authenticatedPost`
   - Use: `getReportsData`, `getCurrencyBalances`, `createCurrencyTransaction`, `getCurrencyTransactions`

8. **app/create-goal.tsx** - Goal creation screen
   - Replace: `authenticatedGet`, `authenticatedPost`, `authenticatedPut`, `authenticatedDelete`
   - Use: `getGoals`, `getGoalById`, `createGoal`, `updateGoal`, `deleteGoal`, `getLifeAreas`, `getStrategies`, `getCurrencies`, `getUserPreferences`, `getAlarms`, `createAlarm`, `updateAlarm`, `deleteAlarm`

9. **app/create-goal.ios.tsx** - iOS goal creation screen
   - Same as above

10. **components/AddReflectionModal.tsx** - Reflection modal
    - Replace: `authenticatedPost`, `authenticatedPut`
    - Use: `createReflection`, `updateReflection`

11. **components/GoalScheduler.tsx** - Goal scheduler component
    - Replace: `authenticatedGet`
    - Use: Direct Supabase queries or keep as is if only reading schedule config

### Medium Priority

12. **app/alarms/create.tsx** - Alarm creation
    - Replace: `authenticatedGet`, `authenticatedPost`, `authenticatedPut`, `authenticatedDelete`
    - Use: `getAlarms`, `createAlarm`, `updateAlarm`, `deleteAlarm`, `getUserPreferences`

13. **app/ai-chat.tsx** - AI chat screen
    - Replace: `authenticatedGet`, `authenticatedPost`, `authenticatedDelete`, `apiGet`
    - Use: Keep as is (this uses a different backend service for AI)

14. **app/data-management.ios.tsx** - iOS data management
    - Same as `app/data-management.tsx`

### Lower Priority (Specialized Features)

15. **app/(tabs)/profile.tsx** - Profile screen
16. **app/(tabs)/profile.ios.tsx** - iOS profile screen
17. **app/(tabs)/reports.ios.tsx** - iOS reports screen
18. **app/other-reports.tsx** - Other reports screen
19. **app/other-reports.ios.tsx** - iOS other reports screen
20. **app/preferences.tsx** - Preferences screen
21. **app/preferences.ios.tsx** - iOS preferences screen
22. **app/preferences/alternative-calendars.tsx** - Alternative calendars
23. **app/preferences/alternative-calendars.ios.tsx** - iOS alternative calendars
24. **app/preferences/home-screen.tsx** - Home screen preferences
25. **app/preferences/home-screen.ios.tsx** - iOS home screen preferences
26. **app/preferences/notification.tsx** - Notification preferences
27. **app/preferences/reflection.tsx** - Reflection preferences
28. **app/preferences/reflection.ios.tsx** - iOS reflection preferences
29. **app/life-area-wizard.tsx** - Life area wizard
30. **app/life-area-wizard.ios.tsx** - iOS life area wizard
31. **app/mitzvot.tsx** - Mitzvot screen
32. **app/mitzvot-categories.tsx** - Mitzvot categories
33. **app/currency-reflections.tsx** - Currency reflections
34. **app/search-journals.tsx** - Journal search

## Migration Pattern

For each file, follow this pattern:

### 1. Update Imports
```typescript
// OLD
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';

// NEW
import { 
  getGoals, 
  createGoal, 
  updateGoal, 
  deleteGoal,
  // ... other functions as needed
} from '@/utils/supabaseApi';
```

### 2. Replace API Calls
```typescript
// OLD
const goals = await authenticatedGet('/api/goals');
const newGoal = await authenticatedPost('/api/goals', { title: 'My Goal' });
const updated = await authenticatedPut(`/api/goals/${id}`, { title: 'Updated' });
await authenticatedDelete(`/api/goals/${id}`);

// NEW
const goals = await getGoals();
const newGoal = await createGoal({ title: 'My Goal' });
const updated = await updateGoal(id, { title: 'Updated' });
await deleteGoal(id);
```

### 3. Update Error Handling
```typescript
// Supabase errors are already handled in supabaseApi.ts
// Just wrap in try-catch as before
try {
  const data = await getGoals();
  // Use data
} catch (error: any) {
  console.error('Error:', error.message);
  // Show error to user
}
```

### 4. Handle Data Structure Changes
Some data structures may be slightly different. Check the Supabase schema:
- `user_id` instead of `userId` in database (but converted in API)
- JSONB fields for arrays (behavior_categories, gained_ids, etc.)
- Timestamps are ISO 8601 strings
- Foreign key relationships return nested objects

## Testing Checklist

For each migrated screen:
- [ ] Data loads correctly
- [ ] Create operations work
- [ ] Update operations work
- [ ] Delete operations work
- [ ] Error messages display properly
- [ ] Loading states work
- [ ] No console errors
- [ ] Test on both iOS and Android (if platform-specific files exist)

## Notes

- The `ai-chat.tsx` file uses a different backend service and may not need migration
- Some files may have complex data transformations that need careful review
- Always test thoroughly after migration
- The old `utils/api.ts` will throw errors to help identify unmigrated code

## Priority Order

1. Start with core screens (home, settings, reflect, reports)
2. Then goal creation and management
3. Then preferences and specialized features
4. Test thoroughly at each step

## Estimated Effort

- High Priority: ~4-6 hours
- Medium Priority: ~2-3 hours
- Lower Priority: ~3-4 hours
- Total: ~9-13 hours

## Support

If you encounter issues:
1. Check `SUPABASE_MIGRATION_COMPLETE.md` for patterns
2. Review `utils/supabaseApi.ts` for available functions
3. Check Supabase dashboard for data structure
4. Test with small changes first
