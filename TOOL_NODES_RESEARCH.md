# Tool Sub-Node Research Results (2026-03-01 17:58)

## Discovery: What Makes a Real Tool Sub-Node

After analyzing n8n's ToolHttpRequest implementation, **Tool sub-nodes are fundamentally different from regular nodes**:

### Key Differences

| Aspect | Regular Node | Tool Sub-Node |
|--------|-----|-----------|
| Method | `execute()` | `supplyData()` |
| Outputs | `outputs: ['main']` | `outputs: [NodeConnectionTypes.AiTool]` |
| Output Names | `['main']` | `['Tool']` |
| Implementation | Returns data | Returns `DynamicTool` or `N8nTool` |
| LangChain | Not integrated | Uses `@langchain/core/tools` |

### Required Imports for Tool Sub-Nodes
```typescript
import { DynamicTool } from '@langchain/core/tools';
import type {
  INodeType,
  INodeTypeDescription,
  ISupplyDataFunctions,
  SupplyData,
} from 'n8n-workflow';
import {
  NodeConnectionTypes,
  nodeNameToToolName,
  tryToParseAlphanumericString,
} from 'n8n-workflow';
```

### Structure Pattern (from ToolHttpRequest)
```typescript
export class SynologyToolExample implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Synology [Action]',
    name: 'synologyTool[Action]',
    outputs: [NodeConnectionTypes.AiTool],  // KEY: Not ['main']
    outputNames: ['Tool'],                   // KEY: Not ['main']
    // ... properties, credentials, etc.
  };

  async supplyData(
    this: ISupplyDataFunctions,
    itemIndex: number
  ): Promise<SupplyData> {
    const name = nodeNameToToolName(this.getNode());
    
    // Validate name
    try {
      tryToParseAlphanumericString(name);
    } catch (error) {
      throw new NodeOperationError(...);
    }

    // Get parameters
    const param1 = this.getNodeParameter('param1', itemIndex);
    // ... get all parameters

    // Define the tool function
    const func = async (input: string) => {
      // Call Synology API
      // Return result as string for LLM
    };

    // Create and return LangChain tool
    const tool = new DynamicTool({
      name,
      description: `Does something with Synology`,
      func,
    });

    return { response: tool };
  }
}
```

## Next Steps

1. ❌ Delete current broken implementations (nodes/tools/)
2. ✅ Create 4 proper Tool Sub-Nodes with correct structure
3. ✅ Use `supplyData()` not `execute()`
4. ✅ Return `DynamicTool` not data
5. ✅ Rebuild and test

---

**Status:** Ready to implement correctly  
**Confidence:** High — have working reference from n8n codebase
