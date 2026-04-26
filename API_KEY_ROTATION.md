# Gemini API Key Rotation System

## Overview
This system automatically rotates between multiple Gemini API keys to prevent exhausting free tier limits. It tracks usage per key and switches to the next available key when a limit is reached.

## Features
- ✅ **Automatic Rotation**: Switches keys when usage limit is reached (50 requests per key)
- ✅ **Usage Tracking**: Monitors how many requests each key has handled
- ✅ **Smart Selection**: Always picks the key with lowest usage
- ✅ **Visual Dashboard**: Shows current key and usage stats in the UI
- ✅ **Persistent State**: Saves rotation state to localStorage
- ✅ **Manual Reset**: Reset all counters when needed

## Configuration

### Environment Variables
Add your API keys to `.env` file (comma-separated):

```env
VITE_GEMINI_API_KEYS=AIzaSyCDTqASS6n1HjtlYwjvMTDGWrd2WggyNN4,AIzaSyBTNGhZSknGm-8Ha3bhjRvIFg-JweE3JnU,AIzaSyBGqYz9Ex_AFvNZu2vUiIytXw_3pCWYfdg,AIzaSyD4pYr1QZUsOTeansS5nWEF0bP6F-WvoG8
```

### Current Keys Configured
- **Key 1**: AIzaSyCDTqASS6n1HjtlYwjvMTDGWrd2WggyNN4
- **Key 2**: AIzaSyBTNGhZSknGm-8Ha3bhjRvIFg-JweE3JnU
- **Key 3**: AIzaSyBGqYz9Ex_AFvNZu2vUiIytXw_3pCWYfdg
- **Key 4**: AIzaSyD4pYr1QZUsOTeansS5nWEF0bP6F-WvoG8

## How It Works

### 1. Key Selection
- On each request, the system checks the current key's usage count
- If usage >= 50 requests, it rotates to the next key
- Always selects the key with the lowest usage count

### 2. Usage Tracking
- Each successful API call increments the usage counter
- Counters are stored in localStorage: `gemini-key-rotation-state`
- State includes: current key index, usage counts, last rotation timestamp

### 3. Rotation Logic
```typescript
// Pseudo-code
if (currentKeyUsage >= 50) {
  findKeyWithLowestUsage()
  switchToThatKey()
}
```

### 4. User Override
Users can still provide their own API key, which takes precedence over the rotation system.

## UI Features

### Key Rotation Dashboard
When using pre-configured keys, the Gemini panel shows:
- Current active key (highlighted in purple)
- Usage count for each key (e.g., "23/50")
- Reset button to clear all counters

### Manual Reset
Click the "Reset" button in the dashboard to:
- Clear all usage counters
- Reset to Key 1
- Start fresh tracking

## Usage Limits

### Free Tier Limits (Gemini API)
- **Requests per minute**: 15
- **Requests per day**: 1,500
- **Tokens per minute**: 1,000,000

### Our Rotation Settings
- **Requests per key before rotation**: 50
- **Total capacity with 4 keys**: 200 requests before cycling back
- **Recommended daily reset**: Once per day to stay within limits

## Best Practices

1. **Daily Reset**: Reset counters once per day to align with API quotas
2. **Monitor Usage**: Check the dashboard regularly to see which keys are being used
3. **Add More Keys**: If you need more capacity, add additional keys to the `.env` file
4. **Backup Keys**: Keep a few extra keys in reserve for high-traffic periods

## Troubleshooting

### "API error 429" (Rate Limit)
- All keys may be exhausted
- Click "Reset" to clear counters
- Wait a few minutes before retrying
- Consider adding more keys

### Keys Not Rotating
- Check browser console for errors
- Verify `.env` file has correct format (comma-separated, no spaces)
- Clear localStorage and refresh: `localStorage.clear()`

### Usage Not Tracking
- Ensure you're not using a custom user-provided key
- Check that rotation service is initialized: Open browser console and type `geminiKeyRotation.getUsageStats()`

## Technical Details

### Files Modified
- `frontend/.env` - Added VITE_GEMINI_API_KEYS
- `frontend/.env.example` - Added example configuration
- `frontend/src/services/geminiKeyRotation.ts` - New rotation service
- `frontend/src/components/GeminiPanel.tsx` - Integrated rotation logic

### Storage Schema
```typescript
interface KeyRotationState {
  currentIndex: number;           // Index of current key (0-3)
  usageCounts: Record<number, number>; // Usage per key
  lastRotation: number;           // Timestamp of last rotation
}
```

### API Integration
```typescript
// Get current key
const key = geminiKeyRotation.getCurrentKey();

// Make API call
await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, ...);

// Record usage
geminiKeyRotation.recordUsage();
```

## Future Enhancements

Potential improvements:
- [ ] Time-based rotation (rotate every hour)
- [ ] Error-based rotation (switch on 429 errors)
- [ ] Cloud-based key management
- [ ] Analytics dashboard with charts
- [ ] Email alerts when keys are exhausted
- [ ] Automatic daily reset at midnight

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify API keys are valid at [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Test individual keys manually
4. Clear localStorage and restart

---

**Last Updated**: April 27, 2026
**Version**: 1.0.0
