import { env } from "@workspace/env/server";
import { client } from "@workspace/sanity/client";
import { algoliasearch } from "algoliasearch";
import { parseBody } from "next-sanity/webhook";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  const logTiming = (
    stage: string,
    details: Record<string, unknown> = {}
  ) => {
    console.info("Algolia sync", {
      requestId,
      stage,
      elapsedMs: Date.now() - startedAt,
      ...details,
    });
  };

  const secret = env.SANITY_ALGOLIA_WEBHOOK_SECRET;
  const appId = env.ALGOLIA_APPLICATION_ID;
  const writeKey = env.ALGOLIA_WRITE_API_KEY;
  const indexName = env.ALGOLIA_INDEX_NAME;

  if (!secret || !appId || !writeKey || !indexName) {
    return new Response("Sync is not configured", { status: 503 });
  }

  try {
    logTiming("request received");

    const { isValidSignature } = await parseBody(request, secret, true);

    if (!isValidSignature) {
      return new Response("Unauthorized", { status: 401 });
    }

    logTiming("webhook parsed");

    const id = request.headers.get("sanity-document-id");
    const dataset = request.headers.get("sanity-dataset");
    const projectId = request.headers.get("sanity-project-id");

    if (
      !id ||
      dataset !== process.env.NEXT_PUBLIC_SANITY_DATASET ||
      projectId !== process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    ) {
      return new Response("Invalid document source", { status: 400 });
    }

    if (id.startsWith("drafts.") || id.startsWith("versions.")) {
      return Response.json({ ignored: true });
    }

    const publishedClient = client.withConfig({
      perspective: "published",
      useCdn: false,
      token: env.SANITY_API_READ_TOKEN,
      stega: { enabled: false },
    });

    const blog = await publishedClient.fetch(
      `*[_id == $id && _type == "blog" &&
         defined(slug.current) && seoHideFromLists != true][0]{
        "objectID": _id,
        title,
        description,
        "slug": slug.current,
        category,
        publishedAt,
        "author": authors[0]->name,
        "content": pt::text(richText)
      }`,
      { id },
      { cache: "no-store" }
    );

    logTiming("Sanity fetched", { id, found: Boolean(blog) });

    const algolia = algoliasearch(appId, writeKey);

    if (blog) {
      const { taskID } = await algolia.saveObject({
        indexName,
        body: blog,
      });

      logTiming("indexing queued", { id, taskID });

      await algolia.waitForTask({ indexName, taskID });

      logTiming("indexing completed", { id, taskID });

      return Response.json({ action: "saved", id, taskID });
    }

    const { taskID } = await algolia.deleteObject({
      indexName,
      objectID: id,
    });

    logTiming("deletion queued", { id, taskID });

    await algolia.waitForTask({ indexName, taskID });

    logTiming("deletion completed", { id, taskID });

    return Response.json({ action: "deleted", id, taskID });
  } catch (error) {
    console.error("Algolia sync failed", {
      requestId,
      elapsedMs: Date.now() - startedAt,
      error,
    });

    return new Response("Sync failed", { status: 500 });
  }
}