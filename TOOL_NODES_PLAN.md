# Creating Synology Tool Sub-Nodes for AI Agent

## Current Status (2026-03-01)
- ❌ Synology nodes are NOT visible in AI Agent "Tools" panel
- ✅ Other integrations (Gmail, SerpAPI, etc.) ARE visible
- **Goal:** Create Tool Sub-nodes for Synology to appear in AI Agent Tools

## Key Findings

### What are Tool Sub-Nodes?
- **Special node type** that integrates with n8n's LangChain architecture
- Can be connected directly to AI Agent node via "Tools" socket
- Have built-in support for `$fromAI()` parameter mapping
- n8n recognizes them and makes them available to AI agents

### Built-in Tool Examples:
- `n8n-nodes-langchain.toolworkflow` — Call n8n Workflow Tool
- `n8n-nodes-langchain.toolcode` — Custom Code Tool
- `n8n-nodes-langchain.toolserpapi` — SerpAPI Tool
- `n8n-nodes-langchain.toolcalculator` — Calculator Tool

### Tool Node Structure Requirements:
Based on n8n's architecture, tool sub-nodes need:

1. **Node Definition** (`INodeType` interface):
   - `group: ['tools']` (special group for tools)
   - `displayName`, `name`, `description`
   - May have `displayOptions` to show/hide params

2. **Tool Metadata**:
   - Description that explains what the tool does (for the AI)
   - Input schema that defines parameters
   - Output schema that defines what it returns

3. **Execution Logic**:
   - Standard `execute()` method
   - Works with `IExecuteFunctions` context
   - Returns structured data for AI parsing

## Implementation Plan

### Phase 1: Create 4 Tool Sub-Nodes

**1. SynologyMailPlusSendEmailTool**
```
Node: synologyMailPlusSendEmailTool
Group: tools
Resource: MailPlus
Operation: Send Email
Params: to, cc, bcc, subject, body, priority
```

**2. SynologyDriveUploadFileTool**
```
Node: synologyDriveUploadFileTool
Group: tools
Resource: Drive
Operation: Upload File
Params: path, fileContent, overwrite
```

**3. SynologyDriveListFilesTool**
```
Node: synologyDriveListFilesTool
Group: tools
Resource: Drive
Operation: List Files
Params: path, recursive, limit
```

**4. SynologyGetStorageStatsTool**
```
Node: synologyGetStorageStatsTool
Group: tools
Resource: System
Operation: Get Storage Stats
Params: (none or include-details)
```

### Phase 2: Register in package.json

Add to n8n section:
```json
"nodes": [
  ...,
  "dist/nodes/tools/SynologyMailPlusSendEmailTool.node.js",
  "dist/nodes/tools/SynologyDriveUploadFileTool.node.js",
  "dist/nodes/tools/SynologyDriveListFilesTool.node.js",
  "dist/nodes/tools/SynologyGetStorageStatsTool.node.js"
]
```

### Phase 3: Test in n8n

1. Install updated package
2. Restart n8n
3. Create AI Agent workflow
4. Connect to "Tools" socket
5. Verify Synology tools appear in dropdown

## Technical Notes

- Tool nodes are sub-nodes (not root nodes)
- They must be in `group: ['tools']` to be recognized as tools
- They should NOT have standard outputs like normal nodes
- They work with AI Agent's parameter mapping system
- Each tool is atomic — does ONE thing well

## Next Steps

1. ✅ Understand tool architecture (done)
2. ⏳ Create 4 tool sub-nodes with proper structure
3. ⏳ Test in n8n UI
4. ⏳ Document usage examples
5. ⏳ Publish to NPM as v0.5.1+

---

**Created:** 2026-03-01 17:51 UTC  
**Status:** Planning phase — awaiting implementation
