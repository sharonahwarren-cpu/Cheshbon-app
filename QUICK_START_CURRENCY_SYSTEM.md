
# Quick Start: Currency System

## What Was Fixed?

### 🐛 Bug #1: Payment Calculation (CRITICAL)
**Before:** Paying debt INCREASED the balance (backwards!)
**After:** Paying debt DECREASES the balance (correct!)

### 🐛 Bug #2: Zero Balance Clutter
**Before:** Reports showed ALL currencies, even with $0 balance
**After:** Reports only show currencies with non-zero balance

### 🐛 Bug #3: FIFO Logic
**Before:** Payments distributed randomly across goals
**After:** Payments reduce oldest goal balances first

## How to Test

### Test 1: Consequence Currency (Debt)
1. Go to **Settings → Currencies**
2. Create a new currency:
   - Name: "Penalty Points"
   - Symbol: "⚠️"
   - On Success: None
   - On Failure: **Add (Increase Debt)**
3. Go to **Settings → Goals**
4. Create a goal and link "Penalty Points" as consequence currency
5. Go to **Reflect** tab
6. Create a reflection, link to your goal, mark as "Struggled"
7. Repeat step 6 a few times
8. Go to **Settings → Reports**
9. You should see "Penalty Points" with a positive balance (e.g., 30⚠️)
10. Click **"Pay"** button and enter amount (e.g., 15)
11. ✅ **VERIFY:** Balance should DECREASE (30 → 15)

### Test 2: Reward Currency
1. Go to **Settings → Currencies**
2. Create a new currency:
   - Name: "Fitness Points"
   - Symbol: "💪"
   - On Success: **Add (Gain Currency)**
   - On Failure: None
3. Go to **Settings → Goals**
4. Create a goal and link "Fitness Points" as reward currency
5. Go to **Reflect** tab
6. Create a reflection, link to your goal, mark as "Success"
7. Repeat step 6 a few times
8. Go to **Settings → Reports**
9. You should see "Fitness Points" with a positive balance (e.g., 30💪)
10. Click **"Claim"** button and enter amount (e.g., 15)
11. ✅ **VERIFY:** Balance should DECREASE (30 → 15)

### Test 3: Zero Balance Filtering
1. Create multiple currencies (some with balance, some without)
2. Go to **Settings → Reports**
3. ✅ **VERIFY:** Only currencies with non-zero balance are shown
4. ✅ **VERIFY:** In "Per Goal" section, only goals with non-zero balance appear

## Key Features

### 📊 Reports Section
- **Total Currency Balances:** See all your currency totals
- **Per Goal Breakdown:** See how much each goal owes/has earned
- **Tap to Drill Down:** Tap any currency to see related reflections

### 💰 Currency Actions
- **Claim Button:** Appears for positive reward balances (spend your earnings)
- **Pay Button:** Appears for positive debt balances (pay off your debt)
- **Smart Logic:** Buttons only show when balance is non-zero

### 🎯 Goal Integration
- **Link Currencies:** Each goal can have a reward and/or consequence currency
- **Automatic Tracking:** Balances update automatically when you mark success/struggle
- **Per-Goal View:** See exactly how much each goal owes or has earned

## Navigation

```
Settings
├── Currencies (Create/Edit currencies)
├── Goals (Link currencies to goals)
└── Reports
    ├── Currency Balances (View totals)
    └── Tap currency → Currency Reflections (Drill down)

Reflect
└── Create Reflection
    ├── Link to Goal
    └── Mark Success/Struggle → Currency auto-updates
```

## Common Questions

**Q: Why is my balance increasing when I pay?**
A: This bug has been FIXED! If you still see this, please refresh the app.

**Q: Why don't I see my currency in Reports?**
A: Reports only show currencies with non-zero balance. Create some reflections first!

**Q: What's the difference between Claim and Pay?**
A: 
- **Claim:** Spend your earned reward currency (reduces positive balance)
- **Pay:** Pay off your debt/consequence currency (reduces positive debt)

**Q: How do I see which reflections affected a currency?**
A: In Settings → Reports, tap any currency card to see all related reflections.

## Tips

1. **Start Simple:** Create one reward currency and one consequence currency
2. **Link to Goals:** Make sure to link currencies to goals in Settings → Goals
3. **Reflect Daily:** Create reflections and mark success/struggle to see balances change
4. **Check Reports:** Go to Settings → Reports to see your currency balances
5. **Drill Down:** Tap any currency to see which reflections affected it

## Need Help?

If you encounter any issues:
1. Check console logs for error messages
2. Verify you're authenticated (signed in)
3. Ensure currencies are properly linked to goals
4. Try refreshing the app

---

**Status:** ✅ All bugs fixed and tested
**Last Updated:** 2024
