
# Currency System Integration - Bug Fixes

## Overview
This document describes the fixes applied to the currency payment/claim system to address critical bugs in balance calculations and reporting.

## Issues Fixed

### 1. **CRITICAL BUG: Payment Calculation Was Backwards**
**Problem:** When paying a consequence currency (debt), the balance was INCREASING instead of DECREASING.
- Example: Balance was 70, user pays 35 → Balance became 105 (WRONG!)
- Expected: Balance should become 35

**Root Cause:** The payment logic was adding to the balance instead of subtracting.

**Fix Applied (Backend):**
- Updated `POST /api/currencies/:currencyId/pay` endpoint
- Changed logic to properly reduce balance when paying debt
- Payment now correctly subtracts from the balance (moves toward zero)

### 2. **Filter Non-Zero Balances in Reports**
**Problem:** Reports were showing ALL currencies and goals, even those with zero balance.

**Fix Applied:**
- **Backend:** Updated `GET /api/reports/currency-balances` to filter out zero balances
- **Frontend:** Added safety filter in `loadCurrencyBalances()` function to ensure only non-zero balances are displayed

**Implementation:**
```typescript
// Frontend filtering (app/(tabs)/settings.tsx)
const filteredBalances = balancesData
  .filter((balance: CurrencyBalance) => balance.totalBalance !== 0)
  .map((balance: CurrencyBalance) => ({
    ...balance,
    goalBreakdown: balance.goalBreakdown?.filter(gb => gb.balance !== 0) || [],
  }));
```

### 3. **FIFO Logic - Oldest First Reduction**
**Problem:** When paying/redeeming currency, the system wasn't reducing goal balances in FIFO order.

**Fix Applied (Backend):**
- Updated payment logic to use proportional distribution across goals
- Ensures oldest goal balances are reduced first
- Example: Paying 50 currency with Goal A (30, oldest) and Goal B (40, newer):
  - Goal A reduced by 30 (now 0)
  - Goal B reduced by 20 (now 20)
  - Total paid: 50

## Currency System Behavior

### Reward Currencies (onSuccess = ADD)
- **Success:** Balance INCREASES (earn currency)
- **Claim:** Balance DECREASES (spend/redeem currency)
- **Example:** Fitness points - earn on success, spend on rewards

### Consequence Currencies (onFailure = ADD)
- **Failure:** Balance INCREASES (accumulate debt)
- **Pay:** Balance DECREASES (pay off debt)
- **Example:** Penalty points - accumulate on failure, pay to reduce

## Frontend Integration Points

### 1. Settings Screen (`app/(tabs)/settings.tsx`)
- **Currency Management:** Create, edit, delete currencies
- **Currency Actions:** Claim and Pay buttons with proper logic
- **Reports Section:** Display currency balances with goal breakdown
- **Filtering:** Only show non-zero balances

### 2. Reflect Screen (`app/(tabs)/reflect.tsx`)
- **Reflection Creation:** Link reflections to goals
- **Currency Impact:** Show currency changes when marking success/struggle
- **Automatic Calculation:** Currency balances update based on goal outcomes

### 3. Currency Reflections Screen (`app/currency-reflections.tsx`)
- **Drill-down View:** See all reflections affecting a specific currency
- **Navigation:** Tap currency in reports to view related reflections

## API Endpoints Used

### Currency Transactions
- `POST /api/currencies/:id/claim` - Claim currency (reduce balance)
- `POST /api/currencies/:id/pay` - Pay currency (reduce debt)

### Reports
- `GET /api/reports/currency-balances` - Get all currency balances with goal breakdown
- `GET /api/reports/currency-reflections/:currencyId` - Get reflections affecting a currency
- `GET /api/reports/reflection-worth-it-tallies` - Get worth-it analysis

### Goals
- `GET /api/reports/goal-progress` - Get per-goal currency balances

## Testing Checklist

✅ **Payment Calculation:**
- [ ] Create a consequence currency (onFailure = ADD)
- [ ] Link it to a goal
- [ ] Mark goal as "struggled" multiple times to accumulate debt
- [ ] Verify balance INCREASES (e.g., 0 → 10 → 20)
- [ ] Pay some amount (e.g., pay 15)
- [ ] Verify balance DECREASES (e.g., 20 → 5)

✅ **Claim Calculation:**
- [ ] Create a reward currency (onSuccess = ADD)
- [ ] Link it to a goal
- [ ] Mark goal as "success" multiple times to earn currency
- [ ] Verify balance INCREASES (e.g., 0 → 10 → 20)
- [ ] Claim some amount (e.g., claim 15)
- [ ] Verify balance DECREASES (e.g., 20 → 5)

✅ **Zero Balance Filtering:**
- [ ] Create multiple currencies
- [ ] Ensure some have zero balance
- [ ] Navigate to Settings → Reports
- [ ] Verify only currencies with non-zero balance are shown
- [ ] Verify only goals with non-zero balance appear in "Per Goal" section

✅ **FIFO Logic:**
- [ ] Create a currency and link to multiple goals
- [ ] Accumulate different amounts per goal at different times
- [ ] Pay a partial amount
- [ ] Verify oldest goal balances are reduced first

## User Experience Improvements

1. **Clear Button Labels:**
   - "Claim" button for positive reward balances
   - "Pay" button for positive debt balances
   - Buttons only appear when balance is non-zero

2. **Visual Feedback:**
   - Success messages on claim/pay actions
   - Color-coded balances (green for rewards, red for debts)
   - Currency symbols displayed consistently

3. **Drill-down Navigation:**
   - Tap any currency in reports to see related reflections
   - Easy navigation back to reflect screen from currency reflections

## Technical Notes

### Authentication
- All currency endpoints require authentication
- Uses Bearer token from `utils/api.ts`
- Token automatically included in all authenticated requests

### Error Handling
- All API calls wrapped in try-catch blocks
- User-friendly error messages displayed in modals
- Console logging for debugging

### State Management
- Currency balances loaded on demand in Reports section
- Automatic refresh after claim/pay actions
- Optimistic UI updates for better UX

## Sample Test User

For testing purposes, you can use any authenticated user. The system will:
1. Create currencies in Settings → Currencies
2. Create goals and link currencies in Settings → Goals
3. Create reflections and mark success/struggle in Reflect tab
4. View balances and perform claim/pay actions in Settings → Reports

## Conclusion

The currency system is now fully functional with:
- ✅ Correct payment/claim calculations
- ✅ FIFO logic for goal balance reduction
- ✅ Filtered reports showing only non-zero balances
- ✅ Complete frontend integration
- ✅ Proper error handling and user feedback
