export const DEFAULT_AGENTMAIL_ROUTE = "/webhook";

export const DEFAULT_ACCEPTED_EVENT_TYPES = ["message.received"] as const;

export const AGENTMAIL_RECEIVED_EVENT_TYPES = [
  "message.received",
  "message.received.spam",
  "message.received.blocked",
  "message.received.unauthenticated",
] as const;

export type AgentMailReceivedEventType = (typeof AGENTMAIL_RECEIVED_EVENT_TYPES)[number];

export interface AgentMailClientLike {
  inboxes: {
    messages: {
      reply(
        inboxId: string,
        messageId: string,
        request: {
          text?: string;
          html?: string;
          [key: string]: unknown;
        },
      ): Promise<unknown>;
      update?(
        inboxId: string,
        messageId: string,
        request: {
          addLabels?: string | string[];
          removeLabels?: string | string[];
          [key: string]: unknown;
        },
      ): Promise<unknown>;
    };
  };
}

export interface AgentMailChannelState {
  eventId: string | null;
  eventType: string | null;
  from: string | null;
  inboxId: string | null;
  labels: readonly string[];
  lastMessageId: string | null;
  subject: string | null;
  threadId: string | null;
  to: readonly string[];
}

export interface AgentMailChannelMetadata extends Record<string, unknown> {
  eventId: string | null;
  eventType: string | null;
  from: string | null;
  inboxId: string | null;
  labels: readonly string[];
  messageId: string | null;
  subject: string | null;
  threadId: string | null;
  to: readonly string[];
}

export interface AgentMailReplyContext {
  event: "input.requested" | "message.completed" | "turn.failed" | "session.failed";
  finishReason?: string;
  state: AgentMailChannelState;
}

export type AgentMailReplyRenderer = (
  messageText: string,
  context: AgentMailReplyContext,
) => {
  text: string;
  html?: string;
};

export interface AgentMailChannelConfig {
  apiKey?: string;
  webhookSecret?: string;
  route?: string;
  acceptedEventTypes?: readonly string[];
  replyMode?: "reply" | "none";
  renderReply?: AgentMailReplyRenderer;
  markProcessed?: boolean;
  processedLabel?: string;
  sendFailureReplies?: boolean;
  failureReplyText?: string;
  client?: AgentMailClientLike;
}

export interface AgentMailInboundMessage {
  content: string;
  eventId: string;
  eventType: string;
  from: string;
  inboxId: string;
  labels: readonly string[];
  messageId: string;
  subject: string | null;
  threadId: string;
  to: readonly string[];
}

export interface AgentMailAuthContext {
  attributes: Readonly<Record<string, string | readonly string[]>>;
  authenticator: "agentmail";
  principalId: string;
  principalType: "user";
}

export interface AgentMailWebhookPayload {
  event_id?: unknown;
  event_type?: unknown;
  message?: unknown;
  type?: unknown;
  [key: string]: unknown;
}
