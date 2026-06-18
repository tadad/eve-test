import { Webhook } from "svix";
import { describe, expect, it, vi } from "vitest";

import { agentMailChannel, createAgentMailChannelEvents } from "../src/agentMailChannel.js";
import {
  agentmailContinuationToken,
  parseAgentmailContinuationToken,
} from "../src/continuationToken.js";
import { formatInboundAgentMailMessage } from "../src/formatInbound.js";
import type { AgentMailChannelState, AgentMailClientLike } from "../src/types.js";
import { verifyAgentMailWebhook } from "../src/verifyWebhook.js";

const WEBHOOK_SECRET = `whsec_${Buffer.from("test-secret").toString("base64")}`;

describe("agentmailContinuationToken", () => {
  it("round trips inbox and thread identifiers", () => {
    const token = agentmailContinuationToken("agent+sales@example.com", "thread:123");

    expect(parseAgentmailContinuationToken(token)).toEqual({
      inboxId: "agent+sales@example.com",
      threadId: "thread:123",
    });
  });
});

describe("verifyAgentMailWebhook", () => {
  it("verifies the signed raw body", () => {
    const body = JSON.stringify(receivedEvent({ text: "raw body text" }), null, 2);
    const request = signedRequest(body);

    expect(verifyAgentMailWebhook(body, request.headers, WEBHOOK_SECRET)).toMatchObject({
      event_id: "evt_123",
      event_type: "message.received",
    });
  });
});

describe("agentMailChannel route", () => {
  it("acknowledges and ignores non-message events", async () => {
    const channel = agentMailChannel({
      client: mockClient(),
      webhookSecret: WEBHOOK_SECRET,
    });
    const send = vi.fn();
    const waitUntilTasks: Promise<unknown>[] = [];
    const response = await postRoute(channel).handler(
      signedRequest(JSON.stringify({ event_id: "evt_domain", event_type: "domain.verified" })),
      routeArgs(send, waitUntilTasks),
    );

    expect(response.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
    expect(waitUntilTasks).toHaveLength(0);
  });

  it("dispatches message.received with content, auth, token, and state", async () => {
    const channel = agentMailChannel({
      client: mockClient(),
      webhookSecret: WEBHOOK_SECRET,
    });
    const send = vi.fn(async () => ({ id: "session_123" }));
    const waitUntilTasks: Promise<unknown>[] = [];
    const response = await postRoute(channel).handler(
      signedRequest(JSON.stringify(receivedEvent({ text: "Hello from email" }))),
      routeArgs(send, waitUntilTasks),
    );

    expect(response.status).toBe(204);
    await Promise.all(waitUntilTasks);

    expect(send).toHaveBeenCalledWith("Hello from email", {
      auth: {
        attributes: expect.objectContaining({
          eventId: "evt_123",
          eventType: "message.received",
          inboxId: "inbox_456",
          messageId: "<msg_123@agentmail.to>",
          threadId: "thread_789",
        }),
        authenticator: "agentmail",
        principalId: "jane@example.com",
        principalType: "user",
      },
      continuationToken: agentmailContinuationToken("inbox_456", "thread_789"),
      state: {
        eventId: "evt_123",
        eventType: "message.received",
        from: "Jane Doe <jane@example.com>",
        inboxId: "inbox_456",
        labels: ["received"],
        lastMessageId: "<msg_123@agentmail.to>",
        subject: "Question",
        threadId: "thread_789",
        to: ["Support <support@example.com>"],
      },
    });
  });

  it("uses HTML as a text fallback for HTML-only inbound mail", () => {
    const formatted = formatInboundAgentMailMessage(
      receivedEvent({
        html: "<html><body><p>Hello <strong>Agent</strong></p><p>Second&nbsp;line</p></body></html>",
        preview: "fallback preview",
        text: undefined,
      }),
    );

    expect(formatted?.content).toBe("Hello Agent\nSecond line");
  });
});

describe("agentMailChannel events", () => {
  it("replies through AgentMail on message.completed", async () => {
    const client = mockClient();

    await emitChannelEvent(client, true, "message.completed", {
      finishReason: "stop",
      message: "Agent reply",
      sequence: 0,
      stepIndex: 0,
      turnId: "turn_123",
    });

    expect(client.inboxes.messages.reply).toHaveBeenCalledWith("inbox_456", "<msg_123@agentmail.to>", {
      html: undefined,
      text: "Agent reply",
    });
  });

  it("does not reply on intermediate tool-call message completions", async () => {
    const client = mockClient();

    await emitChannelEvent(client, true, "message.completed", {
      finishReason: "tool-calls",
      message: "I will check that.",
      sequence: 0,
      stepIndex: 0,
      turnId: "turn_123",
    });

    expect(client.inboxes.messages.reply).not.toHaveBeenCalled();
  });

  it("sends failure replies only when enabled", async () => {
    const enabledClient = mockClient();

    await emitChannelEvent(enabledClient, true, "turn.failed", {
      code: "internal_error",
      details: {},
      message: "boom",
      sequence: 0,
      turnId: "turn_123",
    });

    expect(enabledClient.inboxes.messages.reply).toHaveBeenCalledTimes(1);

    const disabledClient = mockClient();

    await emitChannelEvent(disabledClient, false, "turn.failed", {
      code: "internal_error",
      details: {},
      message: "boom",
      sequence: 0,
      turnId: "turn_123",
    });

    expect(disabledClient.inboxes.messages.reply).not.toHaveBeenCalled();
  });
});

function receivedEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "evt_123",
    event_type: "message.received",
    message: {
      from: "Jane Doe <jane@example.com>",
      inbox_id: "inbox_456",
      labels: ["received"],
      message_id: "<msg_123@agentmail.to>",
      preview: "Preview",
      subject: "Question",
      text: "Hello",
      thread_id: "thread_789",
      to: ["Support <support@example.com>"],
      ...overrides,
    },
    type: "event",
  };
}

