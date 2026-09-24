import { createHash } from "node:crypto";

import { env } from "@workspace/env/server";
import { client } from "@workspace/sanity/client";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;
const MAX_BODY_LENGTH = 2_048;
const requestsByIp = new Map<string, number[]>();

function rateLimited(request: Request): boolean {
  const ip =
    request.headers
      .get("x-vercel-forwarded-for")
      ?.split(",")[0]
      ?.trim() ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";

  const now = Date.now();
  const recent = (requestsByIp.get(ip) ?? []).filter(
    (time) => now - time < WINDOW_MS
  );

  if (recent.length >= MAX_REQUESTS) {
    requestsByIp.set(ip, recent);
    return true;
  }

  recent.push(now);
  requestsByIp.set(ip, recent);
  return false;
}

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return Response.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const body = await request.text();

  if (body.length > MAX_BODY_LENGTH) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  let email: unknown;

  try {
    if (contentType.includes("application/json")) {
      email = (JSON.parse(body) as { email?: unknown }).email;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      email = new URLSearchParams(body).get("email");
    } else {
      return Response.json(
        { error: "Unsupported content type." },
        { status: 415 }
      );
    }
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof email !== "string") {
    return Response.json({ error: "Invalid email." }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return Response.json({ error: "Invalid email." }, { status: 400 });
  }

  const id = `subscriber.${createHash("sha256")
    .update(normalizedEmail)
    .digest("hex")}`;

  try {
    const writeClient = client.withConfig({
      token: env.SANITY_API_WRITE_TOKEN,
      useCdn: false,
    });

    await writeClient.createIfNotExists({
      _id: id,
      _type: "subscriber",
      email: normalizedEmail,
      subscribedAt: new Date().toISOString(),
    });

    return Response.json({ message: "You're subscribed." });
  } catch (error) {
    console.error("Newsletter signup failed", error);
    return Response.json(
      { error: "Could not subscribe. Please try again." },
      { status: 503 }
    );
  }
}