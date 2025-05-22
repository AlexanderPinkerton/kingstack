# Kingstack UI Design System & Themed Components

## ✨ Design Aesthetic Overview

Kingstack’s UI is inspired by a **dark, futuristic, neon-glassmorphism** aesthetic. The look is modern, moody, and immersive, with glowing accents and a focus on usability and clarity.

### Key Visual Elements
- **Dark backgrounds:** Deep blacks and dark gradients form the base.
- **Glassmorphism:** Cards and containers are semi-transparent, with blurred backdrops and soft borders.
- **Neon accents:** Cyan and purple glows, animated borders, and gradient text provide a futuristic vibe.
- **Soft glows:** Shadows and focus states glow with neon colors.
- **Readable, light text:** All text is high-contrast for accessibility.

---

## 🧩 Themed Components

To keep the UI consistent and DRY, use the following themed components for all forms and interactive elements. These are found in `src/components/ui/`.

### 1. `AnimatedBorderContainer`
- **Purpose:** Wraps content with a glowing, animated border and glassy background.
- **Usage:** Use as the outermost container for pages, cards, or sections.
- **Example:**
  ```tsx
  <AnimatedBorderContainer>
    ...
  </AnimatedBorderContainer>
  ```

### 2. `NeonCard`
- **Purpose:** Glassmorphic card with a subtle neon border and backdrop blur.
- **Usage:** Use for main content areas, forms, or modal bodies.
- **Example:**
  ```tsx
  <NeonCard className="p-8">
    ...
  </NeonCard>
  ```

### 3. `GradientText`
- **Purpose:** Applies a neon gradient to headings or important text.
- **Usage:** Use for titles, section headers, or callouts.
- **Example:**
  ```tsx
  <GradientText className="text-3xl font-bold">Welcome</GradientText>
  ```

### 4. `ThemedInput`
- **Purpose:** Dark, glassy input with neon focus and faint placeholder.
- **Usage:** Use for all text, email, password, and date inputs.
- **Example:**
  ```tsx
  <ThemedInput placeholder="you@example.com" />
  ```

### 5. `ThemedButton`
- **Purpose:** Neon-gradient primary button.
- **Usage:** Use for main actions (submit, confirm, etc).
- **Example:**
  ```tsx
  <ThemedButton>Sign In</ThemedButton>
  ```

### 6. `ThemedOutlineButton`
- **Purpose:** Outlined neon button for secondary actions (e.g., OAuth, cancel).
- **Example:**
  ```tsx
  <ThemedOutlineButton>Sign in with Google</ThemedOutlineButton>
  ```

### 7. `ThemedLabel`
- **Purpose:** Light/cyan label for form fields.
- **Example:**
  ```tsx
  <ThemedLabel htmlFor="email">Email</ThemedLabel>
  ```

### 8. `ThemedErrorText` / `ThemedSuccessText`
- **Purpose:** Consistent, readable feedback for errors/successes.
- **Example:**
  ```tsx
  <ThemedErrorText>Something went wrong</ThemedErrorText>
  ```

---

## 🛠️ How to Use The Theme for New Pages/Components

1. **Wrap main content in `AnimatedBorderContainer` and/or `NeonCard`.**
2. **Use `GradientText` for headings.**
3. **Use themed inputs, buttons, and labels for all forms.**
4. **Apply text classes like `text-cyan-200`, `text-cyan-300`, or `text-white` for visibility.**
5. **For links and interactive text:** Use `text-cyan-300 hover:text-purple-400` for the neon effect.
6. **For feedback:** Use `ThemedErrorText` and `ThemedSuccessText` for consistent messaging.

---

## 🎨 Extending & Replicating the Theme

- **Color Palette:**
  - Primary neon: `cyan-400`, `cyan-500`, `purple-500`, `purple-600`
  - Backgrounds: `black/80`, `gray-900`, gradients
  - Text: `cyan-100`, `cyan-200`, `white`
- **Add new themed components** by following the pattern: wrap the base UI component, apply the theme classes, and export.
- **Animations:** Use Tailwind’s `animate-`, `transition-`, and custom CSS for glows, fades, and border effects.
- **Accessibility:** Always check color contrast, especially for text and placeholders.
- **Responsiveness:** Use Tailwind’s responsive classes to ensure layouts work on all devices.

---

## 🎨 Color System & Theme Variables

All color values for the Kingstack UI are centrally managed in the `globals.css` file using CSS custom properties (variables). This approach ensures:

- **Consistency:** All components reference the same source of truth for colors.
- **Dynamic theming:** Changing a single accent or base color will automatically update all related shades and UI elements.
- **Scalability:** Adding new colors or modifying the palette is straightforward and immediately reflected everywhere.

### How to Use Colors
- **Always reference colors via CSS variables** (e.g., `var(--accent-1-m)`, `var(--gradient-from)`) in your component styles and Tailwind class overrides.
- **Do not hardcode color values** in components. If you need a new color, add it to `globals.css` first.
- **Calculated shades:** Many color variables in `globals.css` use OKLCH color math to generate lighter/darker variants from a single base color. This keeps the UI harmonious and makes theme changes easy.
- **Example:**
  ```css
  :root {
    --accent-1-m: oklch(0.7971 0.1339 211.53); /* base accent */
    --accent-1-l: oklch(from var(--accent-1-m) calc(l + 0.25) c h); /* lighter */
    --accent-1-d: oklch(from var(--accent-1-m) calc(l - 0.25) c h); /* darker */
    --gradient-from: var(--accent-1-m);
    --gradient-to: var(--accent-2-m);
    --accent-mix: color-mix(in oklch, var(--accent-1-m), var(--accent-2-m));
  }
  ```
- **Component usage:**
  ```tsx
  <button className="bg-[var(--gradient-from)] text-[var(--accent-1-sl)] ...">Click</button>
  ```

### Adding New Colors
- Define new base colors and their calculated shades directly in `globals.css`.
- Use OKLCH or color-mix for perceptually consistent scales.
- Reference the new variables in your components and Tailwind class overrides.

**By following these practices, you ensure the entire stack remains visually consistent, easily themeable, and future-proof.**

---

## 📝 Sample Page Structure

```tsx
<AnimatedBorderContainer>
  <NeonCard className="max-w-lg mx-auto p-8">
    <GradientText className="text-3xl font-bold mb-6">Create Account</GradientText>
    <form className="space-y-6">
      <div>
        <ThemedLabel htmlFor="email">Email</ThemedLabel>
        <ThemedInput id="email" type="email" placeholder="you@example.com" />
      </div>
      <ThemedButton type="submit">Register</ThemedButton>
    </form>
  </NeonCard>
</AnimatedBorderContainer>
```

---

## 💡 Tips
- **Be consistent:** Always use the themed components, not raw inputs/buttons.
- **Preview on dark backgrounds:** Test your components in context.
- **Glow sparingly:** Use neon glows for focus/active states, not everywhere.
- **Expand thoughtfully:** When adding new UI, match the color, shadow, and border styles from existing themed components.

---

For questions or new theme ideas, see the existing themed components in this folder for inspiration and patterns.
