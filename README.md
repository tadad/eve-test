# Eve Slack Demo

Minimal Eve project for demonstrating a Slack agent with channel mentions, DMs, thread context, mention preservation, tools, skills, and approval buttons.

## Local setup

```sh
pnpm install
pnpm dev
```

`pnpm dev` runs Eve's local terminal UI. Use it to test the agent instructions, `get_demo_status`, the `slack_demo` skill, and the gated `publish_demo_note` tool.

Slack events cannot be tested fully against local dev because Slack webhooks are forwarded through Vercel Connect to a deployed Vercel project.

## Deployed demo

- Vercel project: `tadads-projects/eve-test`
- Production URL: `https://eve-test-five.vercel.app`
- Slack connector: `slack/eve-slack-demo`
- Slack webhook route: `POST /eve/v1/slack`

The Slack route is deployed and mounted. A raw unauthenticated POST returns `401 unauthorized`, which is expected because Slack webhooks must arrive through Vercel Connect verification.

Model requests are currently blocked until billing is enabled for Vercel AI Gateway on the `tadads-projects` scope. Add a valid payment method in the Vercel AI dashboard to unlock the included credits:

```text
https://vercel.com/tadads-projects/~/ai?modal=add-credit-card
```

After that, the existing deployment should be able to answer Slack messages without code changes.

## Demo prompts

- `What can you demo in Slack?`
- `Run the Slack demo checklist.`
- `Please publish a demo note saying the approval flow works.`
- In Slack later: `@Eve Slack Demo what can you demo?`
- In the same Slack thread: `summarize what we have tested so far`
- In a DM: `does the DM path work?`
- With mentions: `please preserve <@USER_ID> and <#CHANNEL_ID>`

## Credentials and access needed later

You should not need `SLACK_BOT_TOKEN` or `SLACK_SIGNING_SECRET`. Eve's Slack channel uses Vercel Connect for bot credentials and webhook verification.

To finish the deployed Slack setup, provide:

- Vercel account/team access with permission to create/link projects and Connect connectors.
- Slack workspace permission to install/authorize the Vercel-managed Slack app.
- A Vercel project linked to this directory.
- `SLACK_CONNECTOR`, the Vercel Connect UID, for example `slack/eve-slack-demo`.

## Later Vercel/Slack setup

After Vercel CLI access is available:

```sh
vercel login
vercel link
FF_CONNECT_ENABLED=1 vercel connect create slack --name eve-slack-demo --triggers
FF_CONNECT_ENABLED=1 vercel connect detach slack/eve-slack-demo --yes
FF_CONNECT_ENABLED=1 vercel connect attach slack/eve-slack-demo --triggers --trigger-path /eve/v1/slack --yes
vercel env add SLACK_CONNECTOR
pnpm run deploy
```

Set `SLACK_CONNECTOR` to the connector UID, such as `slack/eve-slack-demo`.

Once deployed, invite the bot to a Slack channel, @mention it, continue in the created thread, DM it, include user/channel mentions, and ask it to publish a demo note to trigger approval buttons.
