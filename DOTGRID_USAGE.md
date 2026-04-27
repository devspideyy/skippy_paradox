# DotGrid Component Usage Guide

## Overview

The `DotGrid` component creates an interactive canvas-based dot grid that responds to mouse movements and clicks with physics-based animations. It uses GSAP's InertiaPlugin for smooth, natural motion effects.

## Installation

The component has been installed in your project at:
- `frontend/src/components/DotGrid.tsx`
- `frontend/src/components/DotGrid.css`

**Dependencies:**
- `gsap` - Already installed via npm

## Basic Usage

```tsx
import DotGrid from './components/DotGrid';

function MyComponent() {
  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
      <DotGrid
        dotSize={5}
        gap={15}
        baseColor="#2F293A"
        activeColor="#5227FF"
        proximity={120}
        shockRadius={250}
        shockStrength={5}
        resistance={750}
        returnDuration={1.5}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dotSize` | number | 16 | Diameter of each dot in pixels |
| `gap` | number | 32 | Space between dots in pixels |
| `baseColor` | string | '#5227FF' | Default color of dots (hex) |
| `activeColor` | string | '#5227FF' | Color when near cursor (hex) |
| `proximity` | number | 150 | Distance for color transition effect |
| `speedTrigger` | number | 100 | Mouse speed to trigger push effect |
| `shockRadius` | number | 250 | Click effect radius in pixels |
| `shockStrength` | number | 5 | Click push force multiplier |
| `maxSpeed` | number | 5000 | Maximum velocity cap |
| `resistance` | number | 750 | Inertia resistance (higher = slower) |
| `returnDuration` | number | 1.5 | Elastic return animation duration (seconds) |
| `className` | string | '' | Additional CSS classes |
| `style` | CSSProperties | undefined | Inline styles |

## Integration Examples

### 1. As a Background Layer

```tsx
<div className="relative min-h-screen">
  {/* Background */}
  <div className="absolute inset-0 z-0">
    <DotGrid
      dotSize={4}
      gap={16}
      baseColor="#1E1E2A"
      activeColor="#CAA4F7"
      proximity={150}
    />
  </div>
  
  {/* Content */}
  <div className="relative z-10">
    <h1>Your Content Here</h1>
  </div>
</div>
```

### 2. In Empty States (Like EditorView)

Replace or complement the existing `DotField` component:

```tsx
{!activeFile ? (
  <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
    {/* DotGrid Background */}
    <div className="absolute inset-0 z-0">
      <DotGrid
        dotSize={3}
        gap={14}
        baseColor={isDark ? '#232332' : '#EEF1F5'}
        activeColor={isDark ? '#CAA4F7' : '#9B6DD7'}
        proximity={120}
        shockRadius={250}
        shockStrength={5}
        resistance={750}
        returnDuration={1.5}
      />
    </div>
    
    {/* Content */}
    <div className="relative z-10 text-center">
      <h2>Welcome to CodeCollab</h2>
      <button onClick={onFileCreate}>Create New File</button>
    </div>
  </div>
) : (
  // ... editor content
)}
```

### 3. Theme-Aware Implementation

```tsx
import { useTheme } from '../hooks/useTheme';

function MyComponent() {
  const { isDark } = useTheme();
  
  return (
    <DotGrid
      dotSize={5}
      gap={15}
      baseColor={isDark ? '#2F293A' : '#E5E8EE'}
      activeColor={isDark ? '#5227FF' : '#8B39EF'}
      proximity={120}
    />
  );
}
```

### 4. Full Page Hero Section

```tsx
<section className="relative h-screen overflow-hidden">
  <DotGrid
    dotSize={6}
    gap={20}
    baseColor="#0A0A0F"
    activeColor="#8B5CF6"
    proximity={200}
    shockRadius={300}
    shockStrength={8}
    className="absolute inset-0"
  />
  
  <div className="relative z-10 flex items-center justify-center h-full">
    <div className="text-center">
      <h1 className="text-6xl font-bold mb-4">Welcome</h1>
      <p className="text-xl">Interactive dot grid background</p>
    </div>
  </div>
</section>
```

## Customization Tips

### Subtle Background Effect
```tsx
<DotGrid
  dotSize={3}
  gap={20}
  baseColor="#F5F5F5"
  activeColor="#E0E0E0"
  proximity={80}
  shockRadius={150}
  shockStrength={2}
  resistance={900}
/>
```

### High Energy Effect
```tsx
<DotGrid
  dotSize={8}
  gap={18}
  baseColor="#1A1A2E"
  activeColor="#FF6B6B"
  proximity={250}
  speedTrigger={60}
  shockRadius={400}
  shockStrength={12}
  maxSpeed={7000}
  resistance={400}
  returnDuration={3}
/>
```

### Dense Grid
```tsx
<DotGrid
  dotSize={2}
  gap={10}
  baseColor="#232332"
  activeColor="#4A90E2"
  proximity={100}
/>
```

## Performance Considerations

1. **Canvas Rendering**: The component uses HTML5 Canvas for efficient rendering
2. **Throttling**: Mouse events are throttled to 50ms for performance
3. **Device Pixel Ratio**: Automatically handles high-DPI displays
4. **Animation**: Uses GSAP for hardware-accelerated animations
5. **Resize Observer**: Automatically adjusts to container size changes

## Browser Compatibility

- Modern browsers with Canvas support
- Path2D API required (all modern browsers)
- ResizeObserver API (polyfill available if needed)

## Accessibility

The canvas has `pointer-events: none` by default, making it non-interactive for screen readers. Content overlaid on top remains fully accessible.

## Example Component

See `frontend/src/components/DotGridExample.tsx` for a complete example with multiple configurations.

## Troubleshooting

### Dots not appearing
- Ensure the parent container has explicit width and height
- Check that colors are valid hex values
- Verify GSAP is installed: `npm install gsap`

### Performance issues
- Reduce `dotSize` or increase `gap` to render fewer dots
- Increase throttle limit in the component (default: 50ms)
- Reduce `proximity` and `shockRadius` values

### Animation feels sluggish
- Decrease `resistance` value (try 500-600)
- Decrease `returnDuration` (try 1.0-1.2)
- Increase `shockStrength` for more responsive clicks

## License

This component uses GSAP which requires a license for commercial use. See [GSAP Licensing](https://greensock.com/licensing/) for details.
