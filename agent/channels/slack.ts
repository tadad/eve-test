import {
  defaultSlackAuth,
  loadThreadContextMessages,
  slackChannel,
} from "eve/channels/slack";
import {
  connectSlackTeamCredentials,
  validateSlackConnectorRegistry,
} from "../lib/slackTeamConnectors.js";
import slackConnectorRegistry from "../../config/slackConnectors.json" with { type: "json" };

const connectors = validateSlackConnectorRegistry(slackConnectorRegistry);

export default slackChannel({
  credentials: connectSlackTeamCredentials(connectors),

  async onAppMention(ctx, message) {
    const auth = defaultSlackAuth(message, ctx);
    const prior = await loadThreadContextMessages(ctx.thread, message, {
      since: "last-agent-reply",
    });

    const context = [
      "Slack surface: app mention in a channel. Reply in the Slack thread and preserve any Slack mention tokens exactly.",
    ];

    if (prior.length > 0) {
      const transcript = prior
        .map((m) => `${m.isMe ? "agent" : (m.user ?? "user")}: ${m.markdown}`)
        .join("\n");
      context.push(`Recent thread messages since your last reply:\n\n${transcript}`);
    }

    return { auth, context };
  },

  onDirectMessage(ctx, message) {
    return {
      auth: defaultSlackAuth(message, ctx),
      context: [
        "Slack surface: direct message. The DM path is working; reply naturally and keep context local to this DM.",
      ],
    };
  },
});
