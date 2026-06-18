import { AgentMailClient } from "agentmail";
import { defineChannel, POST, type ChannelEvents } from "eve/channels";

import { agentmailContinuationToken } from "./continuationToken.js";
import {
  buildAgentMailAuth,
  buildAgentMailChannelState,
  formatInboundAgentMailMessage,
} from "./formatInbound.js";
import { renderPlainTextReply } from "./renderReply.js";
import {
  DEFAULT_ACCEPTED_EVENT_TYPES,
  DEFAULT_AGENTMAIL_ROUTE,
  type AgentMailChannelConfig,
  type AgentMailChannelMetadata,
  type AgentMailChannelState,
  type AgentMailClientLike,
  type AgentMailReplyRenderer,
} from "./types.js";
import { verifyAgentMailWebhook } from "./verifyWebhook.js";

interface AgentMailEventContext {
  client: AgentMailClientLike;
  renderReply: AgentMailReplyRenderer;
  replyMode: "reply" | "none";
  sendFailureReplies: boolean;
  state: AgentMailChannelState;
}

const EMPTY_STATE: AgentMailChannelState = {
  eventId: null,
  eventType: null,
  from: null,
  inboxId: null,
  labels: [],
  lastMessageId: null,
  subject: null,
  threadId: null,
  to: [],
};

export function agentMailChannel(config: AgentMailChannelConfig = {}) {
  const route = config.route ?? DEFAULT_AGENTMAIL_ROUTE;
  const acceptedEventTypes = new Set(config.acceptedEventTypes ?? DEFAULT_ACCEPTED_EVENT_TYPES);
  const replyMode = config.replyMode ?? "reply";
  const sendFailureReplies = config.sendFailureReplies ?? true;
  const renderReply = config.renderReply ?? renderPlainTextReply;
  const processedLabel = config.processedLabel ?? "eve-processed";
  const getClient = createClientResolver(config);
  const events = createAgentMailChannelEvents({
    failureReplyText: config.failureReplyText,
  });

  return defineChannel<
    AgentMailChannelState,
    AgentMailEventContext,
    Record<string, never>,
    AgentMailChannelMetadata
  >({
    kindHint: "agentmail",
    state: EMPTY_STATE,
    metadata(state) {
      return {
        eventId: state.eventId,
        eventType: state.eventType,
        from: state.from,
        inboxId: state.inboxId,
        labels: state.labels,
        messageId: state.lastMessageId,
        subject: state.subject,
        threadId: state.threadId,
        to: state.to,
      };
    },
    context(state) {
      return {
        get client() {
          return getClient();
        },
        renderReply,
        replyMode,
        sendFailureReplies,
        state,
      };
    },
    routes: [
      POST(route, async (req, { send, waitUntil }) => {
        const rawBody = await req.text();
        let payload;

        try {
          payload = verifyAgentMailWebhook(rawBody, req.headers, resolveWebhookSecret(config));
        } catch {
          return new Response("unauthorized", { status: 401 });
        }

        const eventType = typeof payload.event_type === "string" ? payload.event_type : "";
        if (!acceptedEventTypes.has(eventType)) {
          return new Response(null, { status: 204 });
        }

        const inbound = formatInboundAgentMailMessage(payload);
        if (!inbound) {
          return new Response("invalid AgentMail message event", { status: 400 });
        }

        waitUntil(
          (async () => {
            const state = buildAgentMailChannelState(inbound);
            await send(inbound.content, {
              auth: buildAgentMailAuth(inbound),
              continuationToken: agentmailContinuationToken(inbound.inboxId, inbound.threadId),
              state,
            });

            if (config.markProcessed) {
              await getClient().inboxes.messages.update?.(inbound.inboxId, inbound.messageId, {
                addLabels: [processedLabel],
              });
            }
          })(),
        );

        return new Response(null, { status: 204 });
      }),
    ],
    events,
  });
}

export function createAgentMailChannelEvents(options: {
  failureReplyText?: string;
} = {}): ChannelEvents<AgentMailEventContext> {
  return {
    async "message.completed"(event, channel) {
      if (event.finishReason === "tool-calls" || !event.message) {
        return;
      }

      await replyToLastInboundMessage(channel, event.message, {
        event: "message.completed",
        finishReason: event.finishReason,
        state: channel.state,
      });
    },
    async "turn.failed"(_event, channel) {
      if (!channel.sendFailureReplies) {
        return;
      }

      await replyToLastInboundMessage(
        channel,
        options.failureReplyText ?? "I hit an error while handling your email. Please reply again or try rephrasing your request.",
        {
          event: "turn.failed",
          state: channel.state,
        },
      );
    },
    async "session.failed"(_event, channel) {
      if (!channel.sendFailureReplies) {
        return;
      }

      await replyToLastInboundMessage(
        channel,
        options.failureReplyText ?? "I hit an unrecoverable error while handling this email thread. Please start a new email thread if you need to continue.",
        {
          event: "session.failed",
          state: channel.state,
        },
      );
    },
    async "input.requested"(event, channel) {
      if (event.requests.length === 0) {
        return;
      }

      const prompts = event.requests.map((request) => request.prompt.trim()).filter(Boolean);
      const text = [
        "I need more information before I can continue.",
        ...prompts,
        "Reply to this email with your answer.",
      ].join("\n\n");

      await replyToLastInboundMessage(channel, text, {
        event: "input.requested",
        state: channel.state,
      });
    },
  };
}

async function replyToLastInboundMessage(
  channel: AgentMailEventContext,
  messageText: string,
  context: Parameters<AgentMailReplyRenderer>[1],
): Promise<void> {
  if (channel.replyMode === "none") {
    return;
  }

  const { inboxId, lastMessageId } = channel.state;
  if (!inboxId || !lastMessageId) {
    return;
  }

  const reply = channel.renderReply(messageText, context);
  await channel.client.inboxes.messages.reply(inboxId, lastMessageId, {
    html: reply.html,
    text: reply.text,
  });
}

function resolveWebhookSecret(config: AgentMailChannelConfig): string {
  const secret = config.webhookSecret ?? process.env.AGENTMAIL_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing AgentMail webhook secret.");
  }
  return secret;
}

function createClientResolver(config: AgentMailChannelConfig): () => AgentMailClientLike {
  let client: AgentMailClientLike | undefined = config.client;

  return () => {
    if (client) {
      return client;
    }

    const apiKey = config.apiKey ?? process.env.AGENTMAIL_API_KEY;
    if (!apiKey) {
      throw new Error("Missing AgentMail API key.");
    }

    client = new AgentMailClient({ apiKey }) as AgentMailClientLike;
    return client;
  };
}
