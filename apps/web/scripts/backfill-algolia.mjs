import { createClient } from "@sanity/client";
import { algoliasearch } from "algoliasearch";

const required = [
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  "NEXT_PUBLIC_SANITY_DATASET",
  "ALGOLIA_APPLICATION_ID",
  "ALGOLIA_WRITE_API_KEY",
  "ALGOLIA_INDEX_NAME",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-02-19",
  token: process.env.SANITY_API_READ_TOKEN,
  perspective: "published",
  useCdn: false,
});

const blogs = await sanity.fetch(`
  *[_type == "blog" && defined(slug.current) && seoHideFromLists != true]{
    "objectID": _id,
    title,
    description,
    "slug": slug.current,
    category,
    publishedAt,
    "author": authors[0]->name,
    "content": pt::text(richText)
  }
`);

if (blogs.length === 0) throw new Error("No published blogs found");

const algolia = algoliasearch(
  process.env.ALGOLIA_APPLICATION_ID,
  process.env.ALGOLIA_WRITE_API_KEY
);

await algolia.saveObjects({
  indexName: process.env.ALGOLIA_INDEX_NAME,
  objects: blogs,
  waitForTasks: true,
});

console.log(`Indexed ${blogs.length} published blogs`);