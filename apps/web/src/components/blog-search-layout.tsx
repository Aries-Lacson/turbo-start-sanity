"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { useEffect, useState, type ReactNode } from "react";

import { SearchInput } from "@/components/blog-search";
import { BlogSearchResults } from "@/components/blog-search-results";
import { useBlogSearch } from "@/hooks/use-blog-search";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";

type BlogSearchLayoutProps = {
  activeCategory: string;
  categoryFilter: ReactNode;
  featured: ReactNode;
  list: ReactNode;
};

export function BlogSearchLayout({
  activeCategory,
  categoryFilter,
  featured,
  list,
}: Readonly<BlogSearchLayoutProps>) {
  const [searchCategory, setSearchCategory] = useState(activeCategory);

  useEffect(() => {
    setSearchCategory(activeCategory);
  }, [activeCategory]);

  const { searchQuery, setSearchQuery, results, isSearching, hasQuery, error } =
    useBlogSearch(searchCategory);

  function clearSearch() {
    setSearchQuery("");
    setSearchCategory(activeCategory);
  }

  const isDeadEnd =
    hasQuery && !isSearching && (Boolean(error) || results.length === 0);

  const searchStatus = (() => {
    if (!hasQuery) {
      return "";
    }
    if (isSearching) {
      return "Searching…";
    }
    if (error) {
      return "Search failed";
    }
    if (results.length === 0) {
      return `No articles found for ${searchQuery}`;
    }
    const plural = results.length === 1 ? "" : "s";
    return `${results.length} article${plural} found for ${searchQuery}`;
  })();

  return (
    <>
      {featured && !hasQuery ? (
        <section aria-label="Featured posts" className="mt-10 grid gap-8">
          {featured}
        </section>
      ) : null}

      <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="h-max bg-grid-dots p-4 text-zinc-800 lg:sticky lg:top-24 lg:self-start dark:text-zinc-50">
          <div className="flex flex-col gap-6 bg-background p-4">
            <SearchInput
              className="max-w-none"
              onChange={setSearchQuery}
              onClear={clearSearch}
              placeholder="Search…"
              value={searchQuery}
            />

            {hasQuery ? (
              <nav
                aria-label="Filter search results by category"
                className="grid gap-2"
              >
                {BLOG_CATEGORIES.map(({ label, value }) => (
                  <button
                    key={value || "all"}
                    type="button"
                    aria-pressed={searchCategory === value}
                    onClick={() => setSearchCategory(value)}
                    className={cn(
                      "focus-ring w-max px-1 py-px text-left font-mono text-sm uppercase",
                      searchCategory === value
                        ? "bg-accent-green text-accent-green-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            ) : (
              categoryFilter
            )}
          </div>
        </aside>

        <div
          className={cn(
            "grid text-foreground",
            isDeadEnd ? "lg:h-0 lg:min-h-full" : "content-start"
          )}
        >
          <output className="sr-only">{searchStatus}</output>

          {hasQuery ? (
            <BlogSearchResults
              error={error}
              hasQuery={hasQuery}
              isSearching={isSearching}
              onClear={clearSearch}
              results={results}
              searchQuery={searchQuery}
            />
          ) : (
            list
          )}
        </div>
      </div>
    </>
  );
}