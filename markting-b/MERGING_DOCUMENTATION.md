# Enhanced Merging Functionality Documentation

## Overview

This document describes the enhanced merging functionality that allows users to merge duplicate contacts in HubSpot. The system supports both single contact merges and batch merges, tracks all merge operations in a dedicated database table, and provides comprehensive endpoints for managing contact merges from both direct selection and dialog interfaces.

## Key Features

### ✅ Single Contact Merge

- Merge two contacts at a time
- Used for direct merges from contact selection
- Tracks primary and secondary contact relationships

### ✅ Batch Contact Merge

- Merge multiple contacts into one primary contact
- Used when merging from dialog/modal interfaces
- Processes multiple secondary contacts sequentially
- Provides detailed success/failure reporting

### ✅ Dialog Integration

- Seamlessly handles merges from modal dialogs
- Automatically detects single vs. batch merge scenarios
- Maintains existing UI workflow while using new backend

## Database Schema

### Merging Table

The `merging` table stores information about contact merge operations:

```sql
CREATE TABLE merging (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    group_id INTEGER NOT NULL,
    primary_account_id VARCHAR(255) NOT NULL,
    secondary_account_id VARCHAR(255) NOT NULL,
    merge_status VARCHAR(50) DEFAULT 'pending',
    merged_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_group (user_id, group_id),
    INDEX idx_merge_status (merge_status),
    INDEX idx_created_at (created_at)
);
```

#### Table Fields:

- `id`: Primary key
- `user_id`: ID of the user performing the merge
- `api_key`: HubSpot API key used for the operation
- `group_id`: ID of the duplicate group being merged
- `primary_account_id`: HubSpot ID of the contact that will be kept
- `secondary_account_id`: HubSpot ID of the contact that will be merged/removed
- `merge_status`: Status of the merge operation (`pending`, `completed`, `failed`, `reset`)
- `merged_at`: Timestamp when the merge was completed
- `created_at`: Timestamp when the record was created
- `updated_at`: Timestamp when the record was last updated

## API Endpoints

### 1. Single Contact Merge

**Endpoint:** `POST /hubspot/merge-contacts`
**Authentication:** Required (JWT)

Merges two contacts from a duplicate group.

#### Request Body:

```typescript
{
  "groupId": number,
  "primaryAccountId": string,    // HubSpot ID of contact to keep
  "secondaryAccountId": string,  // HubSpot ID of contact to merge
  "apiKey": string
}
```

#### Response:

```typescript
{
  "success": boolean,
  "message": string,
  "mergeId": number,
  "primaryAccountId": string,
  "secondaryAccountId": string
}
```

### 2. Batch Contact Merge

**Endpoint:** `POST /hubspot/batch-merge-contacts`
**Authentication:** Required (JWT)

Merges multiple contacts into one primary contact.

#### Request Body:

```typescript
{
  "groupId": number,
  "primaryAccountId": string,      // HubSpot ID of contact to keep
  "secondaryAccountIds": string[], // Array of HubSpot IDs to merge
  "apiKey": string
}
```

#### Response:

```typescript
{
  "success": boolean,
  "message": string,
  "primaryAccountId": string,
  "results": [
    {
      "secondaryAccountId": string,
      "success": boolean,
      "mergeId": number
    }
  ],
  "errors": [
    {
      "secondaryAccountId": string,
      "success": false,
      "error": string
    }
  ]
}
```

### 3. Get Merge History

**Endpoint:** `GET /merging/history`
**Authentication:** Required (JWT)

Retrieves the merge history for the authenticated user.

#### Query Parameters:

- `apiKey` (optional): Filter by specific API key

#### Response:

```typescript
[
  {
    id: number,
    userId: number,
    apiKey: string,
    groupId: number,
    primaryAccountId: string,
    secondaryAccountId: string,
    mergeStatus: string,
    mergedAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  },
];
```

### 3. Get Merge by ID

**Endpoint:** `GET /merging/:mergeId`
**Authentication:** Required (JWT)

Retrieves details of a specific merge operation.

#### Response:

```typescript
{
  "id": number,
  "userId": number,
  "apiKey": string,
  "groupId": number,
  "primaryAccountId": string,
  "secondaryAccountId": string,
  "mergeStatus": string,
  "mergedAt": Date | null,
  "createdAt": Date,
  "updatedAt": Date
}
```

### 4. Reset Merge

**Endpoint:** `PUT /merging/:mergeId/reset`
**Authentication:** Required (JWT)

Resets a completed merge operation.

#### Response:

```typescript
{
  "success": boolean,
  "message": string,
  "mergeId": number
}
```

## Frontend Integration

### Updated useRequest Hook

The `useRequest` hook now includes both merge methods:

