import type { AgentMailReplyContext } from "./types.js";

export function renderPlainTextReply(
  messageText: string,
  _context: AgentMailReplyContext,
): { text: string } {
  return { text: messageText };
}
