import { agentMailChannel } from "eve-channel-agentmail";

export default agentMailChannel({
  route: "/eve/v1/agentmail",
  apiKey: process.env.AGENTMAIL_API_KEY,
  webhookSecret: process.env.AGENTMAIL_WEBHOOK_SECRET,
});
