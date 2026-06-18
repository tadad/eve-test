import type {
  AgentMailAuthContext,
  AgentMailChannelState,
  AgentMailInboundMessage,
  AgentMailWebhookPayload,
} from "./types.js";

export function formatInboundAgentMailMessage(
  payload: AgentMailWebhookPayload,
): AgentMailInboundMessage | null {
  if (!isRecord(payload.message)) {
    return null;
  }

  const message = payload.message;
  const inboxId = stringValue(message.inbox_id ?? message.inboxId);
  const threadId = stringValue(message.thread_id ?? message.threadId);
  const messageId = stringValue(message.message_id ?? message.messageId);
  const eventId = stringValue(payload.event_id ?? payload.eventId);
  const eventType = stringValue(payload.event_type ?? payload.eventType);

  if (!inboxId || !threadId || !messageId || !eventId || !eventType) {
    return null;
  }

  const from = addressValue(message.from) ?? "";
  const to = addressListValue(message.to);
  const subject = stringValue(message.subject);
  const labels = stringListValue(message.labels);
  const content = firstNonEmptyString([
    message.extracted_text,
    message.extractedText,
    message.text,
    htmlToText(stringValue(message.html)),
    message.preview,
  ]);

  return {
    content: content ?? "",
    eventId,
    eventType,
    from,
    inboxId,
    labels,
    messageId,
    subject,
    threadId,
    to,
  };
}

export function buildAgentMailChannelState(
  message: AgentMailInboundMessage,
): AgentMailChannelState {
  return {
    eventId: message.eventId,
    eventType: message.eventType,
    from: message.from,
    inboxId: message.inboxId,
    labels: message.labels,
    lastMessageId: message.messageId,
    subject: message.subject,
    threadId: message.threadId,
    to: message.to,
  };
}

export function buildAgentMailAuth(message: AgentMailInboundMessage): AgentMailAuthContext {
  const principalId = extractEmailAddress(message.from) ?? (message.from || "unknown");
  return {
    attributes: {
      eventId: message.eventId,
      eventType: message.eventType,
      from: message.from,
      inboxId: message.inboxId,
      labels: message.labels,
      messageId: message.messageId,
      subject: message.subject ?? "",
      threadId: message.threadId,
      to: message.to,
    },
    authenticator: "agentmail",
    principalId,
    principalType: "user",
  };
}

export function htmlToText(html: string | null): string | null {
  if (!html) {
    return null;
  }

  const withoutUnsafeBlocks = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ");

  const withBreaks = withoutUnsafeBlocks
    .replace(/<(br|hr)\b[^>]*\/?>/giu, "\n")
    .replace(/<\/(p|div|section|article|header|footer|li|tr|h[1-6])>/giu, "\n")
    .replace(/<li\b[^>]*>/giu, "\n- ");

  const withoutTags = withBreaks.replace(/<[^>]+>/gu, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  return normalizeWhitespace(decoded) || null;
}

function firstNonEmptyString(values: readonly unknown[]): string | null {
  for (const value of values) {
    const text = typeof value === "string" ? normalizeWhitespace(value) : "";
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t\f\v]+/gu, " ")
    .replace(/ *\n+ */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&#(\d+);/gu, (_match, code: string) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    })
    .replace(/&#x([\da-f]+);/giu, (_match, code: string) => {
      const value = Number.parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    });
}

function addressListValue(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map(addressValue).filter((item): item is string => item !== null);
  }

  const single = addressValue(value);
  return single ? [single] : [];
}

function stringListValue(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return [value];
  }

  return [];
}

function addressValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  const email = stringValue(value.email ?? value.address);
  const name = stringValue(value.name ?? value.displayName);
  if (name && email) {
    return `${name} <${email}>`;
  }

  return email ?? name;
}

function extractEmailAddress(value: string): string | null {
  const bracketed = /<([^<>@\s]+@[^<>\s]+)>/u.exec(value);
  if (bracketed?.[1]) {
    return bracketed[1];
  }

  const bare = /[^\s<>@]+@[^\s<>@]+/u.exec(value);
  return bare?.[0] ?? null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
