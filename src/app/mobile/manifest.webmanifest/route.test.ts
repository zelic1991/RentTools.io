import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("mobile PWA manifest", () => {
  it("keeps launch URL, stable id and scope on the canonical mobile route", async () => {
    const response = GET();
    const manifest = await response.json();

    expect(response.headers.get("content-type")).toContain("application/manifest+json");
    expect(manifest).toMatchObject({
      id: "/mobile",
      start_url: "/mobile",
      scope: "/mobile",
      display: "standalone",
      name: "Zelic Family Vir Betrieb",
      background_color: "#F6F1E6",
      theme_color: "#F6F1E6",
    });
    expect(manifest.icons).toEqual(expect.not.arrayContaining([
      expect.objectContaining({ purpose: "maskable" }),
    ]));
  });
});
