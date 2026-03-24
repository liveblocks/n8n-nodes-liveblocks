# Liveblocks Official n8n Nodes

This is the official Liveblocks [n8n](https://n8n.io/) node repository. These nodes cand ownload and modify room storage, interact with threads, comments, and attachments, send notifications and more in real-time.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Compatibility](#compatibility)
- [Usage](#usage)
- [Resources](#resources)
- [Version history](#version-history)

## Installation

Install this package as a [community node](https://docs.n8n.io/integrations/community-nodes/installation/) in your n8n instance. The npm package name is **`n8n-nodes-liveblocks`**.

In n8n, open **Settings → Community nodes**, enter `n8n-nodes-liveblocks`, and install. After installation, **Liveblocks** and **Liveblocks Trigger** appear in the node palette.

For local development of this repository, clone the project and use the [n8n node CLI](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node-cli/) (`n8n-node dev`, `n8n-node build`) as described in the project’s contributor docs.

## Operations

The package provides two nodes.

### Liveblocks (action node)

Calls the [Liveblocks REST API](https://liveblocks.io/docs/api-reference/rest-api-endpoints). Choose a **resource**, then an **operation**. Operations map to the API (rooms, storage, Yjs, comments, inbox, webhooks-related server flows, etc.).

| Resource | What you can do (examples) |
| --- | --- |
| **Room** | List, create, update, delete, and upsert rooms; change room or organization IDs; prewarm; list active users; **set presence**; **broadcast** custom events to the room. |
| **Storage** | Get, initialize, patch (JSON Patch), or delete Liveblocks storage documents. |
| **Yjs** | Read Yjs state, send binary updates, list versions, and create or fetch specific versions. |
| **Thread** | CRUD threads; edit metadata; resolve/unresolve; subscribe/unsubscribe; list subscriptions and thread inbox notifications. |
| **Comment** | Create, read, edit, and delete comments; add/remove reactions; edit metadata. |
| **Attachment** | Download comment attachments (binary response when applicable). |
| **User** | Identify users for Liveblocks features that require user metadata. |
| **Inbox** | Inbox notifications, notification settings, room subscription settings, mark-as-read, and related triggers. |
| **Group** | Manage groups and membership; list a user’s groups. |
| **AI Copilot** | List, create, read, update, and delete AI copilot configurations. |
| **AI Knowledge** | Manage web and file knowledge sources, fetch markdown or links, and delete sources. |

The node builds requests from the fields you configure in the UI; some endpoints accept raw JSON for advanced bodies (for example JSON Patch or broadcast payloads). Refer to the [Liveblocks REST API reference](https://liveblocks.io/docs/api-reference/rest-api-endpoints) for request and response shapes.

### Liveblocks Trigger (webhook)

Starts a workflow when Liveblocks sends a **webhook** to n8n. Configure the webhook URL from the trigger in your [Liveblocks dashboard](https://liveblocks.io/dashboard) webhook settings. You can filter by **event type** or leave the filter empty to receive all supported types.

Supported event filters include: `commentCreated`, `commentDeleted`, `commentEdited`, `notification`, `storageUpdated`, `threadCreated`, `threadDeleted`, `threadMetadataUpdated`, `userEntered`, `userLeft`, `yjsUpdate`. The trigger verifies the request using your **webhook signing secret** before running the workflow.

## Credentials

### Liveblocks API (required for the Liveblocks action node)

1. Create or open a project in the [Liveblocks dashboard](https://liveblocks.io/dashboard).
2. Copy the **secret key** (`sk_…`) from project settings.
3. In n8n, create a credential of type **Liveblocks API** and paste the secret key.

The credential test calls the REST API (for example listing rooms) to confirm the key works.

### Liveblocks Webhook Signing Secret (required for Liveblocks Trigger)

1. In the Liveblocks dashboard, open your project’s **webhook** configuration and copy the **signing secret** (`whsec_…`).
2. In n8n, create a credential of type **Liveblocks Webhook Signing Secret API** and paste that value.

This secret is only used to verify incoming webhook signatures; it is not validated with a live HTTP test in the credentials UI.

## Compatibility

- This package declares **`n8nNodesApiVersion` 1** in `package.json`, in line with current n8n community node conventions.
- It lists **`n8n-workflow`** as a peer dependency (version resolved by your n8n install).

Use a [current n8n release](https://docs.n8n.io/release-notes/) that supports community nodes and API version 1. If you hit a compatibility issue, report it with your n8n version and this package version.

## Usage

- **Action node**: Add **Liveblocks**, select **resource** and **operation**, then fill the parameters. Map data from previous nodes into room IDs, user IDs, and bodies as needed. Use **Execute step** while designing to inspect API responses and errors.
- **Trigger**: Add **Liveblocks Trigger**, set credentials, copy the **webhook URL** into the Liveblocks dashboard, and choose which events to listen for. Use n8n’s test URL while building, then switch to the production URL when the workflow is active.
- **Errors**: Failed API calls surface as n8n errors with HTTP status and message when the API returns them. If webhooks fail verification, check that the signing secret matches the project and that the request is actually from Liveblocks.

New to n8n? See [Try it out](https://docs.n8n.io/try-it-out/) in the n8n docs.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Liveblocks documentation](https://liveblocks.io/docs)
- [Liveblocks REST API reference](https://liveblocks.io/docs/api-reference/rest-api-endpoints)
- [Liveblocks webhooks](https://liveblocks.io/docs/platform/webhooks)
- [Liveblocks dashboard](https://liveblocks.io/dashboard)

## Version history

See [CHANGELOG.md](CHANGELOG.md) for a complete changelog.
