import { memo } from "react";
import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import {
  Zap,
  Clock,
  Mail,
  Tag,
  Folder,
  GitBranch,
  Settings,
} from "lucide-react";

export interface FlowNodeData extends Record<string, unknown> {
  type?: string;
  label?: string;
  tagName?: string;
  listName?: string;
  duration?: number;
  unit?: string;
  actionType?: string;
  subject?: string;
  conditionType?: string;
  conditionValue?: string;
  value?: string;
}

export type CustomNodeProps = NodeProps<Node<FlowNodeData>>;

/**
 * Trigger Node Component
 */
export const TriggerNode = memo(({ data, selected }: CustomNodeProps) => {
  const triggerType = String(data.type || "contact_subscribed");

  const getTriggerDetails = () => {
    switch (triggerType) {
      case "contact_subscribed":
        return { label: "Contact Subscribed", desc: "Fires when a new contact is created or opts in" };
      case "tag_assigned":
        return {
          label: "Tag Assigned",
          desc: data.tagName ? `Triggered when tag "${String(data.tagName)}" is applied` : "Triggered when any tag is applied",
        };
      case "contact_added_to_list":
        return {
          label: "Added to List",
          desc: data.listName ? `Triggered when added to "${String(data.listName)}"` : "Triggered when added to a list",
        };
      default:
        return { label: String(data.label || "Workflow Trigger"), desc: "Event-based workflow starter" };
    }
  };

  const info = getTriggerDetails();

  return (
    <div
      className={`relative min-w-[240px] max-w-[280px] rounded-xl border bg-white p-3.5 shadow-sm transition-all ${
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
          : "border-emerald-200 hover:border-emerald-300 hover:shadow-xs"
      }`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-50">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700">
            Trigger
          </span>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200/60">
          Starts Flow
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-900 truncate">
          {String(data.label || info.label)}
        </div>
        <div className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
          {info.desc}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white !-bottom-1.5 shadow-xs transition-transform hover:scale-125"
      />
    </div>
  );
});
TriggerNode.displayName = "TriggerNode";

/**
 * Delay Node Component
 */
export const DelayNode = memo(({ data, selected }: CustomNodeProps) => {
  const duration = Number(data.duration ?? 1);
  const unit = String(data.unit || "hours");

  return (
    <div
      className={`relative min-w-[220px] max-w-[260px] rounded-xl border bg-white p-3.5 shadow-sm transition-all ${
        selected
          ? "border-amber-500 ring-2 ring-amber-500/20 shadow-md"
          : "border-amber-200 hover:border-amber-300 hover:shadow-xs"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white !-top-1.5 shadow-xs transition-transform hover:scale-125"
      />

      <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-50">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-amber-700">
            Time Delay
          </span>
        </div>
        <span className="text-[11px] font-mono font-medium text-amber-700">
          {duration} {unit}
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-900">
          {String(data.label || `Wait ${duration} ${unit}`)}
        </div>
        <div className="text-[11px] text-slate-500">
          Suspends execution before advancing to next step.
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white !-bottom-1.5 shadow-xs transition-transform hover:scale-125"
      />
    </div>
  );
});
DelayNode.displayName = "DelayNode";

/**
 * Action Node Component (Send Email, Add Tag, Add to List)
 */
export const ActionNode = memo(({ data, selected }: CustomNodeProps) => {
  const actionType = String(data.actionType || data.type || "send_email");

  const getActionConfig = () => {
    switch (actionType) {
      case "send_email":
        return {
          icon: Mail,
          badgeColor: "bg-sky-100 text-sky-700 border-sky-200",
          borderHover: "border-sky-300",
          borderSelected: "border-sky-500 ring-sky-500/20",
          handleColor: "!bg-sky-500",
          header: "Send Email",
          detail: data.subject ? `Subject: "${String(data.subject)}"` : "Default Automated Template",
        };
      case "add_tag":
      case "remove_tag":
        return {
          icon: Tag,
          badgeColor: "bg-indigo-100 text-indigo-700 border-indigo-200",
          borderHover: "border-indigo-300",
          borderSelected: "border-indigo-500 ring-indigo-500/20",
          handleColor: "!bg-indigo-500",
          header: actionType === "add_tag" ? "Apply Tag" : "Remove Tag",
          detail: data.tagName ? `Tag: "${String(data.tagName)}"` : "Configure tag name",
        };
      case "add_to_list":
      case "remove_from_list":
        return {
          icon: Folder,
          badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
          borderHover: "border-teal-300",
          borderSelected: "border-teal-500 ring-teal-500/20",
          handleColor: "!bg-teal-500",
          header: actionType === "add_to_list" ? "Add to List" : "Remove from List",
          detail: data.listName ? `List: "${String(data.listName)}"` : "Select contact list",
        };
      default:
        return {
          icon: Settings,
          badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
          borderHover: "border-slate-300",
          borderSelected: "border-slate-500 ring-slate-500/20",
          handleColor: "!bg-slate-500",
          header: "Action",
          detail: String(data.label || "Workflow Action"),
        };
    }
  };

  const config = getActionConfig();
  const IconComponent = config.icon;

  return (
    <div
      className={`relative min-w-[230px] max-w-[270px] rounded-xl border bg-white p-3.5 shadow-sm transition-all ${
        selected
          ? `${config.borderSelected} ring-2 shadow-md`
          : `border-slate-200 ${config.borderHover} hover:shadow-xs`
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 ${config.handleColor} !border-2 !border-white !-top-1.5 shadow-xs transition-transform hover:scale-125`}
      />

      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <IconComponent className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700">
            {config.header}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${config.badgeColor}`}
        >
          Action
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-xs font-semibold text-slate-900 truncate">
          {String(data.label || config.header)}
        </div>
        <div className="text-[11px] text-slate-500 truncate">
          {config.detail}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-3 !h-3 ${config.handleColor} !border-2 !border-white !-bottom-1.5 shadow-xs transition-transform hover:scale-125`}
      />
    </div>
  );
});
ActionNode.displayName = "ActionNode";

/**
 * Condition Branching Node Component
 */
export const ConditionNode = memo(({ data, selected }: CustomNodeProps) => {
  const conditionType = String(data.conditionType || "has_tag");
  const conditionValue = String(data.conditionValue || data.value || "");

  const formatConditionSummary = () => {
    switch (conditionType) {
      case "has_tag":
        return `Has Tag: "${conditionValue || 'VIP'}"`;
      case "in_list":
        return `In List: "${conditionValue || 'Members'}"`;
      case "domain_matches":
        return `Email ends with "${conditionValue || '@company.com'}"`;
      default:
        return "Evaluate Condition";
    }
  };

  return (
    <div
      className={`relative min-w-[250px] max-w-[290px] rounded-xl border bg-white p-3.5 shadow-sm transition-all ${
        selected
          ? "border-violet-500 ring-2 ring-violet-500/20 shadow-md"
          : "border-violet-200 hover:border-violet-300 hover:shadow-xs"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white !-top-1.5 shadow-xs transition-transform hover:scale-125"
      />

      <div className="flex items-center justify-between pb-2 mb-2 border-b border-violet-50">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-violet-700">
            <GitBranch className="h-3.5 w-3.5" />
          </div>
          <span className="text-[10px] font-bold tracking-wider uppercase text-violet-700">
            Branching Logic
          </span>
        </div>
        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 border border-violet-200/60">
          Condition
        </span>
      </div>

      <div className="space-y-1 mb-3">
        <div className="text-xs font-semibold text-slate-900 truncate">
          {String(data.label || "Check Condition")}
        </div>
        <div className="text-[11px] font-mono text-violet-800 bg-violet-50/70 p-1 rounded border border-violet-100 truncate">
          {formatConditionSummary()}
        </div>
      </div>

      {/* Branching Output Handles */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
        <div className="flex items-center gap-1 text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>YES / TRUE</span>
        </div>
        <div className="flex items-center gap-1 text-rose-500">
          <span>NO / FALSE</span>
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        </div>
      </div>

      {/* YES Handle (Left 25%) */}
      <Handle
        type="source"
        id="true"
        position={Position.Bottom}
        style={{ left: "25%" }}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white !-bottom-1.5 shadow-xs transition-transform hover:scale-125"
      />

      {/* NO Handle (Right 75%) */}
      <Handle
        type="source"
        id="false"
        position={Position.Bottom}
        style={{ left: "75%" }}
        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-white !-bottom-1.5 shadow-xs transition-transform hover:scale-125"
      />
    </div>
  );
});
ConditionNode.displayName = "ConditionNode";

export const nodeTypes = {
  contact_subscribed: TriggerNode,
  contact_added_to_list: TriggerNode,
  tag_assigned: TriggerNode,
  trigger: TriggerNode,
  delay: DelayNode,
  send_email: ActionNode,
  add_tag: ActionNode,
  remove_tag: ActionNode,
  add_to_list: ActionNode,
  remove_from_list: ActionNode,
  action: ActionNode,
  condition: ConditionNode,
};
