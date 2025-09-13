# Manual Test: Verify Sunday Events are Included

1. **Create a Sunday Event**
   - Sign in to the application and ensure Google Calendar access is granted.
   - Create an event that occurs on **Sunday** within a week you will test.

2. **Trigger Event Sync**
   - Navigate to the feature that synchronises your timetable with Google Calendar.
   - Choose the week that includes the created Sunday event.
   - Run the sync or refresh logic that calls `listEvents`.

3. **Verify Retrieval**
   - Inspect the application logs or UI to confirm that the Sunday event appears in the listed results.
   - The updated `timeMax` now uses next Monday 00:00, so events on Sunday should be returned.

4. **Optional**
   - Repeat the test with events on other days to ensure behaviour remains unchanged for weekday events.

