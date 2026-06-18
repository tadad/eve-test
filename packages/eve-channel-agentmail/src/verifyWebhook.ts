import { Webhook } from "svix";

import type { AgentMailWebhookPayload } from "./types.js";

export function verifyAgentMailWebhook(
  rawBody: string | Buffer,
  headers: Headers,
  secret: string,
): AgentMailWebhookPayload {
  const webhook = new Webhook(secret);
  const payload = webhook.verify(rawBody, {
    "svix-id": requiredHeader(headers, "svix-id"),
    "svix-signature": requiredHeader(headers, "svix-signature"),
    "svix-timestamp": requiredHeader(headers, "svix-timestamp"),
  });

  if (!isRecord(payload)) {
    throw new Error("AgentMail webhook payload must be an object.");
  }

  return payload as AgentMailWebhookPayload;
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (!value) {
    throw new Error(`Missing required AgentMail webhook header: ${name}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
