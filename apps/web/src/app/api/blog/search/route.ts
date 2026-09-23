import {
  type DynamicFetchOptions,
  getDynamicFetchOptions,
  sanityFetch,
} from "@workspace/sanity/live";
import { queryAllBlogDataForSearch } from "@workspace/sanity/query";
import Fuse from "fuse.js";
import { NextResponse } from "next/server";
import { algoliasearch } from "algoliasearch";
import { env } from "@workspace/env/server";

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
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const { perspective } = await getDynamicFetchOptions();
  const data = await getSearchableBlogs(perspective);

  if (!data) {
    return NextResponse.json({ error: "No data found" }, { status: 404 });
  }

  if (perspective === "published") {
    const appId = env.ALGOLIA_APPLICATION_ID;
    const indexName = env.ALGOLIA_INDEX_NAME;
    const apiKey = env.ALGOLIA_WRITE_API_KEY;

    if (!appId || !indexName || !apiKey) {
      return NextResponse.json(
        { error: "Search is not configured" },
        { status: 503 }
      );
    }

    const algolia = algoliasearch(appId, apiKey);
    const { hits } = await algolia.searchSingleIndex({
      indexName,
      searchParams: {
        query: query.trim(),
        hitsPerPage: 10,
      },
    });

    const blogsById = new Map(data.map((blog) => [blog._id, blog]));

    return NextResponse.json(
      hits
        .map((hit) => blogsById.get(hit.objectID))
        .filter((blog) => blog !== undefined)
    );
  }

  const fuse = new Fuse(data, {
    keys: ["title", "description", "slug", "authors.name"],
    threshold: 0.3,
  });

  const results = fuse.search(query, {
    limit: 10,
  });
  return NextResponse.json(results.map((result) => result.item));
}