function signedRequest(body: string): Request {
  const webhook = new Webhook(WEBHOOK_SECRET);
  const id = `msg_${crypto.randomUUID()}`;
  const timestamp = new Date();

  return new Request("https://eve.test/webhook", {
    body,
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-signature": webhook.sign(id, timestamp, body),
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    },
    method: "POST",
  });
}

function postRoute(channel: ReturnType<typeof agentMailChannel>) {
  const route = channel.routes.find((route) => route.method === "POST");
  if (!route || route.transport === "websocket") {
    throw new Error("Missing POST route.");
  }
  return route;
}

function routeArgs(send: unknown, waitUntilTasks: Promise<unknown>[]) {
  return {
    getSession: vi.fn(),
    params: {},
    receive: vi.fn(),
    requestIp: null,
    send,
    waitUntil(task: Promise<unknown>) {
      waitUntilTasks.push(task);
    },
  } as never;
}

function mockClient(): AgentMailClientLike {
  return {
    inboxes: {
      messages: {
        reply: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
      },
    },
  };
}

function state(): AgentMailChannelState {
  return {
    eventId: "evt_123",
    eventType: "message.received",
    from: "Jane Doe <jane@example.com>",
    inboxId: "inbox_456",
    labels: ["received"],
    lastMessageId: "<msg_123@agentmail.to>",
    subject: "Question",
    threadId: "thread_789",
    to: ["Support <support@example.com>"],
  };
}

async function emitChannelEvent(
  client: AgentMailClientLike,
  sendFailureReplies: boolean,
  eventName: string,
  data: unknown,
): Promise<void> {
  const events = createAgentMailChannelEvents();
  const handler = events[eventName as keyof typeof events];
  if (typeof handler !== "function") {
    throw new Error(`Missing channel event handler: ${eventName}`);
  }

  await (handler as (data: unknown, channel: unknown, ctx?: unknown) => Promise<void>)(data, {
    client,
    renderReply: (messageText: string) => ({ text: messageText }),
    replyMode: "reply",
    sendFailureReplies,
    session: {
      continuationToken: agentmailContinuationToken("inbox_456", "thread_789"),
      setContinuationToken: vi.fn(),
    },
    state: state(),
  });
}
