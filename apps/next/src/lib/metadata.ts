import type { Metadata, MetadataRoute, Viewport } from "next";

// Site-wide configuration
export const siteConfig = {
  name: "KingStack",
  shortName: "KingStack",
  description:
    "A modern full-stack TypeScript monorepo with Next.js, NestJS, Supabase, and powerful state management.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://kingstack.dev",
  ogImage: "/og-image.jpg", // You'll need to add this image
  creator: "KingStack Team",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@kingstack.dev",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE,
  location: process.env.NEXT_PUBLIC_LOCATION,
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE,
  // PWA Configuration
  themeColor: "#0f172a", // slate-900
  backgroundColor: "#ffffff",
  // PWA Manifest Configuration
  manifest: {
    display: "standalone" as const,
    orientation: "portrait-primary" as const,
    categories: ["productivity", "development", "technology"],
    lang: "en-US",
    dir: "ltr" as const,
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any" as const,
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any" as const,
      },
    ],
  },
} as const;

// Default metadata for the site
export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "full-stack",
    "typescript",
    "monorepo",
    "nextjs",
    "nestjs",
    "supabase",
    "prisma",
    "state management",
    "mobx",
    "tanstack query",
    "realtime",
    "websockets",
  ],
  authors: [
    {
      name: siteConfig.creator,
      url: siteConfig.url,
    },
  ],
  creator: siteConfig.creator,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: siteConfig.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add verification codes when you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
  // PWA Icons Configuration - Explicitly defined in public/icons/
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/icons/favicon.ico",
  },
  // Manifest is generated from app/manifest.ts
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.shortName,
  },
  formatDetection: {
    telephone: false,
  },
};

// Default viewport configuration
export const defaultViewport: Viewport = {
  themeColor: siteConfig.themeColor,
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// Helper function to create page-specific metadata
export function createMetadata(overrides: {
  title?: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  noIndex?: boolean;
  canonical?: string;
}): Metadata {
  const {
    title,
    description,
    keywords,
    ogImage,
    noIndex = false,
    canonical,
  } = overrides;

  return {
    title: title || undefined,
    description: description || siteConfig.description,
    keywords: keywords
      ? [...defaultMetadata.keywords!, ...keywords]
      : defaultMetadata.keywords,
    openGraph: {
      ...defaultMetadata.openGraph,
      title: title || defaultMetadata.openGraph?.title,
      description: description || defaultMetadata.openGraph?.description,
      url: canonical || defaultMetadata.openGraph?.url,
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: title || siteConfig.name,
            },
          ]
        : defaultMetadata.openGraph?.images,
    },
    twitter: {
      ...defaultMetadata.twitter,
      title: title || defaultMetadata.twitter?.title,
      description: description || defaultMetadata.twitter?.description,
      images: ogImage ? [ogImage] : defaultMetadata.twitter?.images,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : defaultMetadata.robots,
    alternates: canonical
      ? {
          canonical: canonical,
        }
      : undefined,
  };
}

// Generate PWA manifest from site configuration
export function generateManifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/",
    display: siteConfig.manifest.display,
    background_color: siteConfig.backgroundColor,
    theme_color: siteConfig.themeColor,
    orientation: siteConfig.manifest.orientation,
    icons: [...siteConfig.manifest.icons],
    categories: [...siteConfig.manifest.categories],
    lang: siteConfig.manifest.lang,
    dir: siteConfig.manifest.dir,
  };
}
