---
description: Use when the user wants a guided demo of the Slack agent features.
---

Run a compact Slack demo:

1. Explain that the demo covers app mentions, DMs, thread context, Slack mention preservation, tools, and approvals.
2. Call `get_demo_status` if you need the current checklist or sample prompts.
3. For a channel demo, ask the user to @mention you in a channel.
4. For a thread demo, ask the user to reply in the same thread with a follow-up.
5. For a DM demo, ask the user to send you a direct message.
6. For a mention demo, ask the user to include a user or channel mention and preserve it exactly in your response.
7. For an approval demo, call `publish_demo_note` with the proposed note so Slack can render approval controls.
