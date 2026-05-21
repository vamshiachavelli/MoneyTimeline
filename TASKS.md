# MoneyTimeline MVP Task List

## Part 1: MVP Foundation

1. Project setup
   - Initialize Expo React Native app with TypeScript.
   - Set up authentication client, database schema, theme system, navigation, folders, and environment config.

2. Splash screen
   - Build dark premium launch experience with logo lockup and loading motion.

3. Onboarding
   - Build the first-run education flow for tracking life through money, importing statements, classifying expenses, and splitting with people or groups.

4. Authentication
   - Build email/password signup, login, persisted sessions, validation, loading states, errors, and logout.

5. Bottom navigation
   - Implement Calendar, Timeline, Shared, Insights, and Settings tabs with active states.

6. Home / Calendar screen
   - Build monthly calendar, month selector, daily indicators, spending totals, and unclassified/shared/personal summaries.

7. Import statement screen
   - Build PDF/CSV/Excel file picker, account selection, progress states, and import summary UI.

8. Statement parsing
   - Parse CSV, Excel, text PDFs, and scanned PDFs with OCR into normalized transaction rows with row-level errors.

9. Import review screen
   - Let users review, edit, skip, and save extracted transactions before persistence.

10. Duplicate detection
    - Detect and skip duplicate transactions using normalized hashes and review summaries.

11. Multi-account support
    - Add, view, edit, and assign accounts to statements and transactions.

12. Day detail bottom sheet
    - Show all transactions for a tapped calendar date and open transaction details.

13. Transaction swipe review
    - Swipe left for Personal, swipe right into Shared split flow, with undo and persistence.

14. Transaction detail screen
    - Show and edit transaction merchant, amount, date, account, category, description, status, and shared connections.

15. People management
    - Add, edit, delete people with optional contact fields and balance previews.

16. Groups management
    - Create, edit, delete groups and manage members with balance previews.

17. Split flow
    - Choose individual/group, select targets, choose equal/custom/percentage/item-level method, review, and save.

18. Balances / Shared screen
    - Show people and groups balances, total owed, transaction history, request placeholder, and settlement action.

19. Settlement detail
    - Show related transactions, payments, mark-as-paid flow, user confirmation, and future two-sided confirmation design.

20. Timeline feed
    - List transactions grouped by date with filters, merchant search, and transaction detail navigation.

21. Monthly recap / insights
    - Show spending totals, shared totals, top category, top merchant, most active day, and recap sharing placeholder.

22. Empty states
    - Create polished states for no transactions, shared expenses, groups, search results, and imported statements.

23. Settings
    - Build profile, accounts, import history, export placeholder, and logout.

## Part 2: Future Features

- Bank account connection.
- Real-time transaction detection.
- Push notifications.
- Add split immediately after a new transaction.
- Friend accounts and invites.
- Two-sided settlement confirmation.
- Web dashboard.
- AI categorization and duplicate detection.
- App Store release preparation.

## Implementation Rules

- Complete one task at a time.
- After each task, report exactly what changed, how to test it, requested feedback, and the next suggested task.
- Wait for approval before starting the next task.
