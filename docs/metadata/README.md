# 📋 Metadata & SEO Configuration Guide

This guide explains how to manage metadata, SEO, and PWA configuration for KingStack.

---

## 📁 File Structure

All metadata configuration is centralized in a single file:

```
apps/next/src/
├── lib/
│   └── metadata.ts          # 🎯 All metadata & PWA configuration
└── app/
    ├── layout.tsx           # Root layout (uses defaultMetadata)
    └── manifest.ts         # PWA manifest wrapper (auto-generated)
```

---

## 🎯 Core Configuration File

**Location:** `apps/next/src/lib/metadata.ts`

This file contains:

- `siteConfig` - Site-wide settings (name, description, URLs, contact info, PWA settings)
- `defaultMetadata` - Default Next.js metadata for all pages
- `createMetadata()` - Helper function for page-specific metadata
- `generateManifest()` - PWA manifest generator

---

## ⚙️ Configuring Site-Wide Settings

Edit the `siteConfig` object in `metadata.ts`:

```typescript
export const siteConfig = {
  name: "KingStack",           // Full site name
  shortName: "KingStack",       // Short name for PWA
  description: "Your site description...",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://kingstack.dev",
  ogImage: "/og-image.jpg",     // Open Graph image
  creator: "KingStack Team",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@kingstack.dev",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
  location: process.env.NEXT_PUBLIC_LOCATION,
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE,
  
  // PWA Configuration
  themeColor: "#0f172a",        // Browser theme color
  backgroundColor: "#ffffff",    // PWA background color
  
  // PWA Manifest Configuration
  manifest: {
    display: "standalone",
    orientation: "portrait-primary",
    categories: ["productivity", "development", "technology"],
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  },
}
```

---

## 📄 Adding Metadata to Pages

### For Server Component Pages

Export metadata directly from your page:

```typescript
import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Your Page Title",
  description: "Your page-specific description",
  keywords: ["keyword1", "keyword2", "keyword3"],
  canonical: "/your-page",
  ogImage: "/custom-og-image.jpg",  // Optional: custom OG image
  noIndex: false,                    // Set to true to prevent indexing
});

export default function YourPage() {
  // Your component
}
```

### For Client Component Pages

Since client components can't export metadata, create a `layout.tsx` in the same directory:

