# Juice Button

An enhanced button component with configurable "juice levels" for progressive interaction enhancements. Built on top of shadcn/ui Button component with support for audio, confetti, ripple effects, and theme-aware animations.

## Features

- **Juice Levels (0-3)**: Progressive enhancement from minimal to maximum interactivity
- **Theme-Aware**: Automatically adapts to neo-brutalist, neomorphism, glassmorphism, and box themes
- **Audio Support**: Sound effects with global mute and volume controls
- **Visual Effects**: Confetti, ripples, shake, and pulse animations
- **Advanced Easing**: Theme and variant-specific easing functions for emotional animations
- **FLIP Animations**: Smooth state transitions using the FLIP technique
- **Accessibility**: Respects `prefers-reduced-motion` and provides override options
- **Loading States**: Special animations for async operations with FLIP transitions
- **Hold-to-Confirm**: For destructive actions with visual progress

## Installation

The required packages are already installed:
- `canvas-confetti` - Confetti effects
- `howler` - Audio management
- `@types/canvas-confetti` - TypeScript types
- `@types/howler` - TypeScript types

## Usage

### Basic Example

```tsx
import { JuiceButton } from "@/components/ui/juice-button";

export function Example() {
  return (
    <JuiceButton juice={2} variant="default">
      Click me!
    </JuiceButton>
  );
}
```

### With JuiceProvider (Recommended)

Wrap your app with the `JuiceProvider` to enable global audio controls:

```tsx
import { JuiceProvider } from "@/components/ui/juice-button";

export function App({ children }) {
  return (
    <JuiceProvider>
      {children}
    </JuiceProvider>
  );
}
```

### Juice Levels

#### Level 0 (Default)
No enhancements, standard button behavior.

```tsx
<JuiceButton juice={0}>Standard Button</JuiceButton>
```

#### Level 1 (Subtle)
- Light hover scale (1.02x)
- Haptic-style feedback on click

```tsx
<JuiceButton juice={1}>Subtle Juice</JuiceButton>
```

#### Level 2 (Enhanced)
- More pronounced scale (1.05x)
- Ripple effect
- Click sound

```tsx
<JuiceButton juice={2}>Enhanced Juice</JuiceButton>
```

#### Level 3 (Maximum)
- Full scale transforms (1.08x)
- Confetti effects
- Complex animations
- Hold-to-play audio (for loading states)

```tsx
<JuiceButton juice={3} variant="success">
  Maximum Juice!
</JuiceButton>
```

### Variants

All shadcn button variants are supported plus custom juice variants:

```tsx
// Standard variants
<JuiceButton variant="default" juice={2}>Default</JuiceButton>
<JuiceButton variant="outline" juice={2}>Outline</JuiceButton>
<JuiceButton variant="secondary" juice={2}>Secondary</JuiceButton>
<JuiceButton variant="ghost" juice={2}>Ghost</JuiceButton>
<JuiceButton variant="link" juice={2}>Link</JuiceButton>

// Juice-specific variants
<JuiceButton variant="success" juice={3}>Success</JuiceButton>
<JuiceButton variant="destructive" juice={2}>Destructive</JuiceButton>
```

### Success Button with Confetti

```tsx
<JuiceButton
  juice={3}
  variant="success"
  onClick={() => console.log("Success!")}
>
  Celebrate!
</JuiceButton>
```

### Loading State with FLIP Animation

At juice level 2+, buttons use FLIP animations when transitioning from loading to complete state. At level 3, they show a brief success state with a checkmark before returning to normal content.

```tsx
const [isLoading, setIsLoading] = useState(false);

<JuiceButton
  juice={3}
  isLoading={isLoading}
  loadingProgress={50} // Shows percentage at juice level 3
  onClick={async () => {
    setIsLoading(true);
    await doAsyncWork();
    setIsLoading(false);
    // Button smoothly transitions from loader → "Done!" → original content
  }}
>
  Submit
</JuiceButton>
```

### Hold-to-Confirm (Destructive Actions)

```tsx
<JuiceButton
  juice={2}
  variant="destructive"
  holdDuration={2000}
  onHoldComplete={() => {
    console.log("Action confirmed!");
  }}
>
  Hold to Delete
</JuiceButton>
```

### Theme Style Override

```tsx
<JuiceButton
  juice={3}
  themeStyle="neo-brutalist" // Override auto-detection
>
  Neo Brutalist
</JuiceButton>
```

### Disable Audio or Confetti

```tsx
<JuiceButton
  juice={3}
  audioEnabled={false}
  confettiEnabled={false}
>
  Silent Button
</JuiceButton>
```

### Force Effects (Override User Preferences)

```tsx
<JuiceButton
  juice={3}
  forceAudio={true}        // Play sound even if globally muted
  forceAnimations={true}   // Animate even with reduced motion
>
  Force Effects
</JuiceButton>
```

