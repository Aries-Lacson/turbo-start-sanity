import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useDebounce } from "@/hooks/use-debounce";
import type { Blog } from "@/types";

const SEARCH_DEBOUNCE_MS = 400;
const CACHE_STALE_TIME_MS = 30_000;

async function searchBlog(
  query: string,
  category: string,
  signal: AbortSignal
) {
  if (!query.trim()) {
    return [];
  }

  const params = new URLSearchParams({ q: query });

  if (category) {
    params.set("category", category);
  }

  const response = await fetch(`/api/blog/search?${params}`, { signal });

  if (!response.ok) {
    throw new Error("Failed to search");
  }

  return response.json() as Promise<Blog[]>;
}

export function useBlogSearch(category: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const hasQuery = debouncedQuery.trim().length > 0;

  const { data, isLoading, error } = useQuery({
    queryKey: ["blog-search", debouncedQuery, category],
    queryFn: ({ signal }) => searchBlog(debouncedQuery, category, signal),
    enabled: hasQuery,
    staleTime: CACHE_STALE_TIME_MS,
  });

  return {
    searchQuery,
    setSearchQuery,
    results: data ?? [],
    isSearching: isLoading,
    error,
    hasQuery,
  };
}