export interface AgentmailContinuationTokenParts {
  inboxId: string;
  threadId: string;
}

export function agentmailContinuationToken(inboxId: string, threadId: string): string {
  return `${encodeURIComponent(inboxId)}:${encodeURIComponent(threadId)}`;
}

export function parseAgentmailContinuationToken(
  token: string,
): AgentmailContinuationTokenParts | null {
  const separator = token.indexOf(":");
  if (separator === -1) {
    return null;
  }

  try {
    return {
      inboxId: decodeURIComponent(token.slice(0, separator)),
      threadId: decodeURIComponent(token.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}
