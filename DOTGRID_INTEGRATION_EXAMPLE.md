# DotGrid Integration Example

## Quick Start

The DotGrid component has been successfully installed in your CodeCollab project!

### Files Created:
- ✅ `frontend/src/components/DotGrid.tsx` - Main component
- ✅ `frontend/src/components/DotGrid.css` - Styles
- ✅ `frontend/src/components/DotGridExample.tsx` - Example implementations
- ✅ `DOTGRID_USAGE.md` - Complete documentation
- ✅ `gsap` package installed

## How to Use in Your EditorView

### Option 1: Replace DotField with DotGrid

In `EditorView.tsx`, replace the DotField import and usage:

```tsx
// Change this:
import DotField from './DotField';

// To this:
import DotGrid from './DotGrid';

// Then in the empty state, replace:
<DotField
  dotRadius={2}
  dotSpacing={14}
  bulgeStrength={80}
  glowRadius={200}
  sparkle={true}
  waveAmplitude={0}
  gradientFrom={isDark ? 'rgba(202, 164, 247, 0.45)' : 'rgba(136, 57, 239, 0.35)'}
  gradientTo={isDark ? 'rgba(139, 92, 246, 0.30)' : 'rgba(168, 85, 247, 0.25)'}
  glowColor={isDark ? '#1E1E2A' : '#E5E8EE'}
/>

// With this:
<DotGrid
  dotSize={4}
  gap={14}
  baseColor={isDark ? '#232332' : '#EEF1F5'}
  activeColor={isDark ? '#CAA4F7' : '#9B6DD7'}
  proximity={120}
  shockRadius={250}
  shockStrength={5}
  resistance={750}
  returnDuration={1.5}
/>
```

### Option 2: Use Both (User Preference)

Add a state to toggle between effects:

```tsx
const [backgroundEffect, setBackgroundEffect] = useState<'dotfield' | 'dotgrid'>('dotfield');

// In your empty state:
<div className="absolute inset-0 z-0">
  {backgroundEffect === 'dotfield' ? (
    <DotField {...dotFieldProps} />
  ) : (
    <DotGrid {...dotGridProps} />
  )}
</div>

// Add a toggle button in settings
<button onClick={() => setBackgroundEffect(prev => prev === 'dotfield' ? 'dotgrid' : 'dotfield')}>
  Toggle Background Effect
</button>
```

### Option 3: Use in Different Sections

Use DotGrid for specific pages or modals:

```tsx
// In a landing page or modal
<div className="relative min-h-screen">
  <div className="absolute inset-0">
    <DotGrid
      dotSize={5}
      gap={15}
      baseColor={isDark ? '#2F293A' : '#E5E8EE'}
      activeColor={isDark ? '#5227FF' : '#8B39EF'}
      proximity={120}
    />
  </div>
  
  <div className="relative z-10">
    {/* Your content */}
  </div>
</div>
```

## Recommended Settings for CodeCollab

### For Empty State (Subtle)
```tsx
<DotGrid
  dotSize={3}
  gap={14}
  baseColor={isDark ? '#232332' : '#EEF1F5'}
  activeColor={isDark ? '#8B5CF6' : '#7C3AED'}
  proximity={100}
  shockRadius={200}
  shockStrength={4}
  resistance={800}
  returnDuration={1.5}
/>
```

### For Hero Section (Bold)
```tsx
<DotGrid
  dotSize={6}
  gap={18}
  baseColor={isDark ? '#1E1E2A' : '#E5E8EE'}
  activeColor={isDark ? '#CAA4F7' : '#9B6DD7'}
  proximity={180}
  shockRadius={300}
  shockStrength={8}
  resistance={600}
  returnDuration={2}
/>
```

### For Background Layer (Minimal)
```tsx
<DotGrid
  dotSize={2}
  gap={16}
  baseColor={isDark ? '#181821' : '#F0F0F0'}
  activeColor={isDark ? '#5227FF' : '#8B39EF'}
  proximity={80}
  shockRadius={150}
  shockStrength={3}
  resistance={900}
  returnDuration={1}
/>
```

## Testing the Component

1. **Start your dev server:**
   ```bash
   cd Code_CollabV2/frontend
   npm run dev
   ```

2. **View the examples:**
   - Import and render `DotGridExample` component to see all variations
   - Or integrate directly into EditorView as shown above

3. **Interact with it:**
   - Move your mouse over the dots to see color transitions
   - Move quickly to trigger the push effect
   - Click anywhere to create a shock wave effect

## Customization Tips

### Match Your Brand Colors
```tsx
<DotGrid
  baseColor="#1E1E2A"      // Your dark background
  activeColor="#CAA4F7"    // Your purple accent
  proximity={120}
/>
```

### Adjust Responsiveness
```tsx
<DotGrid
  speedTrigger={80}        // Lower = more sensitive to movement
  shockStrength={10}       // Higher = stronger click effect
  resistance={500}         // Lower = faster movement
  returnDuration={2.5}     // Higher = slower return
/>
```

### Performance Tuning
```tsx
<DotGrid
  dotSize={2}              // Smaller dots = better performance
  gap={20}                 // Larger gap = fewer dots = better performance
/>
```

## Next Steps

1. ✅ Component installed and ready to use
2. 📖 Read `DOTGRID_USAGE.md` for complete API documentation
3. 🎨 Check `DotGridExample.tsx` for implementation examples
4. 🔧 Customize the props to match your design
5. 🚀 Deploy and enjoy the interactive background!

## Need Help?

- Check the console for any GSAP-related errors
- Ensure parent container has explicit dimensions
- Verify colors are valid hex values
- See troubleshooting section in `DOTGRID_USAGE.md`

Happy coding! 🎉
