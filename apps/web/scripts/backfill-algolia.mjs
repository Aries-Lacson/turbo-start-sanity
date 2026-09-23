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
    _id,
    _type,
    title,
    description,
    "slug": slug.current,
    orderRank,
    category,
    publishedAt,
    image {
      "id": asset._ref,
      "preview": asset->metadata.lqip,
      "alt": coalesce(alt, asset->altText, caption, asset->originalFilename, "untitled"),
      hotspot { x, y },
      crop { bottom, left, right, top }
    },
    authors[0]->{
      _id,
      name,
      position,
      image {
        "id": asset._ref,
        "preview": asset->metadata.lqip,
        "alt": coalesce(alt, asset->altText, caption, asset->originalFilename, "untitled"),
        hotspot { x, y },
        crop { bottom, left, right, top }
      }
    },
    "author": authors[0]->name,
    "content": pt::text(richText)
  }
`);

if (blogs.length === 0) throw new Error("No published blogs found");

const algolia = algoliasearch(
  process.env.ALGOLIA_APPLICATION_ID,
  process.env.ALGOLIA_WRITE_API_KEY
);

const indexName = process.env.ALGOLIA_INDEX_NAME;

const { taskID } = await algolia.setSettings({
  indexName,
  indexSettings: {
    searchableAttributes: ["title", "description", "content", "author"],
    attributesForFaceting: ["category"],
  },
});

console.log("Settings queued:", taskID);

const result = await algolia.saveObjects({
  indexName,
  objects: blogs,
  waitForTasks: false,
});

console.log(`Queued ${blogs.length} published blogs`);
console.log("Record task result:", result);