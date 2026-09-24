import { Card, Stack, Text } from "@sanity/ui";
import { useEffect, useState } from "react";
import type { UserViewComponent } from "sanity/structure";

type BlogDocument = {
  _rev?: string;
  title?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: { asset?: unknown };
  image?: { asset?: unknown };
  seoNoIndex?: boolean;
  seoHideFromLists?: boolean;
  slug?: { current?: string };
};

type AlgoliaRecord = {
  objectID: string;
  title?: string;
  slug?: string;
};

type IndexResult =
  | { status: "loading" }
  | { status: "found"; record: AlgoliaRecord }
  | { status: "missing" }
  | { status: "error" }
  | { status: "unconfigured" };

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

export const SeoIndexView: UserViewComponent = ({
  document,
  documentId,
}) => {
  const blog = document.displayed as BlogDocument | null;
  const published = document.published as BlogDocument | null;

  // Sanity draft IDs start with "drafts."; Algolia stores the published ID.
  const objectID = documentId.replace(/^drafts\./, "");
  const publishedRevision = published?._rev;
  const [indexResult, setIndexResult] = useState<IndexResult>({
    status: "loading",
  });

  useEffect(() => {
    const appId = process.env.SANITY_STUDIO_ALGOLIA_APPLICATION_ID;
    const indexName = process.env.SANITY_STUDIO_ALGOLIA_INDEX_NAME;
    const searchKey = process.env.SANITY_STUDIO_ALGOLIA_SEARCH_API_KEY;

    if (!appId || !indexName || !searchKey) {
      setIndexResult({ status: "unconfigured" });
      return;
    }

    const controller = new AbortController();
    setIndexResult({ status: "loading" });

    const url =
      `https://${appId}-dsn.algolia.net/1/indexes/` +
      `${encodeURIComponent(indexName)}/${encodeURIComponent(objectID)}`;

    async function lookUpRecord() {
      try {
        const response = await fetch(url, {
          headers: {
            "x-algolia-application-id": appId!,
            "x-algolia-api-key": searchKey!,
          },
          signal: controller.signal,
        });

        if (response.status === 404) {
          setIndexResult({ status: "missing" });
          return;
        }

        if (!response.ok) {
          setIndexResult({ status: "error" });
          return;
        }

        const record = (await response.json()) as AlgoliaRecord;
        setIndexResult({ status: "found", record });
      } catch {
        if (!controller.signal.aborted) {
          setIndexResult({ status: "error" });
        }
      }
    }

    void lookUpRecord();
    return () => controller.abort();
  }, [objectID, publishedRevision]);

  if (!blog) {
    return (
      <Card padding={4}>
        <Text>Document is loading…</Text>
      </Card>
    );
  }

  const title = blog.seoTitle?.trim() || blog.title?.trim() || "";
  const description =
    blog.seoDescription?.trim() || blog.description?.trim() || "";
  const slug = blog.slug?.current || "";
  const siteUrl = (
    process.env.SANITY_STUDIO_PRESENTATION_URL || "http://localhost:3000"
  ).replace(/\/$/, "");
  const path = slug.startsWith("/") ? slug : `/blog/${slug}`;
  const previewUrl = slug
    ? `${siteUrl}${path}`
    : "Add a slug to preview the URL";

  const hasImage = Boolean(blog.seoImage?.asset || blog.image?.asset);

  let indexMessage: string;

  if (indexResult.status === "unconfigured") {
    indexMessage = "Algolia search-only configuration is missing.";
  } else if (indexResult.status === "loading") {
    indexMessage = "Checking Algolia…";
  } else if (indexResult.status === "error") {
    indexMessage = "Could not check Algolia. Try reopening this tab.";
  } else if (indexResult.status === "missing") {
    indexMessage = published
      ? "✗ Published post is missing from Algolia."
      : "✓ Unpublished post is not in Algolia.";
  } else if (!published) {
    indexMessage = "✗ Unpublished post is unexpectedly in Algolia.";
  } else if (published.seoHideFromLists) {
    indexMessage = "✗ Hidden post is unexpectedly in Algolia.";
  } else if (published.seoNoIndex) {
    indexMessage = "⚠ SEO noindex is set, but this post is in Algolia.";
  } else if (
    indexResult.record.title !== published.title ||
    indexResult.record.slug !== published.slug?.current
  ) {
    indexMessage = "⚠ Algolia has this post, but its title or slug is stale.";
  } else {
    indexMessage = "✓ Published post is present in Algolia.";
  }

  return (
    <Card padding={4}>
      <Stack gap={5}>
        <Stack gap={3}>
          <Text size={2} weight="semibold">
            Search preview
          </Text>
          <Card padding={3} border radius={2}>
            <Stack gap={3}>
              <Text size={1} muted>
                {previewUrl}
              </Text>
              <Text size={2} weight="semibold">
                {truncate(title, 60) || "Add a title"}
              </Text>
              <Text size={1}>
                {truncate(description, 160) || "Add a description"}
              </Text>
            </Stack>
          </Card>
        </Stack>

        <Stack gap={3}>
          <Text size={2} weight="semibold">
            Checks
          </Text>
          <Text>
            {title ? "✓" : "✗"} Meta title: {title.length} characters
            {blog.seoTitle ? " (SEO override)" : " (post title)"}
          </Text>
          <Text>
            {description.length >= 140 && description.length <= 160
              ? "✓"
              : "✗"}{" "}
            Description: {description.length} characters (target: 140–160)
            {blog.seoDescription
              ? " (SEO override)"
              : " (post description)"}
          </Text>
          <Text>{hasImage ? "✓ Image set" : "✗ No image set"}</Text>
          <Text>
            {blog.seoNoIndex
              ? "✗ Search engine indexing disabled (seoNoIndex)"
              : "✓ Search engine indexing allowed"}
          </Text>
        </Stack>

        <Stack gap={3}>
          <Text size={2} weight="semibold">
            Search index
          </Text>
          <Text>{indexMessage}</Text>
          <Text size={1} muted>
            Algolia object ID: {objectID}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
};