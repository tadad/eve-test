import { getToken } from "@vercel/connect";
import { vercelOidc } from "eve/channels/auth";
import type {
  SlackBotTokenContext,
  SlackChannelCredentials,
} from "eve/channels/slack";

type SlackTeamConnectors = Record<string, string>;

interface SlackConnectorRegistry {
  defaultConnector: string;
  teams: SlackTeamConnectors;
}

export function connectSlackTeamCredentials(
  registry: SlackConnectorRegistry,
): SlackChannelCredentials {
  return {
    botToken: (context?: SlackBotTokenContext) => {
      const connector = resolveSlackConnector(registry, context);
      return getToken(connector, { subject: { type: "app" } });
    },
    webhookVerifier: vercelOidc(),
  };
}

export function validateSlackConnectorRegistry(
  registry: SlackConnectorRegistry,
): SlackConnectorRegistry {
  if (!registry.defaultConnector) {
    throw new Error("Slack connector registry requires defaultConnector.");
  }

  for (const [teamId, connector] of Object.entries(registry.teams)) {
    if (typeof connector !== "string" || connector.length === 0) {
      throw new Error(`Slack connector for ${teamId} must be a connector UID.`);
    }
  }

  return registry;
}

function resolveSlackConnector(
  registry: SlackConnectorRegistry,
  context?: SlackBotTokenContext,
): string {
  if (!context?.teamId) return registry.defaultConnector;

  const connector = registry.teams[context.teamId];
  if (!connector) {
    throw new Error(`No Slack connector configured for team ${context.teamId}.`);
  }

  return connector;
}
