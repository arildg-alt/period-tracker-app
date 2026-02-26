# Private Period Tracker (iPhone-friendly)

A simple, private period tracking web app that works offline after first load.

## What this app does

- Add period start and end dates
- Save period history with optional notes/symptoms
- Calculate your average cycle length
- Predict your next period start date (simple estimate)
- Show a month calendar highlighting logged period days
- Export your data as JSON
- Import your data from JSON
- Delete all data with confirmation

## Privacy

- Your data is stored **only in your browser** using local storage.
- No login, no account, no cloud backend, no analytics, no tracking.

## Important note

Predictions in this app are rough estimates and are **NOT medical advice** and **NOT contraception**.

## How to use (non-technical)

1. Open the app in Safari on your iPhone.
2. Enter your period start date and end date.
3. (Optional) add notes/symptoms and tap **Save Entry**.
4. Check the **Cycle Summary** for average cycle and estimated next start.
5. Browse the **Calendar View** to see highlighted logged period days.
6. Use **Export Data (JSON)** to save a backup file.
7. Use **Import Data (JSON)** to restore from a backup.
8. Use **Delete All Data** only if you want to remove everything from this device.

## Install on iPhone (PWA-like shortcut)

1. Open the app URL in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Launch it from your home screen.

## Offline support

After the first successful load, the app uses a service worker cache so it can run offline.

## Limitations

- Data can be lost if browser storage is cleared.
- Predictions are simple and may be inaccurate for irregular cycles.
- This tool is for personal tracking only and not for diagnosis or treatment.
