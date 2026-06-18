import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

export default defineTool({
  description:
    "Simulate publishing a Slack demo note. Requires human approval and is used to demonstrate Slack approval buttons.",
  inputSchema: z.object({
    channelDescription: z
      .string()
      .min(1)
      .describe("Where the user wants the simulated note to be published."),
    note: z.string().min(1).max(500).describe("The demo note to publish."),
  }),
  needsApproval: always(),
  async execute({ channelDescription, note }) {
    return {
      approved: true,
      posted: false,
      channelDescription,
      note,
      message:
        "Approved demo action. No external Slack post was sent; this tool only simulates a protected action.",
    };
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        approved: output.approved,
        posted: output.posted,
        note: output.note,
      },
    };
  },
});
