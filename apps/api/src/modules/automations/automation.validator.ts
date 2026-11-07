export interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  triggerNode?: WorkflowNode;
}

export const VALID_TRIGGER_TYPES = [
  "contact_subscribed",
  "contact_added_to_list",
  "tag_assigned",
  "contact_birthday",
];

export const VALID_ACTION_TYPES = [
  "send_email",
  "add_tag",
  "remove_tag",
  "add_to_list",
  "remove_from_list",
];

export const VALID_LOGIC_TYPES = ["delay", "condition"];

export class AutomationValidator {
  /**
   * Validate full visual workflow definition
   */
  static validate(workflow: WorkflowDefinition): WorkflowValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!workflow || !Array.isArray(workflow.nodes)) {
      return {
        isValid: false,
        errors: ["Workflow definition is missing or malformed."],
        warnings: [],
      };
    }

    const { nodes, edges = [] } = workflow;

    if (nodes.length === 0) {
      return {
        isValid: false,
        errors: ["Workflow must contain at least one node."],
        warnings: [],
      };
    }

    const nodeIds = new Set<string>();
    const triggerNodes: WorkflowNode[] = [];

    // 1. Verify Node IDs and find Triggers
    for (const node of nodes) {
      if (!node.id) {
        errors.push("Node missing unique 'id'.");
        continue;
      }
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node id found: "${node.id}".`);
      }
      nodeIds.add(node.id);

      const isTrigger =
        VALID_TRIGGER_TYPES.includes(node.type) ||
        node.type.startsWith("trigger");
      if (isTrigger) {
        triggerNodes.push(node);
      }

      // Node data validation
      this.validateNodeData(node, errors, warnings);
    }

    // 2. Exactly one trigger node required
    if (triggerNodes.length === 0) {
      errors.push("Workflow must contain exactly one Trigger node.");
    } else if (triggerNodes.length > 1) {
      errors.push("Workflow cannot contain multiple Trigger nodes.");
    }

    // 3. Validate Edges
    for (const edge of edges) {
      if (!edge.source || !edge.target) {
        errors.push(`Edge "${edge.id}" has invalid source or target.`);
        continue;
      }
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge references missing source node: "${edge.source}".`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge references missing target node: "${edge.target}".`);
      }
      if (edge.source === edge.target) {
        errors.push(`Self-referencing loop detected on node: "${edge.source}".`);
      }
    }

    // 4. Cycle detection (DFS)
    const hasCycle = this.detectCycle(nodes, edges);
    if (hasCycle) {
      errors.push("Workflow contains an infinite loop or cyclic path.");
    }

    // 5. Check connectivity (nodes without input except trigger)
    const targetsWithInputs = new Set(edges.map((e) => e.target));
    for (const node of nodes) {
      const isTrigger = triggerNodes.some((t) => t.id === node.id);
      if (!isTrigger && !targetsWithInputs.has(node.id)) {
        warnings.push(`Node "${node.data?.label || node.id}" is disconnected from the workflow.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      triggerNode: triggerNodes[0],
    };
  }

  /**
   * Validate node-specific data configurations
   */
  private static validateNodeData(
    node: WorkflowNode,
    errors: string[],
    warnings: string[]
  ) {
    const data = node.data || {};

    switch (node.type) {
      case "send_email":
        if (!data.subject && !data.templateId) {
          errors.push(`Send Email node "${node.id}" requires a Subject line or Template selection.`);
        }
        break;

      case "add_tag":
      case "remove_tag":
        if (!data.tagId && !data.tagName) {
          errors.push(`Tag action node "${node.id}" requires a tag to be selected.`);
        }
        break;

      case "add_to_list":
      case "remove_from_list":
        if (!data.listId && !data.listName) {
          errors.push(`List action node "${node.id}" requires a list to be selected.`);
        }
        break;

      case "delay":
        const duration = Number(data.duration);
        if (isNaN(duration) || duration <= 0) {
          errors.push(`Delay node "${node.id}" requires a positive duration.`);
        }
        break;

      case "condition":
        if (!data.conditionType) {
          errors.push(`Condition node "${node.id}" requires a condition type.`);
        }
        break;

      default:
        break;
    }
  }

  /**
   * Cycle detection using DFS
   */
  private static detectCycle(nodes: WorkflowNode[], edges: WorkflowEdge[]): boolean {
    const adj = new Map<string, string[]>();
    for (const node of nodes) adj.set(node.id, []);
    for (const edge of edges) {
      if (adj.has(edge.source)) adj.get(edge.source)!.push(edge.target);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    function dfs(nodeId: string): boolean {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = adj.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(nodeId);
      return false;
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }
}
