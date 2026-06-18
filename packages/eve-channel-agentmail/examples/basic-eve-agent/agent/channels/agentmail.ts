import { agentMailChannel } from "eve-channel-agentmail";

export default agentMailChannel({
  apiKey: process.env.AGENTMAIL_API_KEY,
  webhookSecret: process.env.AGENTMAIL_WEBHOOK_SECRET,
});
