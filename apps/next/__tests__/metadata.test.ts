import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.com");
  vi.stubEnv("KINGSTACK_ENVIRONMENT", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL_URL", "deployment-example.vercel.app");
});

afterEach(() => vi.unstubAllEnvs());

describe("environment-owned site metadata", () => {
  it("uses the configured www origin for page canonicals and Open Graph", async () => {
    const { siteConfig, defaultMetadata, createMetadata } =
      await import("../src/lib/metadata");
    const metadata = createMetadata({ canonical: "/store" });
    expect(siteConfig.url).toBe("https://www.example.com");
    expect(new URL(defaultMetadata.metadataBase!).origin).toBe(siteConfig.url);
    expect(
      new URL(
        String(metadata.alternates?.canonical),
        defaultMetadata.metadataBase!,
      ).href,
    ).toBe("https://www.example.com/store");
    expect(metadata.openGraph?.url).toBe(metadata.alternates?.canonical);
    expect(defaultMetadata.robots).toMatchObject({
      index: true,
      googleBot: { index: true },
    });
  });

  it.each(["local", "development", "staging", undefined])(
    "does not index %s even with NODE_ENV and VERCEL_ENV set to production",
    async (environment) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("KINGSTACK_ENVIRONMENT", environment);
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://development.example.com");
      const { siteConfig, defaultMetadata, createMetadata } =
        await import("../src/lib/metadata");
      expect(siteConfig.url).toBe("https://development.example.com");
      expect(defaultMetadata.robots).toMatchObject({
        index: false,
        follow: false,
        googleBot: { index: false },
      });
      expect(createMetadata({ noIndex: false }).robots).toEqual(
        defaultMetadata.robots,
      );
    },
  );

  it("uses the preview deployment origin and prevents indexing even with production config", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { siteConfig, defaultMetadata } = await import("../src/lib/metadata");
    expect(siteConfig.url).toBe("https://deployment-example.vercel.app");
    expect(defaultMetadata.robots).toMatchObject({
      index: false,
      googleBot: { index: false },
    });
  });

  it("preserves local HTTP and the configured port", async () => {
    vi.stubEnv("KINGSTACK_ENVIRONMENT", "local");
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3069");
    const { siteConfig } = await import("../src/lib/metadata");
    expect(siteConfig.url).toBe("http://localhost:3069");
  });

  it("allows indexing on self-hosted production and honors private pages", async () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    const { defaultMetadata, createMetadata } =
      await import("../src/lib/metadata");
    expect(defaultMetadata.robots).toMatchObject({ index: true });
    expect(createMetadata({ noIndex: true }).robots).toMatchObject({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    });
  });

  it("fails clearly when URL generation or sync was skipped", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    await expect(import("../src/lib/metadata")).rejects.toThrow(
      "NEXT_PUBLIC_SITE_URL is missing",
    );
  });

  it.each([
    "ftp://example.com",
    "https://example.com/path",
    "https://user:password@example.com",
    "https://example.com?x=1",
  ])("rejects a non-origin site URL: %s", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", url);
    await expect(import("../src/lib/metadata")).rejects.toThrow(
      "must be an HTTP(S) origin",
    );
  });

  it.each([
    "https://old.example.com/store",
    "//other.example.com/store",
    "/\\other.example.com/store",
    "store",
    "/\t/other.example.com/store",
  ])(
    "prevents page canonical overrides from introducing another hostname: %s",
    async (canonical) => {
      const { createMetadata } = await import("../src/lib/metadata");
      expect(() => createMetadata({ canonical })).toThrow("root-relative path");
    },
  );
});