```typescript
// app/your-page/layout.tsx
import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Your Page Title",
  description: "Your page description",
  canonical: "/your-page",
});

export default function YourPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

---

## 🎨 PWA & Icons Configuration

### Icon Files Required

You have two options for icon placement:

#### Option 1: Next.js File-Based Icons (Recommended)

Place icons directly in the `app/` directory:

- `app/icon.png` (or `icon.ico`) - 512x512px recommended
- `app/apple-icon.png` - 180x180px for iOS
- `app/favicon.ico` - 32x32px

Next.js will automatically detect and serve these.

#### Option 2: Public Directory Icons

Place icons in the `public/icons/` directory:

- `public/icons/icon.png`
- `public/icons/icon-192x192.png` - 192x192px for Android
- `public/icons/icon-512x512.png` - 512x512px for Android/PWA
- `public/icons/apple-touch-icon.png` - 180x180px for iOS
- `public/icons/favicon.ico`
- `public/icons/favicon-16x16.png` - 16x16px
- `public/icons/favicon-32x32.png` - 32x32px

### Updating Icon Configuration

Edit the `icons` section in `defaultMetadata` and `manifest.icons` in `siteConfig`:

```typescript
// In defaultMetadata
icons: {
  icon: [
    { url: "/icons/icon.png", sizes: "any" },
    { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [
    { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  ],
  shortcut: "/icons/favicon.ico",
},

// In siteConfig.manifest
icons: [
  { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
],
```

---

## 🔧 Advanced Configuration

### Custom Open Graph Images

Set a custom OG image for specific pages:

```typescript
export const metadata: Metadata = createMetadata({
  title: "Product Page",
  description: "Check out our amazing product",
  ogImage: "/products/product-og.jpg",  // Custom image
  canonical: "/products/amazing-product",
});
```

### Preventing Indexing

For pages you don't want search engines to index:

```typescript
export const metadata: Metadata = createMetadata({
  title: "Admin Dashboard",
  description: "Internal admin page",
  noIndex: true,  // Prevents indexing
});
```

### Adding Verification Codes

Add search engine verification codes in `defaultMetadata`:

```typescript
verification: {
  google: "your-google-verification-code",
  yandex: "your-yandex-verification-code",
  bing: "your-bing-verification-code",
},
```

---

## 📱 PWA Manifest

The PWA manifest is automatically generated from `siteConfig.manifest`. The `app/manifest.ts` file is a thin wrapper that calls `generateManifest()`.

To modify PWA settings, edit `siteConfig.manifest` in `metadata.ts`:

```typescript
manifest: {
  display: "standalone",              // "standalone" | "fullscreen" | "minimal-ui"
  orientation: "portrait-primary",     // Lock orientation
  categories: ["productivity", "development", "technology"],
  lang: "en-US",
  dir: "ltr",
  icons: [/* icon config */],
}
```

---

## 🎯 Best Practices

### 1. **Always Use `createMetadata()` Helper**

   - Ensures consistency across pages
   - Automatically merges with default metadata
   - Handles Open Graph and Twitter cards

### 2. **Keep Descriptions Concise**

   - Aim for 150-160 characters for optimal SEO
   - Make them unique per page

### 3. **Use Canonical URLs**

   - Always specify `canonical` to prevent duplicate content issues
   - Use absolute paths (e.g., `/services` not `services`)

### 4. **Optimize Images**

   - OG images should be 1200x630px
   - Icons should be properly sized (see Icon Files Required section)
   - Use WebP format when possible

### 5. **Test Your Metadata**

   - Use [Google Rich Results Test](https://search.google.com/test/rich-results)
   - Test Open Graph with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   - Verify PWA manifest at `/manifest.json`

---

## 📚 Examples

### Example: Services Page

```typescript
// app/services/layout.tsx
import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMetadata({
  title: "Services",
  description:
    "Professional software development, 3D design, prototyping, and consulting services.",
  keywords: [
    "software development services",
    "3D design services",
    "prototyping services",
  ],
  canonical: "/services",
});

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

### Example: Product Page with Custom OG Image

```typescript
// app/products/[id]/page.tsx
import type { Metadata } from "next";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  // Fetch product data
  const product = await getProduct(params.id);
  
  return createMetadata({
    title: product.name,
    description: product.description,
    keywords: [product.category, product.brand],
    ogImage: product.imageUrl,
    canonical: `/products/${params.id}`,
  });
}
```

---

## 🔍 Troubleshooting

### Metadata Not Showing Up

- Ensure you're exporting `metadata` (not `export default metadata`)
- For client components, use a `layout.tsx` file
- Check that you're importing from `@/lib/metadata`

### PWA Not Installing

- Verify icon files exist in the correct location
- Check that `manifest.json` is accessible at `/manifest.json`
- Ensure HTTPS is enabled (required for PWA)

### TypeScript Errors

- Make sure icon `purpose` values are `"any"`, `"maskable"`, or `"monochrome"` (not combined)
- Check that all required fields in `siteConfig` are filled

---

## 📖 Reference

- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)

---

## 🎨 Quick Reference

| Setting | Location | Description |
|---------|----------|-------------|
| Site Name | `siteConfig.name` | Full site name |
| Site Description | `siteConfig.description` | Default meta description |
| Theme Color | `siteConfig.themeColor` | Browser/PWA theme color |
| OG Image | `siteConfig.ogImage` | Default Open Graph image |
| PWA Icons | `siteConfig.manifest.icons` | PWA icon configuration |
| Page Title | `createMetadata({ title: "..." })` | Page-specific title |
| Page Description | `createMetadata({ description: "..." })` | Page-specific description |
| Canonical URL | `createMetadata({ canonical: "/..." })` | Page canonical URL |

---

🌟 **All metadata configuration is managed in one place: `apps/next/src/lib/metadata.ts`**

