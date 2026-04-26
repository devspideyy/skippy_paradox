# Visual Guide - New Features

## 🎨 DotField Interactive Background

### What You'll See

When you open CodeCollab without any files, you'll now see:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    · · · · · · · · · · · · · · · · · · · · · · ·      │
│    · · · · · · · · · · · · · · · · · · · · · · ·      │
│    · · · · · · · · · · · · · · · · · · · · · · ·      │
│    · · · · · · · · ○ ○ ○ · · · · · · · · · · ·      │  ← Dots bulge away
│    · · · · · · · ○ ○ ○ ○ ○ · · · · · · · · ·      │    from cursor
│    · · · · · · · ○ ○ 🖱️ ○ ○ · · · · · · · · ·      │
│    · · · · · · · ○ ○ ○ ○ ○ · · · · · · · · ·      │
│    · · · · · · · · ○ ○ ○ · · · · · · · · · · ·      │
│    · · · · · · · · · · · · · · · · · · · · · · ·      │
│    · · · · · · · · · · · · · · · · · · · · · · ·      │
│                                                         │
│                  📁 Welcome to CodeCollab               │
│                                                         │
│                  [➕ New Snippet]                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Interactive Features

1. **Mouse Movement**: Dots smoothly move away from your cursor
2. **Sparkle Effect**: Random dots occasionally grow larger
3. **Gradient Colors**: Purple gradient matching CodeCollab theme
4. **Glow Effect**: Subtle glow follows your cursor
5. **Theme Aware**: Colors change with dark/light mode

### Color Scheme

**Dark Mode:**
- Dots: Purple gradient (rgba(202, 164, 247, 0.25) → rgba(139, 92, 246, 0.15))
- Background: Dark (#1E1E2A)
- Glow: Dark purple

**Light Mode:**
- Dots: Purple gradient (rgba(136, 57, 239, 0.20) → rgba(168, 85, 247, 0.15))
- Background: Light (#E5E8EE)
- Glow: Light purple

---

## 🔑 API Key Rotation Dashboard

### Gemini Panel Header

When using pre-configured API keys, you'll see:

```
┌─────────────────────────────────────────────────────────┐
│ ✨ GEMINI AI                                    🗑️ ⚙️   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ API KEY ROTATION                           [Reset]     │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│ │Key 1 │ │Key 2 │ │Key 3 │ │Key 4 │                   │
│ │23/50 │ │ 0/50 │ │ 0/50 │ │ 0/50 │                   │
│ └──────┘ └──────┘ └──────┘ └──────┘                   │
│   ↑ Current                                            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ QUICK ACTIONS                                          │
│ [Explain] [Fix bugs] [Optimise] [Add types]           │
│ [Write tests] [Refactor]                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💬 Chat messages appear here...                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Indicators

**Active Key** (highlighted in purple):
```
┌──────────────┐
│   Key 1      │  ← Purple border & background
│   23/50      │  ← Purple text
└──────────────┘
```

**Inactive Keys** (gray):
```
┌──────────────┐
│   Key 2      │  ← Gray background
│    0/50      │  ← Gray text
└──────────────┘
```

### Usage Counter

- **Format**: `X/50` where X is requests used
- **Color**: Purple for active, gray for inactive
- **Updates**: Real-time after each request

### Rotation Behavior

```
Request 1-50:   Key 1 (23/50) ← Active
Request 51:     Key 2 ( 0/50) ← Rotates automatically
Request 52-100: Key 2 (49/50) ← Active
Request 101:    Key 3 ( 0/50) ← Rotates automatically
...and so on
```

---

## 🎯 User Interactions

### DotField

**Desktop:**
1. Move mouse over welcome screen
2. Watch dots respond in real-time
3. Faster movement = stronger effect
4. Dots smoothly return to position

**Mobile:**
1. Same visual effect
2. No interaction (no mouse)
3. Static but still beautiful

### API Rotation

**Automatic:**
- System handles everything
- No user action needed
- Transparent rotation

**Manual:**
1. Click "Reset" button to clear counters
2. Useful for daily resets
3. Starts fresh from Key 1

---

## 📱 Responsive Design

### Desktop (>768px)
```
┌─────────────────────────────────────────────────────────┐
│ [Files]  [Editor with DotField]  [Gemini with Rotation] │
└─────────────────────────────────────────────────────────┘
```

### Mobile (<768px)
```
┌─────────────────┐
│ [Editor with    │
│  DotField]      │
│                 │
│ [Gemini with    │
│  Rotation]      │
└─────────────────┘
```

---

## 🎨 Theme Switching

### Dark Mode → Light Mode

**DotField:**
- Dots: Purple (dark) → Purple (light)
- Background: Dark → Light
- Glow: Dark → Light
- Transition: Smooth

**API Dashboard:**
- Background: Dark gray → Light gray
- Text: Light → Dark
- Borders: Dark → Light
- Active key: Purple (consistent)

---

## 💡 Tips

### For Best DotField Experience:
1. Use a mouse (not trackpad) for best effect
2. Move cursor in circular motions
3. Try different speeds
4. Watch for sparkle effects

### For API Key Management:
1. Check usage regularly
2. Reset daily for fresh start
3. Monitor which keys are used most
4. Add more keys if needed

---

## 🔍 Troubleshooting

### DotField Not Visible?
- ✅ Close all files to see welcome screen
- ✅ Check browser supports Canvas API
- ✅ Try refreshing the page

### API Keys Not Rotating?
- ✅ Check browser console for logs
- ✅ Verify .env file has keys
- ✅ Try clicking Reset button
- ✅ Clear localStorage and refresh

### Performance Issues?
- ✅ DotField uses Canvas (very efficient)
- ✅ Should run at 60fps
- ✅ If slow, check browser performance

---

**Last Updated**: April 27, 2026  
**Version**: 1.0.0
