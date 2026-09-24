import {
  type DynamicFetchOptions,
  getDynamicFetchOptions,
  sanityFetch,
} from "@workspace/sanity/live";
import { queryAllBlogDataForSearch } from "@workspace/sanity/query";
import { env } from "@workspace/env/server";
import { algoliasearch } from "algoliasearch";
import Fuse from "fuse.js";
import { NextResponse } from "next/server";

const CATEGORIES = new Set([
  "aeo",
  "changelog",
  "nextjs",
  "sanity",
  "seo",
  "skills",
]);

async function getSearchableBlogs(
  perspective: DynamicFetchOptions["perspective"]
) {
  "use cache";
  const { data } = await sanityFetch({
    query: queryAllBlogDataForSearch,
    perspective,
    stega: false,
  });
  return data;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const pageParam = searchParams.get("page") ?? "1";
  const category = searchParams.get("category") ?? "all";

  if (!query || query.length > 120) {
    return NextResponse.json(
      { error: "Query must be 1–120 characters" },
      { status: 400 }
    );
  }

  if (!/^[1-9]\d*$/.test(pageParam) || Number(pageParam) > 100) {
    return NextResponse.json(
      { error: "Page must be between 1 and 100" },
      { status: 400 }
    );
  }

  if (category !== "all" && !CATEGORIES.has(category)) {
    return NextResponse.json(
      { error: "Invalid category" },
      { status: 400 }
    );
  }

  const { perspective } = await getDynamicFetchOptions();

  if (perspective === "published") {
    const { ALGOLIA_APPLICATION_ID, ALGOLIA_INDEX_NAME, ALGOLIA_SEARCH_API_KEY } =
      env;

    if (!ALGOLIA_APPLICATION_ID || !ALGOLIA_INDEX_NAME || !ALGOLIA_SEARCH_API_KEY) {
      return NextResponse.json(
        { error: "Search is not configured" },
        { status: 503 }
      );
    }

    try {
      const algolia = algoliasearch(
        ALGOLIA_APPLICATION_ID,
        ALGOLIA_SEARCH_API_KEY
      );
      const { hits, nbPages, nbHits } = await algolia.searchSingleIndex({
        indexName: ALGOLIA_INDEX_NAME,
        searchParams: {
          query,
          page: Number(pageParam) - 1,
          hitsPerPage: 10,
          ...(category === "all" ? {} : { filters: `category:${category}` }),
        },
      });

      return NextResponse.json({
        results: hits,
        page: Number(pageParam),
        totalPages: nbPages,
        totalHits: nbHits,
      });
    } catch (error) {
      console.error("Blog search failed", error);
      return NextResponse.json(
        { error: "Search is temporarily unavailable" },
        { status: 503 }
      );
    }
  }

  const data = await getSearchableBlogs(perspective);
  if (!data) {
    return NextResponse.json({ error: "No data found" }, { status: 404 });
  }

  const fuse = new Fuse(data, {
    keys: ["title", "description", "slug", "authors.name"],
    threshold: 0.3,
  });

  const results = fuse.search(query).map((result) => result.item);
  const page = Number(pageParam);

  return NextResponse.json({
    results: results.slice((page - 1) * 10, page * 10),
    page,
    totalPages: Math.ceil(results.length / 10),
    totalHits: results.length,
  });
}