```typescript
const { mergeContacts, batchMergeContacts } = useRequest();

// Single contact merge
const handleSingleMerge = async (groupId, primaryId, secondaryId, apiKey) => {
  try {
    const result = await mergeContacts({
      groupId,
      primaryAccountId: primaryId,
      secondaryAccountId: secondaryId,
      apiKey,
    });
    console.log('Single merge successful:', result);
  } catch (error) {
    console.error('Single merge failed:', error);
  }
};

// Batch contact merge
const handleBatchMerge = async (groupId, primaryId, secondaryIds, apiKey) => {
  try {
    const result = await batchMergeContacts({
      groupId,
      primaryAccountId: primaryId,
      secondaryAccountIds: secondaryIds,
      apiKey,
    });
    console.log('Batch merge successful:', result);
  } catch (error) {
    console.error('Batch merge failed:', error);
  }
};
```

### Enhanced Duplicates Page

The duplicates page now intelligently handles both scenarios:

#### Direct Contact Merge (2 contacts)

```typescript
const handleDirectMerge = async (group, selectedContact, removedContact) => {
  const mergeData = {
    groupId: group.id,
    primaryAccountId: selectedContact.hubspotId,
    secondaryAccountId: removedContact.hubspotId,
    apiKey,
  };

  const result = await mergeContacts(mergeData);
  // Handle success...
};
```

#### Dialog/Modal Merge (Enhanced)

```typescript
const handleMergeSubmit = async (mergeData) => {
  // Single contact removal - use new merge endpoint
  if (mergeData.removedIds.length === 1) {
    const removedContact = mergeData.allContactsData.find((c) =>
      mergeData.removedIds.includes(c.id),
    );

    const result = await mergeContacts({
      groupId: mergeData.groupId,
      primaryAccountId: mergeData.selectedContactHubspotId,
      secondaryAccountId: removedContact.hubspotId,
      apiKey,
    });
  }

  // Multiple contacts - use batch merge endpoint
  else if (mergeData.removedIds.length > 1) {
    const removedContacts = mergeData.allContactsData.filter((c) =>
      mergeData.removedIds.includes(c.id),
    );

    const result = await batchMergeContacts({
      groupId: mergeData.groupId,
      primaryAccountId: mergeData.selectedContactHubspotId,
      secondaryAccountIds: removedContacts.map((c) => c.hubspotId),
      apiKey,
    });
  }

  // Fallback to old endpoint for compatibility
  else {
    const result = await submitMerge({ ...mergeData, apiKey });
  }
};
```

## Migration Instructions

1. Run the migration to create the merging table:

```sql
-- Execute the migration script
-- File: migrations/create-merging-table.sql
```

2. Restart the application to load the new modules and entities.

## Service Architecture

### MergingService

- `mergeContacts()`: Main method to merge two contacts
- `batchMergeContacts()`: NEW - Method to merge multiple contacts into one
- `getMergeHistory()`: Retrieve merge history for a user
- `getMergeById()`: Get details of a specific merge
- `resetMerge()`: Reset a completed merge
- `performActualMerge()`: Private method handling the actual merge logic

### MergingController

Provides REST endpoints for merge operations with JWT authentication:

- `POST /merging/merge` - Single contact merge
- `POST /merging/batch-merge` - Batch contact merge
- `GET /merging/history` - Get merge history
- `GET /merging/:mergeId` - Get specific merge details
- `PUT /merging/:mergeId/reset` - Reset a merge

### HubSpotController (Enhanced)

Added merge endpoints to the main HubSpot controller:

- `POST /hubspot/merge-contacts` - Single contact merge
- `POST /hubspot/batch-merge-contacts` - Batch contact merge

### MergingModule

NestJS module that exports the MergingService and configures TypeORM entities.

## Frontend Integration Scenarios

### Scenario 1: Direct Contact Selection (2 contacts)

- User clicks on a contact in a 2-contact group
- Contact is highlighted as selected
- User clicks "Merge Selected" button
- **Uses:** `mergeContacts()` endpoint
- **Result:** Single merge record created

### Scenario 2: Dialog Merge - Single Contact

- User opens merge dialog for a group
- User selects primary contact and marks 1 secondary for removal
- User submits the merge
- **Uses:** `mergeContacts()` endpoint
- **Result:** Single merge record created

### Scenario 3: Dialog Merge - Multiple Contacts

- User opens merge dialog for a group
- User selects primary contact and marks multiple contacts for removal
- User submits the merge
- **Uses:** `batchMergeContacts()` endpoint
- **Result:** Multiple merge records created (one per secondary contact)

### Scenario 4: Fallback Compatibility

- For edge cases or compatibility with existing workflows
- **Uses:** Original `submitMerge()` endpoint
- **Result:** Uses existing merge logic

## Error Handling

The service includes comprehensive error handling:

- Validates user existence
- Validates contact existence and ownership
- Prevents duplicate merge operations
- Updates merge status on failure
- Provides detailed error messages

## Future Enhancements

1. **HubSpot API Integration**: Implement actual HubSpot API calls for contact merging
2. **Batch Operations**: Support merging multiple contact pairs at once
3. **Merge Conflict Resolution**: Advanced logic for handling conflicting contact data
4. **Audit Trail**: More detailed logging of merge operations
5. **Rollback Functionality**: Ability to completely undo merge operations
