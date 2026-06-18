export { agentMailChannel } from "./agentMailChannel.js";
export {
  agentmailContinuationToken,
  parseAgentmailContinuationToken,
  type AgentmailContinuationTokenParts,
} from "./continuationToken.js";
export {
  buildAgentMailAuth,
  buildAgentMailChannelState,
  formatInboundAgentMailMessage,
  htmlToText,
} from "./formatInbound.js";
export { renderPlainTextReply } from "./renderReply.js";
export type {
  AgentMailAuthContext,
  AgentMailChannelConfig,
  AgentMailChannelMetadata,
  AgentMailChannelState,
  AgentMailClientLike,
  AgentMailInboundMessage,
  AgentMailReceivedEventType,
  AgentMailReplyContext,
  AgentMailReplyRenderer,
  AgentMailWebhookPayload,
} from "./types.js";
export { verifyAgentMailWebhook } from "./verifyWebhook.js";
