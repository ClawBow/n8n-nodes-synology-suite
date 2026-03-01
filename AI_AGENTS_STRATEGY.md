# AI Agent Tools Strategy for Synology (CORRECTED)

## Key Discovery: AI Agent Tools ≠ Regular Nodes

After studying n8n documentation, **AI Agent Tools are sub-nodes, not regular n8n nodes**.

Tools are interfaces the AI can call (like functions), connected directly to the AI Agent node.

## How AI Agent Tools Work in n8n

### Built-in Tool Types:
1. **Call n8n Workflow Tool** — Execute a workflow as a tool
2. **Custom Code Tool** — Write JavaScript the agent can run
3. **HTTP Request Tool** — Make API calls
4. **Pre-built Tools:** Wikipedia, SerpAPI, Calculator, etc.

### The Right Approach for Synology Tools:

**Approach A: Use Call n8n Workflow Tool (Recommended for MVP)**
- Create separate **n8n workflows** for each Synology operation
- In AI Agent: Connect "Call n8n Workflow Tool" sub-node
- Workflow name becomes the tool name
- Agent calls workflows autonomously

**Approach B: Create Custom Tool Sub-nodes (Advanced)**
- Extend n8n's sub-node architecture
- Requires deep n8n SDK knowledge
- More work but tightly integrated

## Implementation Plan (Approach A — MVP)

### Phase 1: Create Synology Tool Workflows

Instead of creating nodes, create **reusable workflows** that the AI Agent can call.

**Workflow 1: Send Email**
```
Trigger: None (called by AI Agent)
├─ AI Agent passes: to, subject, body, cc?, priority?
├─ Synology MailPlus node (execute send)
└─ Return success/error to agent
```

**Workflow 2: Upload File**
```
Trigger: None
├─ AI Agent passes: path, fileContent, overwrite?
├─ Synology Drive node (upload)
└─ Return fileId/success to agent
```

**Workflow 3: List Files**
```
Trigger: None
├─ AI Agent passes: folder path, recursive?, limit?
├─ Synology Drive node (list)
└─ Return files array to agent
```

**Workflow 4: Get Storage Stats**
```
Trigger: None
├─ No input (or include-details flag)
├─ Synology API node (get system info)
└─ Return {total, used, available, percent}
```

### Phase 2: Connect to AI Agent

In your AI workflow:
```
Chat Trigger
   ↓
AI Agent Node
   ├─ Chat Model (Claude/GPT/etc)
   ├─ Memory
   └─ Tools (Sub-nodes)
       ├─ Call n8n Workflow Tool → "send-email"
       ├─ Call n8n Workflow Tool → "upload-file"  
       ├─ Call n8n Workflow Tool → "list-files"
       └─ Call n8n Workflow Tool → "get-storage-stats"
```

### Phase 3: AI Agent Usage

```
User: "Send an email to john@example.com with the subject 'Report' and body 'Here is the report'"

AI Agent:
1. Recognizes "send email" intent
2. Finds available tool: "send-email" workflow
3. Calls workflow with: to="john@example.com", subject="Report", body="Here is the report"
4. Workflow executes using existing SynologyMailPlus node
5. Returns success/error to agent
6. Agent responds: "Email sent successfully to john@example.com"
```

## Why Approach A is Better for MVP

✅ **Easy to implement** — No SDK diving, just workflows
✅ **Reusable** — Can call from anywhere, not just AI agents
✅ **Backward compatible** — Uses existing Synology nodes (0.4.3)
✅ **Flexible** — Each workflow has its own logic/error handling
✅ **Safe** — Clear boundaries between agent and execution

## Next Steps

1. **Don't modify nodes** — Keep existing Synology nodes (0.4.3)
2. **Create 4 tool workflows:**
   - send-email-tool
   - upload-file-tool
   - list-files-tool
   - get-storage-stats-tool
3. **Document how to wire them** to AI Agent
4. **Create example workflow** showing full AI Agent + Synology tools setup
5. **Test with real AI Agent** (Claude, GPT, etc.)

## Reference

- n8n Tools Docs: https://docs.n8n.io/advanced-ai/examples/understand-tools/
- Call n8n Workflow Tool: https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolworkflow/
- AI Agent Tutorial: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/

---

**Status:** Strategy corrected after studying n8n documentation  
**Date:** 2026-03-01 17:35 UTC
