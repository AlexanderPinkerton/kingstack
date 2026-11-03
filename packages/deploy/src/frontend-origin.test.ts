import { describe, expect, it } from "bun:test";
import { checkFrontendOrigin } from "./frontend-origin.js";

describe("frontend origin deployment check", () => {
  it("flags an apex-to-www redirect without requesting the other origin", async () => {
    const requested: string[] = [];
    const warning = await checkFrontendOrigin(
      "https://example.com",
      (url, options) => {
        requested.push(url.href);
        expect(options.method).toBe("HEAD");
        expect(options.redirect).toBe("manual");
        return Promise.resolve(
          new Response(null, {
            status: 307,
            headers: { location: "https://www.example.com/" },
          }),
        );
      },
    );
    expect(warning).toContain("redirects to https://www.example.com");
    expect(warning).toContain("NEXT_HOST");
    expect(requested).toEqual(["https://example.com/"]);
  });

  it("allows same-origin path redirects", async () => {
    const warning = await checkFrontendOrigin(
      "https://www.example.com",
      (url) => {
        if (url.pathname === "/")
          return Promise.resolve(
            new Response(null, {
              status: 308,
              headers: { location: "/store" },
            }),
          );
        return Promise.resolve(new Response(null, { status: 200 }));
      },
    );
    expect(warning).toBeUndefined();
  });

  it("detects an origin change after a same-origin redirect", async () => {
    const warning = await checkFrontendOrigin("https://example.com", (url) => {
      const location =
        url.pathname === "/" ? "/store" : "https://www.example.com/store";
      return Promise.resolve(
        new Response(null, { status: 302, headers: { location } }),
      );
    });
    expect(warning).toContain("redirects to https://www.example.com");
  });

  it("bounds redirect loops", async () => {
    let attempts = 0;
    const warning = await checkFrontendOrigin("https://example.com", () => {
      attempts++;
      return Promise.resolve(
        new Response(null, { status: 301, headers: { location: "/" } }),
      );
    });
    expect(warning).toContain("unresolved redirects");
    expect(attempts).toBe(5);
  });

  it("reports unavailable frontends without throwing or exposing request errors", async () => {
    const warning = await checkFrontendOrigin("https://example.com", () => {
      return Promise.reject(new Error("private-request-detail"));
    });
    expect(warning).toContain("Could not reach frontend origin");
    expect(warning).not.toContain("private-request-detail");
    expect(
      await checkFrontendOrigin("https://example.com", () =>
        Promise.resolve(new Response(null, { status: 404 })),
      ),
    ).toContain("HTTP 404");
  });
});
