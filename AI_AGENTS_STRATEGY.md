# AI Agents + Tools Strategy for Synology Suite

## Concept (from Maxime)
Build static n8n nodes **AND ALSO** create **Synology Tools** that can be used by n8n's AI Agent nodes.
Both exist simultaneously — users can use nodes directly OR let AI Agents use tools autonomously.

## What is n8n Tools Agent?
- **Tools Agent:** An AI agent that can understand tasks and call available tools to accomplish them
- **Tools:** Essentially wrappers around APIs/workflows/services that expose a schema (name, description, parameters)
- **Agent decides:** The AI determines which tools to use and when based on the task

### Key n8n Tools Available
- HTTP Request (direct API calls)
- Call n8n Workflow (delegate to sub-workflows)
- Code tool (JavaScript execution)
- 400+ pre-built app integrations

## Synology + Tools Agent Strategy

### Phase 1: Synology Tools for AI Agents

#### MailPlus Tools
- **synology_get_emails** — Fetch emails from mailbox
- **synology_send_email** — Send email
- **synology_search_emails** — Search emails by subject/from/date
- **synology_delete_email** — Delete email (requires approval)
- **synology_mark_as_read** — Mark email as read

#### Drive Tools
- **synology_upload_file** — Upload file to NAS
- **synology_download_file** — Download file from NAS
- **synology_list_files** — List files in directory
- **synology_search_files** — Search files by name/type
- **synology_delete_file** — Delete file (requires approval)
- **synology_create_folder** — Create directory
- **synology_share_file** — Create sharing link

#### Photos Tools
- **synology_list_albums** — List photo albums
- **synology_get_photos** — Get photos from album
- **synology_search_photos** — Search by date/tag/person
- **synology_upload_photo** — Upload photo
- **synology_organize_photos** — Auto-organize by date

#### System Tools
- **synology_get_storage_stats** — Check NAS capacity
- **synology_get_system_info** — Get DSM version, services status
- **synology_list_services** — List running services (Mail, Photos, Drive, etc)

#### Audio Station Tools
- **synology_list_music** — List songs/artists/albums
- **synology_search_music** — Search by artist/title/album
- **synology_get_playlist** — List playlists

#### Download Station Tools
- **synology_get_downloads** — List active downloads
- **synology_add_download** — Add URL to download queue
- **synology_pause_download** — Pause download task
- **synology_resume_download** — Resume download task

### Phase 2: Tool Schemas for Synology

Each tool needs a schema for LLM comprehension:

#### Example 1: Send Email (MailPlus)
```json
{
  "name": "synology_send_email",
  "description": "Send an email via Synology MailPlus. Use this to compose and send emails.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": {
        "type": "string",
        "description": "Recipient email address (e.g., user@example.com)"
      },
      "cc": {
        "type": "string",
        "description": "CC recipients (comma-separated, optional)"
      },
      "bcc": {
        "type": "string",
        "description": "BCC recipients (comma-separated, optional)"
      },
      "subject": {
        "type": "string",
        "description": "Email subject line"
      },
      "body": {
        "type": "string",
        "description": "Email body (plain text or HTML)"
      },
      "priority": {
        "type": "string",
        "enum": ["low", "normal", "high"],
        "description": "Email priority level"
      }
    },
    "required": ["to", "subject", "body"]
  },
  "outputSchema": {
    "success": {"type": "boolean"},
    "messageId": {"type": "string"},
    "error": {"type": "string"}
  }
}
```

#### Example 2: Upload File (Drive)
```json
{
  "name": "synology_upload_file",
  "description": "Upload a file to Synology Drive. Specify path and file content.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Destination path in NAS (e.g., /Documents/report.pdf)"
      },
      "fileContent": {
        "type": "string",
        "description": "File content (base64 encoded for binary, plain text for text files)"
      },
      "overwrite": {
        "type": "boolean",
        "description": "Whether to overwrite if file exists (default: false)",
        "default": false
      }
    },
    "required": ["path", "fileContent"]
  },
  "outputSchema": {
    "success": {"type": "boolean"},
    "fileId": {"type": "string"},
    "size": {"type": "integer"},
    "error": {"type": "string"}
  }
}
```

#### Example 3: List Files (Drive)
```json
{
  "name": "synology_list_files",
  "description": "List files in a Synology Drive folder. Returns file names, sizes, types.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Folder path to list (e.g., /Documents)"
      },
      "recursive": {
        "type": "boolean",
        "description": "Include subfolders (default: false)"
      },
      "sort": {
        "type": "string",
        "enum": ["name", "date", "size"],
        "description": "Sort order"
      }
    },
    "required": ["path"]
  },
  "outputSchema": {
    "files": {
      "type": "array",
      "items": {
        "name": {"type": "string"},
        "type": {"type": "string"},
        "size": {"type": "integer"},
        "modified": {"type": "string"}
      }
    },
    "total": {"type": "integer"}
  }
}
```

#### Example 4: Search Files (Drive)
```json
{
  "name": "synology_search_files",
  "description": "Search for files in Synology Drive by name, type, or pattern.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search term (filename, pattern, or partial name)"
      },
      "fileType": {
        "type": "string",
        "enum": ["all", "documents", "images", "videos", "audio"],
        "description": "Filter by file type"
      },
      "maxResults": {
        "type": "integer",
        "description": "Maximum results to return (default: 50)"
      }
    },
    "required": ["query"]
  },
  "outputSchema": {
    "results": {
      "type": "array",
      "items": {
        "path": {"type": "string"},
        "name": {"type": "string"},
        "size": {"type": "integer"},
        "type": {"type": "string"}
      }
    },
    "count": {"type": "integer"}
  }
}
```