## Theme Adaptations

The JuiceButton automatically adapts to the detected theme style with custom easing functions:

### Neo-Brutalist
- **Easing**: Snap (`cubic-bezier(0.25, 0.46, 0.45, 0.94)`)
- Sharper, aggressive animations
- Hard shadow transforms
- Bold color shifts
- Chunky square confetti
- Square wave "punch" sounds (300Hz)

### Neomorphism
- **Easing**: Smooth (`cubic-bezier(0.25, 0.1, 0.25, 1)`)
- Smooth, organic transitions (1.3x duration)
- Inset/outset shadow morphing
- Soft, glowy effects
- Rounded confetti particles
- Gentle sine wave sounds (600Hz)

### Glassmorphism
- **Easing**: Float (`cubic-bezier(0.16, 1, 0.3, 1)`)
- Light, floaty animations
- Blur intensity changes
- Transparency shifts
- Translucent confetti with blur
- Crystal harmonics (multiple frequencies)

### Box (Default)
- **Easing**: Standard ease-in-out (`cubic-bezier(0.4, 0, 0.2, 1)`)
- Clean, balanced animations
- Standard effects
- Universal confetti
- Pure sine wave sounds (800Hz)

## API Reference

### JuiceButton Props

All standard Button props are supported, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `juice` | `0 \| 1 \| 2 \| 3` | `0` | Juice level (enhancement intensity) |
| `variant` | `ButtonVariant \| "success" \| "loading"` | `"default"` | Button variant |
| `themeStyle` | `"auto" \| "box" \| "neo-brutalist" \| "neomorphism" \| "glassmorphism"` | `"auto"` | Theme style |
| `isLoading` | `boolean` | `false` | Loading state |
| `loadingProgress` | `number` | `undefined` | Loading progress 0-100 (shown at juice 3) |
| `audioEnabled` | `boolean` | `true` | Enable audio effects |
| `confettiEnabled` | `boolean` | `true` | Enable confetti effects |
| `forceAudio` | `boolean` | `false` | Force audio even if globally muted |
| `forceAnimations` | `boolean` | `false` | Force animations despite reduced motion |
| `holdDuration` | `number` | `2000` | Hold duration in ms for confirmations |
| `onHoldComplete` | `() => void` | `undefined` | Callback when hold is complete |

### useJuice Hook

Access global juice settings:

```tsx
import { useJuice } from "@/components/ui/juice-button";

function AudioControls() {
  const { globalMute, toggleMute, volume, setVolume } = useJuice();

  return (
    <div>
      <button onClick={toggleMute}>
        {globalMute ? "Unmute" : "Mute"}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
      />
    </div>
  );
}
```

## Advanced Features

### FLIP Animations

FLIP (First, Last, Invert, Play) is used for smooth state transitions:

- **Loading → Complete**: At juice level 2+, the button content smoothly morphs from the loading spinner to the final content
- **Success State**: At juice level 3, shows a brief "Done!" message with checkmark after loading completes
- **Position Preservation**: Elements maintain visual continuity during state changes

### Variant-Specific Easing

Different button variants use different easing functions to match their emotional intent:

- **Success**: Elastic bounce (`cubic-bezier(0.34, 1.56, 0.64, 1)`) - Celebratory overshoot
- **Destructive**: Anticipation (`cubic-bezier(0.68, -0.55, 0.27, 1.55)`) - Slight pullback before action
- **Default**: Theme-specific easing (see Theme Adaptations above)

### Redundant Feedback

Multiple feedback channels work together to overcome the "pane of glass" between user and interface:

- **Visual**: Scale, color, particles, ripples
- **Audio**: Theme-specific sounds, chords, tones
- **Textual**: Dynamic labels, progress indicators
- **Future**: Haptic feedback via Vibration API

## Accessibility

- **Reduced Motion**: Automatically respects `prefers-reduced-motion` unless `forceAnimations` is true
- **Keyboard Navigation**: All juice effects work with keyboard interaction
- **Screen Readers**: Proper ARIA attributes and state announcements
- **Audio Control**: Global mute option for users who prefer no sound

## Performance Notes

- Heavy features (confetti, audio) are lazy-loaded
- CSS transforms used for GPU acceleration
- Animations cleaned up on unmount
- Sound sprites used for efficient audio loading
- Confetti uses canvas for optimal performance

## Notes

- **Audio Files**: The current implementation uses placeholder sounds. For production, replace with actual audio files in the `/public/sounds` directory.
- **Custom Sounds**: Register custom sounds using the `audioManager.registerSound()` method.
- **Theme Detection**: Works by reading the `data-style` attribute from parent elements.

## Examples in Your App

Check out the theme pages for live examples:
- `/theme` - Box style
- `/theme/neo-brutalist` - Neo-brutalist style
- `/theme/neomorphism` - Neomorphism style
- `/theme/glassmorphism` - Glassmorphism style
