import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useDebounce } from "@/hooks/use-debounce";
import type { Blog } from "@/types";

const SEARCH_DEBOUNCE_MS = 400;
const CACHE_STALE_TIME_MS = 30_000;

type SearchResponse = {
  results: Blog[];
  page: number;
  totalPages: number;
  totalHits: number;
};

async function searchBlog(
  query: string,
  category: string,
  page: number,
  signal: AbortSignal
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
  });

  if (category) {
    params.set("category", category);
  }

  const response = await fetch(`/api/blog/search?${params}`, { signal });

  if (!response.ok) {
    throw new Error("Failed to search");
  }

  return response.json() as Promise<SearchResponse>;
}

export function useBlogSearch(category: string) {
  const [searchQuery, updateSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setPage(1);
  }, [category]);

  function setSearchQuery(query: string) {
    updateSearchQuery(query);
    setPage(1);
  }

  const hasQuery = debouncedQuery.trim().length > 0;

  const { data, isLoading, error } = useQuery({
    queryKey: ["blog-search", debouncedQuery, category, page],
    queryFn: ({ signal }) => searchBlog(debouncedQuery, category, page, signal),
    enabled: hasQuery,
    staleTime: CACHE_STALE_TIME_MS,
  });

  return {
    searchQuery,
    setSearchQuery,
    results: data?.results ?? [],
    isSearching: isLoading,
    error,
    hasQuery,
    page,
    setPage,
    totalPages: data?.totalPages ?? 0,
    totalHits: data?.totalHits ?? 0,
  };
}