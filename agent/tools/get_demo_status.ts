import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Return the capabilities and sample prompts for the Slack demo.",
  inputSchema: z.object({
    focus: z
      .enum(["overview", "threads", "dms", "mentions", "approvals"])
      .default("overview")
      .describe("The Slack feature the user wants to demo."),
  }),
  async execute({ focus }) {
    return {
      focus,
      generatedAt: new Date().toISOString(),
      capabilities: [
        "Responds to app mentions in channels.",
        "Responds to direct messages.",
        "Replies in Slack threads and loads recent thread context.",
        "Preserves user and channel mention tokens.",
        "Runs Eve tools for demo status.",
        "Uses Eve approval flow for a simulated protected publish action.",
      ],
      samplePrompts: [
        "@Eve Slack Demo what can you demo?",
        "Reply in the same thread: summarize what we have tested so far.",
        "DM the bot: does the DM path work?",
        "Mention a teammate or channel and ask the bot to preserve the tag.",
        "Please publish a demo note saying the Slack approval flow works.",
      ],
    };
  },
});
