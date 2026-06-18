# eve-channel-agentmail

Reusable Eve custom channel for receiving and replying to AgentMail email threads.

## Install

```bash
npm install eve-channel-agentmail agentmail svix
```

Your Eve app should already depend on `eve`.

## Eve Channel File

Create `agent/channels/agentmail.ts` in your Eve app:

```ts
import { agentMailChannel } from "eve-channel-agentmail";

export default agentMailChannel({
  apiKey: process.env.AGENTMAIL_API_KEY,
  webhookSecret: process.env.AGENTMAIL_WEBHOOK_SECRET,
});
```

By default the channel exposes `POST /webhook`. Configure your AgentMail webhook endpoint to call the Eve app's channel URL for that route.

Required demo environment variables:

- `AGENTMAIL_API_KEY`
- `AGENTMAIL_WEBHOOK_SECRET`
- Eve/Vercel model environment variables required by your host Eve app
- Optional `AGENTMAIL_INBOX_ID` for any separate proactive outbound example code

## Configuration

```ts
agentMailChannel({
  apiKey: process.env.AGENTMAIL_API_KEY,
  webhookSecret: process.env.AGENTMAIL_WEBHOOK_SECRET,
  route: "/agentmail/webhook",
  acceptedEventTypes: [
    "message.received",
    "message.received.spam",
    "message.received.blocked",
    "message.received.unauthenticated",
  ],
  replyMode: "reply",
  renderReply(messageText, context) {
    return { text: messageText };
  },
  sendFailureReplies: true,
  markProcessed: false,
});
```

Defaults:

- `route`: `/webhook`
- `acceptedEventTypes`: `["message.received"]`
- `replyMode`: `"reply"`
- `renderReply`: plain text only
- `sendFailureReplies`: `true`
- `markProcessed`: `false`

When `markProcessed` is enabled, the channel adds an `eve-processed` label after Eve accepts an inbound email. Override that label with `processedLabel`.

## Behavior

The channel verifies AgentMail webhooks with Svix using the raw request body and the `svix-id`, `svix-timestamp`, and `svix-signature` headers. Non-accepted AgentMail events are acknowledged with `204` and ignored.

Inbound `message.received` events become Eve user messages. The channel continuation token is built from AgentMail `inbox_id` and `thread_id`, so one email thread maps to one Eve conversation. Message text prefers `extracted_text`, then `text`, then a conservative HTML-to-text fallback from `html`, then `preview`.

On `message.completed`, the channel replies with:

```ts
client.inboxes.messages.reply(inboxId, lastMessageId, { text, html });
```

`turn.failed` and `session.failed` send a short failure reply unless `sendFailureReplies` is `false`. `input.requested` sends a plain-text prompt asking the user to reply by email; structured approval controls are not implemented in v0.

## Exports

- `agentMailChannel(config)`
- `agentmailContinuationToken(inboxId, threadId)`
- `parseAgentmailContinuationToken(token)`
- formatting and verification helpers for tests or advanced integrations

## v0 Scope

This package does not auto-register AgentMail webhooks and does not require database storage. Attachments are future work; AgentMail exposes message and thread attachment retrieval APIs, and Eve channels can add file parts through `fetchFile`, but this v0 keeps inbound mail text-only.

## References

- [Eve channels overview](https://raw.githubusercontent.com/vercel/eve/main/docs/channels/overview.mdx)
- [Eve custom channels](https://raw.githubusercontent.com/vercel/eve/main/docs/channels/custom.mdx)
- [AgentMail webhooks overview](https://www.agentmail.to/docs/webhooks-overview)
- [AgentMail webhook events](https://www.agentmail.to/docs/events)
- [AgentMail webhook verification](https://www.agentmail.to/docs/webhook-verification)
- [AgentMail messages](https://www.agentmail.to/docs/messages)
- [AgentMail attachments](https://www.agentmail.to/docs/attachments)
