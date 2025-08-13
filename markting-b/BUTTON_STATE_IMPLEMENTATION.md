# Button State Change Implementation

## Overview

This document describes the implementation of the button state change functionality, where the merge button changes to a reset button after a successful merge operation.

## How It Works

### 1. **Database Tracking**

- The `matching` table has a `merged` column (boolean) that tracks the merge status of each duplicate group
- When a merge is completed, the group is marked as `merged: true`
- When a merge is reset, the group is marked as `merged: false`

### 2. **Backend Logic**

#### Merge Operations

```typescript
// In MergingService.mergeContacts()
// After successful merge:
await this.markGroupAsMerged(userId, groupId, apiKey);

// This updates the matching table:
matchingGroup.merged = true;
await this.matchingRepository.save(matchingGroup);
```

#### Reset Operations

```typescript
// In MergingService.resetMergeByGroup()
// After successful reset:
await this.markGroupAsUnmerged(userId, groupId, apiKey);

// This updates the matching table:
matchingGroup.merged = false;
await this.matchingRepository.save(matchingGroup);
```

### 3. **Frontend UI Logic**

#### Button Display Logic (Already Implemented)

```tsx
{
  duplicateGroup.merged ? (
    // Show Reset Button
    <button onClick={() => onResetClick(duplicateGroup)}>Reset Merge</button>
  ) : (
    // Show Merge Button
    <button onClick={() => onMergeClick(duplicateGroup)}>Merge Selected</button>
  );
}
```

#### Automatic Data Refresh

- After every merge operation: `await fetchDuplicates(currentPage);`
- After every reset operation: `await fetchDuplicates(currentPage);`
- This ensures the UI reflects the latest merge status

## API Endpoints

### New Reset Endpoint

```
PUT /hubspot/reset-merge-group
Body: { groupId: number, apiKey: string }
```

### Enhanced Merge Endpoints

- `POST /hubspot/merge-contacts` - Now marks group as merged
- `POST /hubspot/batch-merge-contacts` - Now marks group as merged

## User Experience Flow

### Scenario 1: Initial State

1. User sees duplicate group with "Select & Merge" or "Merge Selected" button
2. Group status: `merged: false`

### Scenario 2: After Merge

1. User clicks merge button
2. Backend processes merge and marks group as merged
3. Frontend refreshes data
4. User now sees "Reset Merge" button
5. Group status: `merged: true`

### Scenario 3: After Reset

1. User clicks "Reset Merge" button
2. Backend resets all merges for the group and marks as unmerged
3. Frontend refreshes data
4. User sees original merge button again
5. Group status: `merged: false`

## Technical Implementation Details

### Service Methods Added

- `markGroupAsMerged(userId, groupId, apiKey)` - Private method
- `markGroupAsUnmerged(userId, groupId, apiKey)` - Private method
- `resetMergeByGroup(userId, groupId, apiKey)` - Public method

### Controller Endpoints Added

- `PUT /merging/group/:groupId/reset` - Direct service access
- `PUT /hubspot/reset-merge-group` - Through HubSpot controller

### Frontend Methods Updated

- `handleDirectMerge()` - Now refreshes data after merge
- `handleMergeSubmit()` - Now refreshes data after merge
- `handleResetClick()` - Now uses new reset endpoint

## Error Handling

- Merge operations that fail don't mark groups as merged
- Reset operations only work on completed merges
- UI refresh happens regardless of success/failure for accurate state

## Benefits

1. **Clear Visual Feedback** - Users immediately see merge status
2. **Persistent State** - Merge status survives page refreshes
3. **Audit Trail** - All merge/reset operations are tracked
4. **Undo Capability** - Users can easily reverse merge operations
5. **Consistent UX** - Same behavior across all merge scenarios
