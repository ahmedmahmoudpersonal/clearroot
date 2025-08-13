# HubSpot API Error Handling and Auto-Retry Improvements

## Overview

This document outlines the improvements made to the HubSpot integration to handle API errors gracefully and automatically retry failed operations.

## Issues Addressed

### 1. **Poor Error Handling**

- **Problem**: When HubSpot API requests failed, the action status was incorrectly set to `FINISHED` instead of indicating an error.
- **Solution**: Added new action statuses (`ERROR`, `RETRYING`) and proper error handling.

### 2. **No Retry Mechanism**

- **Problem**: Failed API requests would not be retried, leading to permanent failures for transient issues.
- **Solution**: Implemented exponential backoff retry mechanism with configurable attempts.

### 3. **No Automatic Recovery**

- **Problem**: Failed actions required manual intervention to restart.
- **Solution**: Added automatic retry system that runs every 5 minutes to detect and retry failed actions.

## New Features

### 1. Enhanced Action Status Enum

```typescript
export enum ActionStatus {
  START = 'start',
  FETCHING = 'fetching',
  FILTERING = 'filtering',
  MANUALLY_MERGE = 'manually_merge',
  UPDATE_HUBSPOT = 'update_hubspot',
  FINISHED = 'finished',
  ERROR = 'error', // NEW: Indicates action failed
  RETRYING = 'retrying', // NEW: Indicates action is being retried
}
```

### 2. API Request Retry Mechanism

- **Method**: `makeHubSpotAPIRequest()`
- **Features**:
  - Configurable retry attempts (default: 3)
  - Exponential backoff (5s, 10s, 20s)
  - Detailed logging of retry attempts
  - Proper error propagation

### 3. Failed Action Retry System

- **Manual Retry**: `POST /hubspot/actions/:actionId/retry`
- **Automatic Retry**: Cron job runs every 5 minutes
- **Bulk Auto-Retry**: `POST /hubspot/actions/auto-retry`

### 4. Improved Error Handling

- Actions in error state are properly marked with `ERROR` status
- Detailed error logging with context
- Graceful degradation for API failures

## API Endpoints

### Manual Retry Single Action

```http
POST /hubspot/actions/:actionId/retry
```

**Response**:

```json
{
  "message": "Action retry started successfully. This process will run in the background.",
  "action": { ... }
}
```

### Trigger Auto-Retry for All Failed Actions

```http
POST /hubspot/actions/auto-retry
```

**Response**:

```json
{
  "message": "Auto-retry process completed successfully"
}
```

## Configuration

### Retry Settings

The retry mechanism can be configured by modifying the `makeHubSpotAPIRequest` method parameters:

- `maxRetries`: Number of retry attempts (default: 3)
- `retryDelay`: Initial delay between retries in milliseconds (default: 5000)

### Cron Schedule

The automatic retry process runs every 5 minutes. To change this, modify the `@Cron` decorator:

```typescript
@Cron(CronExpression.EVERY_5_MINUTES) // Change as needed
```

## Monitoring and Logging

### Log Messages to Watch For

- `"API request attempt X/Y"` - Retry attempts
- `"Retrying in Xms..."` - Retry delays
- `"Auto-retrying action X"` - Automatic retry triggers
- `"Found X failed actions to retry"` - Auto-retry discovery

### Action Status Monitoring

Monitor action statuses to identify patterns:

- `ERROR`: Actions that have failed and need attention
- `RETRYING`: Actions currently being retried
- `FINISHED`: Successfully completed actions

## Deployment Notes

### Dependencies Added

- `@nestjs/schedule`: For cron job functionality

### Database Changes

- No schema changes required
- New enum values are backward compatible

### Configuration Changes

- Added `ScheduleModule.forRoot()` to `AppModule`
- Added cron import in `HubSpotService`

## Testing the Implementation

### 1. Test Manual Retry

```bash
# First, get a failed action ID
GET /hubspot/actions

# Then retry it
POST /hubspot/actions/{actionId}/retry
```

### 2. Test Auto-Retry

```bash
# Trigger manual auto-retry
POST /hubspot/actions/auto-retry
```

### 3. Monitor Automatic Process

- Check logs every 5 minutes for auto-retry activity
- Monitor action statuses for automatic state changes

## Troubleshooting

### Common Issues

1. **Cron Not Running**: Ensure `ScheduleModule` is properly imported in `AppModule`
2. **Retry Loop**: Check for persistent API issues that cause infinite retry cycles
3. **Database Locks**: Monitor for database connection issues during batch operations

### Recovery Steps

1. Check action statuses: `GET /hubspot/actions`
2. Review error logs for specific failure reasons
3. Use manual retry for critical actions
4. Monitor auto-retry process effectiveness

## Future Enhancements

### Potential Improvements

1. **Rate Limiting**: Implement request rate limiting to prevent API quota exhaustion
2. **Circuit Breaker**: Add circuit breaker pattern for consistent API failures
3. **Retry Policies**: Different retry strategies for different error types
4. **Notification System**: Alert administrators of persistent failures
5. **Metrics Dashboard**: Visual monitoring of success/failure rates
