import { describe, expect, it } from "vitest";

import {
  buildCatalogHref,
  parseCatalogSearchParams,
} from "@/modules/catalog/search-params";

describe("parseCatalogSearchParams", () => {
  it("applies defaults for an empty query", () => {
    expect(parseCatalogSearchParams({})).toEqual({ sort: "featured", page: 1 });
  });

  it("parses valid filters", () => {
    expect(
      parseCatalogSearchParams({
        q: " roses ",
        collection: "premium-bouquets",
        occasion: "birthday",
        min: "500",
        max: "3000",
        sort: "price-asc",
        page: "2",
      }),
    ).toEqual({
      q: "roses",
      collection: "premium-bouquets",
      occasion: "birthday",
      min: 500,
      max: 3000,
      sort: "price-asc",
      page: 2,
    });
  });

  it("falls back to defaults on garbage instead of throwing", () => {
    expect(
      parseCatalogSearchParams({
        sort: "DROP TABLE",
        page: "-4",
        min: "abc",
        collection: "Not A Slug!",
      }),
    ).toEqual({
      sort: "featured",
      page: 1,
    });
  });

  it("swaps inverted price bounds", () => {
    expect(parseCatalogSearchParams({ min: "3000", max: "500" })).toMatchObject({
      min: 500,
      max: 3000,
    });
  });

  it("takes the first value of repeated params", () => {
    expect(parseCatalogSearchParams({ q: ["orchid", "rose"] })).toMatchObject({
      q: "orchid",
    });
  });
});

describe("buildCatalogHref", () => {
  it("omits defaults so URLs stay clean", () => {
    expect(buildCatalogHref({ sort: "featured", page: 1 })).toBe("/shop");
  });

  it("encodes active filters", () => {
    expect(
      buildCatalogHref({
        q: "baby's breath",
        collection: "everyday-blooms",
        min: 100,
        sort: "newest",
        page: 3,
      }),
    ).toBe(
      "/shop?q=baby%27s+breath&collection=everyday-blooms&min=100&sort=newest&page=3",
    );
  });

  it("supports a base path for collection pages", () => {
    expect(buildCatalogHref({ occasion: "sympathy" }, "/collections/arrangements")).toBe(
      "/collections/arrangements?occasion=sympathy",
    );
  });
});
