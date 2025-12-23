#!/bin/bash

set -e

echo "Creating GitHub issues from PR #2 review feedback..."
echo ""

# High Priority Issues
echo "Creating high priority issues..."

gh issue create --title "Add timezone-safe date handling" --label "bug" --label "priority: high" --body "## Problem
Multiple places in the codebase use \`.toISOString().split('T')[0]\` which returns UTC dates, but the app may need local dates.

## Locations
- \`app/api/stats/batch/route.ts:65\`: \`workingDays.push(d.toISOString().split('T')[0]);\`
- Other date handling locations

## Impact
For users in timezones ahead of UTC (like JST), this could cause off-by-one-day errors near midnight.

## Solution
Use a consistent date formatting approach that respects the user's timezone or explicitly handles UTC conversion.

## Related
From PR #2 review feedback"

gh issue create --title "Extract magic numbers to constants" --label "refactor" --label "priority: high" --body "## Problem
Magic numbers appear throughout the codebase without clear context.

## Locations
- \`app/page.tsx:61\`: \`if (now - lastRefreshRef.current > 30000)\`
  - Should be: \`const IDLE_REFRESH_THRESHOLD_MS = 30_000;\`

## Solution
Extract all magic numbers to named constants with clear, descriptive names.

## Related
From PR #2 review feedback"

gh issue create --title "Add descriptive error messages" --label "enhancement" --label "priority: high" --body "## Problem
Error messages are too generic and don't help with debugging.

## Locations
- \`app/api/stats/batch/route.ts:126\`: \`return NextResponse.json({ error: 'Failed' }, { status: 500 });\`

## Solution
Use more descriptive error messages. At minimum: \`'Failed to fetch batch stats'\`

## Related
From PR #2 review feedback"

# Medium Priority Issues
echo "Creating medium priority issues..."

gh issue create --title "Add Error Boundaries" --label "enhancement" --label "priority: medium" --body "## Problem
Components don't have React Error Boundaries to catch render errors gracefully. If a store enters an invalid state, the entire app could crash.

## Solution
Add Error Boundaries at the top level (especially around tab content).

## Related
From PR #2 review feedback"

gh issue create --title "Add test coverage for centralized state management" --label "testing" --label "priority: medium" --body "## Problem
There are no unit tests, integration tests, or E2E tests for the centralized state management PR.

## Missing Test Scenarios
- Batch stats endpoint with invalid UUIDs
- Race conditions when switching tabs rapidly
- Stale data display while loading
- Error recovery flows
- Timezone edge cases
- Working day calculation accuracy
- Streak calculation edge cases (habit created today, yesterday, etc.)

## Recommendation
Add tests for at least:
1. \`lib/stats-utils.ts\` functions (pure, easy to test)
2. Batch stats endpoint with various inputs
3. Store state transitions

## Priority Breakdown
- **High Priority**: Unit tests for \`lib/stats-utils.ts\` and batch endpoint integration tests
- **Medium Priority**: Store tests for race conditions and error states
- **Nice to Have**: E2E tests for tab switching and idle behavior

## Related
From PR #2 review feedback"

gh issue create --title "Fix potential race condition in visibility change handler" --label "bug" --label "priority: medium" --body "## Problem
The \`refetchCurrentTab\` dependency array includes store fetch functions, which could cause stale closures or unnecessary re-renders.

## Location
\`app/page.tsx:56-70\`

## Current Implementation
\`\`\`typescript
const refetchCurrentTab = useCallback(() => {
  // ...
}, [activeTab, isAuthenticated, fetchHabits, fetchStats, fetchAllHabits, fetchDevices]);
\`\`\`

## Recommendation
Store functions from Zustand should be stable, but consider using a ref to store \`activeTab\` to avoid recreating the callback:

\`\`\`typescript
const activeTabRef = useRef(activeTab);
useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

const refetchCurrentTab = useCallback(() => {
  if (!isAuthenticated) return;
  switch (activeTabRef.current) {
    // ...
  }
}, [isAuthenticated, fetchHabits, fetchStats, fetchAllHabits, fetchDevices]);
\`\`\`

## Related
From PR #2 review feedback"

gh issue create --title "Add loading states for async operations in Settings" --label "enhancement" --label "priority: medium" --body "## Problem
When archiving/deleting/pausing a habit, there's no loading indicator. Users might double-click and trigger the operation twice.

## Solution
Add disabled states or loading spinners for in-flight operations.

## Related
From PR #2 review feedback"

# Low Priority Issues
echo "Creating low priority issues..."

gh issue create --title "Add error monitoring integration" --label "enhancement" --label "priority: low" --body "## Problem
Multiple places log errors but don't surface them to monitoring:
\`\`\`typescript
console.error('Batch stats error:', error);
\`\`\`

## Solution
Use a proper logging service (Sentry, Datadog, etc.) for production error tracking.

## Related
From PR #2 review feedback"

gh issue create --title "Cache working days calculation" --label "performance" --label "priority: low" --body "## Problem
The working days calculation creates dates for the last 90 days on every batch request. For large habit lists, this gets repeated.

## Location
\`app/api/stats/batch/route.ts:59-67\`

## Solution
Consider caching the working days calculation (maybe per-day granularity) or moving it to a helper that can be memoized.

## Related
From PR #2 review feedback"

gh issue create --title "Add audit logging" --label "security" --label "enhancement" --label "priority: low" --body "## Problem
No logging of sensitive operations (device removal, habit deletion).

## Solution
Add audit logging for:
- Device removal
- Habit deletion
- Account changes

## Related
From PR #2 review feedback"

gh issue create --title "Add E2E tests" --label "testing" --label "priority: low" --body "## Problem
No end-to-end tests for user workflows.

## Test Scenarios
- Tab switching preserves data
- Auto-refresh after idle
- Error recovery flows

## Related
From PR #2 review feedback"

gh issue create --title "Optimize Settings refetch behavior" --label "performance" --label "priority: low" --body "## Problem
Multiple handlers call \`await fetchAllHabits()\` after operations, but the stores already update locally. This causes unnecessary refetches.

## Locations
\`components/Settings.tsx:53, 60, 70\`

## Recommendation
Only refetch if the operation might fail partway or if you need server-side data. Consider optimistic updates.

## Related
From PR #2 review feedback"

gh issue create --title "Review Map usage in statsStore" --label "refactor" --label "priority: low" --body "## Problem
The \`habitStats\` is a Map, but Stats.tsx iterates with \`.get()\` repeatedly.

## Location
\`stores/statsStore.ts:40\`

## Consideration
This is fine for small datasets, but consider if Map is the right structure or if a plain object would be more ergonomic.

## Related
From PR #2 review feedback"

gh issue create --title "Fix useEffect dependency pattern" --label "refactor" --label "priority: low" --body "## Problem
\`\`\`typescript
useEffect(() => {
  fetchStats();
}, [fetchStats]);
\`\`\`

## Location
\`components/Stats.tsx:10-13\`

## Solution
Zustand functions should be stable, but eslint might complain. Consider:
\`\`\`typescript
useEffect(() => {
  fetchStats();
}, []); // fetchStats is stable from Zustand
\`\`\`

Or destructure outside the component if needed.

## Related
From PR #2 review feedback"

gh issue create --title "Verify SQL injection safety with ANY(\$1) usage" --label "security" --label "priority: low" --body "## Context
While using parameterized queries (\`\$1\`, \`\$2\`) correctly prevents SQL injection, the \`ANY(\$1)\` usage with arrays should be verified by your DB library for proper escaping.

## Status
Likely safe if using \`pg\` or similar, but worth verifying.

## Action
Verify that the database library properly escapes array parameters in \`ANY(\$1)\` queries.

## Related
From PR #2 review feedback"

echo ""
echo "✅ All 15 issues created successfully!"
echo ""
echo "Summary:"
echo "  - 3 High Priority issues"
echo "  - 4 Medium Priority issues"
echo "  - 8 Low Priority issues"