#### Example 5: Get Storage Stats (System)
```json
{
  "name": "synology_get_storage_stats",
  "description": "Get NAS storage capacity, usage, and available space.",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  },
  "outputSchema": {
    "total": {
      "type": "integer",
      "description": "Total storage in bytes"
    },
    "used": {
      "type": "integer",
      "description": "Used storage in bytes"
    },
    "available": {
      "type": "integer",
      "description": "Available storage in bytes"
    },
    "percentUsed": {
      "type": "number",
      "description": "Percentage used (0-100)"
    }
  }
}
```

### Phase 3: Agent Workflows
Build example workflows showing how an AI Agent would use these tools:

1. **Email Assistant Workflow**
   - Chat trigger + Tools Agent
   - Tools: get_email, send_email, search_email
   - Agent can read/compose/search emails autonomously

2. **File Manager Workflow**
   - Chat trigger + Tools Agent
   - Tools: upload_file, list_files, search_files, get_storage_stats
   - Agent can manage NAS content via natural language

3. **Photo Browser Workflow**
   - Chat trigger + Tools Agent
   - Tools: get_albums, get_photos, search_photos
   - Agent can help organize/find photos

### Implementation Approach

**Recommended: Dual-Purpose Nodes**
- Build n8n nodes (the core implementation)
- **Same nodes work as Tools for AI Agent**
- Nodes have clear, semantic naming (verbs): "Send Email", "List Files", "Upload File"
- Include tool-compatible schemas in each node:
  - Description (natural language)
  - Input schema (LLM-readable)
  - Output schema
- Users can:
  - Use nodes directly in manual workflows
  - Use same nodes as tools in AI Agent workflows

### Phase 3: Exposing Tools to AI Agents

In n8n, to make a node available to AI Agents:

1. **Add Tool Metadata to Node**
   ```typescript
   // In node definition
   tool: {
     description: "Send an email via Synology MailPlus",
     inputSchema: { /* JSON schema */ }
   }
   ```

2. **Register with Tools Agent**
   - When Tools Agent loads, it discovers available tools
   - Tools Agent can see descriptions + schemas
   - Agent can call tools by name with parameters

3. **Example AI Agent Workflow Using Tools**
   ```
   Chat Trigger
     ↓
   [User: "Send an email to john@example.com about the report"]
     ↓
   Tools Agent (with Synology tools available)
     - Recognizes "send email" intent
     - Calls synology_send_email tool
     - Passes: to="john@example.com", subject="report", body=...
     ↓
   Tool executes → Returns success/error
     ↓
   Agent responds to user: "Email sent!"
   ```

## Benefits of This Approach
✅ **Agent-friendly:** AI can compose complex tasks from simple tools  
✅ **User-friendly:** Users can ask "organize my photos by date" and agent does it  
✅ **Composable:** Tools are reusable across many workflows  
✅ **Scalable:** Add new tools incrementally  

## Risks & Mitigations
⚠️ **Destructive actions:** Email delete, file delete
- Mitigation: Require human approval for dangerous operations
- Use n8n's "Human Review" feature for tools

⚠️ **Rate limiting:** Synology DSM has request limits
- Mitigation: Add retry logic, throttling in tools

⚠️ **Auth state:** Managing session tokens across tool calls
- Mitigation: Ensure each tool call validates/refreshes auth

## Implementation Priority

### Priority 1 (MVP — Week 1-2)
- [ ] synology_send_email (MailPlus)
- [ ] synology_upload_file (Drive)
- [ ] synology_list_files (Drive)
- [ ] synology_get_storage_stats (System)
- Test with AI Agent on basic "send email" + "upload file" workflows

### Priority 2 (Week 3-4)
- [ ] synology_search_files (Drive)
- [ ] synology_search_emails (MailPlus)
- [ ] synology_list_albums (Photos)
- [ ] synology_get_downloads (DownloadStation)
- Build example workflows (Email Assistant, File Manager)

### Priority 3 (Future)
- [ ] Destructive tools (delete_file, delete_email) — with human approval
- [ ] Complex tools (organize_photos, create_share_links)
- [ ] Audio Station, Video Station, Surveillance tools

## Next Steps
1. [ ] Finalize which operations become tools (done — see Priority above)
2. [ ] Design tool schemas (DONE — examples in Phase 2)
3. [ ] Build Priority 1 nodes + expose as AI Agent tools
4. [ ] Create example AI Agent workflows (Email Bot, File Manager Bot)
5. [ ] Test agent autonomy + error handling
6. [ ] Document tool library for users
7. [ ] Add human-approval gates for destructive operations

## Reference
- n8n Docs: https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/
- Langchain Tool Calling: https://js.langchain.com/docs/concepts/tool_calling/
- Human Review for Tools: https://docs.n8n.io/advanced-ai/human-in-the-loop-tools/

---

**Created by:** Bob, 2026-03-01  
**Status:** Strategy document, awaiting Maxime feedback
