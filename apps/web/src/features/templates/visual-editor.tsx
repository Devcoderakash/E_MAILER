import { useState } from "react";
import {
  Type,
  Heading,
  Image as ImageIcon,
  Square,
  Minus,
  MoveVertical,
  Columns as ColumnsIcon,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Plus,
  Palette,
  Sliders,
  Sparkles,
} from "lucide-react";
import {
  EditorDocument,
  EmailBlock,
  BlockType,
  HeaderBlock,
  HeadingBlock,
  TextBlock,
  ButtonBlock,
  ImageBlock,
  DividerBlock,
  SpacerBlock,
} from "./types";

interface VisualEditorProps {
  document: EditorDocument;
  onChange: (doc: EditorDocument) => void;
  onInsertVariable?: (variableTag: string) => void;
}

export function VisualEditor({
  document,
  onChange,
  onInsertVariable,
}: VisualEditorProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    document.blocks[0]?.id || null
  );
  const [activeTab, setActiveTab] = useState<"blocks" | "style">("blocks");

  const selectedBlock = document.blocks.find((b) => b.id === selectedBlockId);

  // Helper to update document blocks
  const updateBlocks = (newBlocks: EmailBlock[]) => {
    onChange({ ...document, blocks: newBlocks });
  };

  // Helper to update a single block
  const updateSelectedBlock = (partial: Partial<EmailBlock>) => {
    if (!selectedBlockId) return;
    const newBlocks = document.blocks.map((b) =>
      b.id === selectedBlockId ? ({ ...b, ...partial } as EmailBlock) : b
    );
    updateBlocks(newBlocks);
  };

  // Helper to update global document settings
  const updateSettings = (partial: Partial<EditorDocument["settings"]>) => {
    onChange({
      ...document,
      settings: { ...document.settings, ...partial },
    });
  };

  // Add block
  const addBlock = (type: BlockType) => {
    const id = `blk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let newBlock: EmailBlock;

    switch (type) {
      case "header":
        newBlock = {
          id,
          type: "header",
          title: "Announcing Our Latest Feature",
          subtitle: "Designed to help {{company}} grow faster",
          bgColor: "#4f46e5",
          textColor: "#ffffff",
          align: "center",
          padding: 32,
        };
        break;
      case "heading":
        newBlock = {
          id,
          type: "heading",
          text: "Headline for {{first_name}}",
          level: 2,
          color: "#0f172a",
          align: "left",
          paddingTop: 16,
          paddingBottom: 8,
        };
        break;
      case "text":
        newBlock = {
          id,
          type: "text",
          content:
            "Write your personalized message here. You can refer to {{company}} or {{first_name}} anywhere in this paragraph.",
          fontSize: 15,
          lineHeight: 1.6,
          color: "#334155",
          align: "left",
          paddingTop: 8,
          paddingBottom: 14,
        };
        break;
      case "button":
        newBlock = {
          id,
          type: "button",
          text: "Confirm Your Email",
          url: "https://mailpilot.io",
          bgColor: "#4f46e5",
          textColor: "#ffffff",
          borderRadius: 6,
          align: "center",
          paddingY: 12,
          paddingX: 24,
        };
        break;
      case "image":
        newBlock = {
          id,
          type: "image",
          src: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80",
          alt: "Hero Visual",
          width: 520,
          align: "center",
          borderRadius: 6,
        };
        break;
      case "divider":
        newBlock = {
          id,
          type: "divider",
          color: "#e2e8f0",
          thickness: 1,
          style: "solid",
          margin: 16,
        };
        break;
      case "spacer":
        newBlock = {
          id,
          type: "spacer",
          height: 24,
        };
        break;
      case "columns":
        newBlock = {
          id,
          type: "columns",
          leftContent:
            "<strong style='color:#0f172a;'>Feature 1</strong><br />Describe the first benefit for {{company}}.",
          rightContent:
            "<strong style='color:#0f172a;'>Feature 2</strong><br />Highlight another capability your team will love.",
          bgColor: "#f8fafc",
          padding: 16,
        };
        break;
      case "footer":
        newBlock = {
          id,
          type: "footer",
          companyName: "MailPilot Platform",
          address: "San Francisco, CA • Sent to {{email}}",
          unsubscribeText: "Unsubscribe from these emails",
          bgColor: "#f8fafc",
          textColor: "#64748b",
        };
        break;
    }

    updateBlocks([...document.blocks, newBlock]);
    setSelectedBlockId(id);
  };

  // Move block up
  const moveBlockUp = (index: number) => {
    if (index <= 0) return;
    const newBlocks = [...document.blocks];
    const temp = newBlocks[index - 1];
    newBlocks[index - 1] = newBlocks[index];
    newBlocks[index] = temp;
    updateBlocks(newBlocks);
  };

  // Move block down
  const moveBlockDown = (index: number) => {
    if (index >= document.blocks.length - 1) return;
    const newBlocks = [...document.blocks];
    const temp = newBlocks[index + 1];
    newBlocks[index + 1] = newBlocks[index];
    newBlocks[index] = temp;
    updateBlocks(newBlocks);
  };

  // Duplicate block
  const duplicateBlock = (index: number) => {
    const blockToClone = document.blocks[index];
    const clone: EmailBlock = {
      ...blockToClone,
      id: `blk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    const newBlocks = [...document.blocks];
    newBlocks.splice(index + 1, 0, clone);
    updateBlocks(newBlocks);
    setSelectedBlockId(clone.id);
  };

  // Delete block
  const deleteBlock = (id: string) => {
    const newBlocks = document.blocks.filter((b) => b.id !== id);
    updateBlocks(newBlocks);
    if (selectedBlockId === id) {
      setSelectedBlockId(newBlocks[0]?.id || null);
    }
  };

  // Handle Drag & Drop reorder
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newBlocks = [...document.blocks];
    const draggedItem = newBlocks[draggedIndex];
    newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    updateBlocks(newBlocks);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="flex h-full min-h-[640px] flex-col lg:flex-row rounded-xl border border-slate-200/80 bg-slate-100 overflow-hidden shadow-xs">
      {/* Left Block Palette / Settings Sidebar */}
      <div className="w-full lg:w-72 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
        {/* Tab switch */}
        <div className="flex border-b border-slate-200 p-2 gap-1 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab("blocks")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "blocks"
                ? "bg-white text-indigo-600 shadow-xs border border-slate-200/80"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Blocks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("style")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === "style"
                ? "bg-white text-indigo-600 shadow-xs border border-slate-200/80"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Style Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {activeTab === "blocks" ? (
            <div className="space-y-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Click or Drag to Insert
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { type: "header", label: "Hero Header", icon: Sparkles },
                  { type: "heading", label: "Heading", icon: Heading },
                  { type: "text", label: "Paragraph", icon: Type },
                  { type: "button", label: "Button CTA", icon: Square },
                  { type: "image", label: "Image", icon: ImageIcon },
                  { type: "divider", label: "Divider", icon: Minus },
                  { type: "spacer", label: "Spacer", icon: MoveVertical },
                  { type: "columns", label: "2 Columns", icon: ColumnsIcon },
                  { type: "footer", label: "Footer", icon: Sliders },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => addBlock(item.type as BlockType)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-300 transition-all text-slate-700 hover:text-indigo-600 group"
                    >
                      <Icon className="h-4 w-4 mb-1 text-slate-500 group-hover:text-indigo-600" />
                      <span className="font-medium text-[11px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Merge Variable Quick Insert */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Merge Variables
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "{{first_name}}",
                    "{{last_name}}",
                    "{{email}}",
                    "{{company}}",
                  ].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onInsertVariable?.(v)}
                      className="rounded bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 text-[10px] font-mono font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                      title="Copy variable tag"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Content Width (Max: {document.settings.contentWidth}px)
                </label>
                <input
                  type="range"
                  min={480}
                  max={720}
                  step={10}
                  value={document.settings.contentWidth}
                  onChange={(e) =>
                    updateSettings({ contentWidth: parseInt(e.target.value, 10) })
                  }
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Canvas Background Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={document.settings.backgroundColor}
                    onChange={(e) =>
                      updateSettings({ backgroundColor: e.target.value })
                    }
                    className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={document.settings.backgroundColor}
                    onChange={(e) =>
                      updateSettings({ backgroundColor: e.target.value })
                    }
                    className="w-full h-8 rounded-lg border border-slate-200 px-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Card Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={document.settings.cardColor}
                    onChange={(e) =>
                      updateSettings({ cardColor: e.target.value })
                    }
                    className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={document.settings.cardColor}
                    onChange={(e) =>
                      updateSettings({ cardColor: e.target.value })
                    }
                    className="w-full h-8 rounded-lg border border-slate-200 px-2 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Interactive Email Canvas */}
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-start justify-center transition-colors"
        style={{ backgroundColor: document.settings.backgroundColor }}
      >
        <div
          className="w-full rounded-xl border border-slate-200/90 shadow-md overflow-hidden transition-all"
          style={{
            maxWidth: `${document.settings.contentWidth}px`,
            backgroundColor: document.settings.cardColor,
          }}
        >
          {document.blocks.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Type className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-600">Canvas is empty</p>
              <p className="mt-1">Add a block from the left panel to begin.</p>
            </div>
          ) : (
            document.blocks.map((block, index) => {
              const isSelected = selectedBlockId === block.id;

              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`relative group cursor-pointer border-2 transition-all ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/10 shadow-xs"
                      : "border-transparent hover:border-indigo-300"
                  }`}
                >
                  {/* Floating Action Toolbar on Selected/Hovered Block */}
                  {isSelected && (
                    <div className="absolute right-2 -top-3 z-30 flex items-center gap-1 rounded-md bg-indigo-600 px-1.5 py-0.5 text-white shadow-md animate-in fade-in duration-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1">
                        {block.type}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBlockUp(index);
                        }}
                        disabled={index === 0}
                        className="rounded p-0.5 hover:bg-indigo-700 disabled:opacity-40"
                        title="Move Up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveBlockDown(index);
                        }}
                        disabled={index === document.blocks.length - 1}
                        className="rounded p-0.5 hover:bg-indigo-700 disabled:opacity-40"
                        title="Move Down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateBlock(index);
                        }}
                        className="rounded p-0.5 hover:bg-indigo-700"
                        title="Duplicate Block"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBlock(block.id);
                        }}
                        className="rounded p-0.5 hover:bg-rose-600"
                        title="Delete Block"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Render Visual Blocks on Canvas */}
                  <div className="pointer-events-auto">
                    {renderCanvasBlock(block, (partial) => {
                      const newBlocks = document.blocks.map((b) =>
                        b.id === block.id ? ({ ...b, ...partial } as EmailBlock) : b
                      );
                      updateBlocks(newBlocks);
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Block Property Inspector Sidebar */}
      {selectedBlock && (
        <div className="w-full lg:w-72 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-4 shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Palette className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                {selectedBlock.type} Properties
              </h4>
            </div>
            <button
              type="button"
              onClick={() => deleteBlock(selectedBlock.id)}
              className="text-slate-400 hover:text-rose-600 p-1 rounded"
              title="Delete Block"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-3.5 text-xs">
            {renderBlockInspector(selectedBlock, updateSelectedBlock)}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to render live canvas blocks
function renderCanvasBlock(
  block: EmailBlock,
  update: (partial: Partial<EmailBlock>) => void
) {
  switch (block.type) {
    case "header":
      return (
        <div
          style={{
            backgroundColor: block.bgColor,
            padding: `${block.padding}px 24px`,
            textAlign: block.align,
          }}
        >
          <input
            type="text"
            value={block.title}
            onChange={(e) => update({ title: e.target.value })}
            className="w-full bg-transparent font-bold text-2xl border-none focus:outline-none focus:ring-1 focus:ring-white/40 rounded px-1"
            style={{ color: block.textColor, textAlign: block.align }}
          />
          {block.subtitle !== undefined && (
            <input
              type="text"
              value={block.subtitle}
              onChange={(e) => update({ subtitle: e.target.value })}
              className="w-full bg-transparent text-sm mt-1 border-none focus:outline-none focus:ring-1 focus:ring-white/40 rounded px-1"
              style={{ color: block.textColor, opacity: 0.9, textAlign: block.align }}
            />
          )}
        </div>
      );

    case "heading":
      return (
        <div
          style={{
            paddingTop: `${block.paddingTop}px`,
            paddingBottom: `${block.paddingBottom}px`,
            paddingLeft: "24px",
            paddingRight: "24px",
            textAlign: block.align,
          }}
        >
          <input
            type="text"
            value={block.text}
            onChange={(e) => update({ text: e.target.value })}
            className="w-full bg-transparent font-bold text-xl border-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
            style={{ color: block.color, textAlign: block.align }}
          />
        </div>
      );

    case "text":
      return (
        <div
          style={{
            paddingTop: `${block.paddingTop}px`,
            paddingBottom: `${block.paddingBottom}px`,
            paddingLeft: "24px",
            paddingRight: "24px",
          }}
        >
          <textarea
            rows={3}
            value={block.content}
            onChange={(e) => update({ content: e.target.value })}
            className="w-full bg-transparent border-none resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded p-1"
            style={{
              fontSize: `${block.fontSize}px`,
              lineHeight: block.lineHeight,
              color: block.color,
              textAlign: block.align,
            }}
          />
        </div>
      );

    case "button":
      return (
        <div
          style={{
            padding: "20px 24px",
            textAlign: block.align,
          }}
        >
          <span
            style={{
              display: "inline-block",
              backgroundColor: block.bgColor,
              color: block.textColor,
              borderRadius: `${block.borderRadius}px`,
              padding: `${block.paddingY}px ${block.paddingX}px`,
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            {block.text}
          </span>
        </div>
      );

    case "image":
      return (
        <div style={{ padding: "16px 24px", textAlign: block.align }}>
          <img
            src={block.src}
            alt={block.alt}
            style={{
              display: "inline-block",
              maxWidth: "100%",
              width: `${block.width}px`,
              borderRadius: `${block.borderRadius}px`,
            }}
          />
        </div>
      );

    case "divider":
      return (
        <div style={{ padding: `${block.margin}px 24px` }}>
          <div
            style={{
              borderTop: `${block.thickness}px ${block.style} ${block.color}`,
              width: "100%",
            }}
          />
        </div>
      );

    case "spacer":
      return <div style={{ height: `${block.height}px` }} />;

    case "columns":
      return (
        <div
          style={{
            padding: `${block.padding}px 24px`,
            backgroundColor: block.bgColor || "transparent",
          }}
        >
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div
              className="p-2 border border-dashed border-slate-300 rounded bg-white/60"
              dangerouslySetInnerHTML={{ __html: block.leftContent }}
            />
            <div
              className="p-2 border border-dashed border-slate-300 rounded bg-white/60"
              dangerouslySetInnerHTML={{ __html: block.rightContent }}
            />
          </div>
        </div>
      );

    case "footer":
      return (
        <div
          style={{
            backgroundColor: block.bgColor,
            color: block.textColor,
            padding: "24px 20px",
            textAlign: "center",
            fontSize: "12px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <p className="font-semibold">{block.companyName}</p>
          <p className="mt-1">{block.address}</p>
          <p className="mt-2 underline text-[11px] cursor-pointer">
            {block.unsubscribeText}
          </p>
        </div>
      );
  }
}

// Helper to render Inspector form controls
function renderBlockInspector(
  block: EmailBlock,
  update: (partial: Partial<EmailBlock>) => void
) {
  switch (block.type) {
    case "header": {
      const b = block as HeaderBlock;
      return (
        <>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={b.title}
              onChange={(e) => update({ title: e.target.value })}
              className="w-full h-8 rounded border border-slate-200 px-2"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Subtitle</label>
            <input
              type="text"
              value={b.subtitle || ""}
              onChange={(e) => update({ subtitle: e.target.value })}
              className="w-full h-8 rounded border border-slate-200 px-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Background</label>
              <input
                type="color"
                value={b.bgColor}
                onChange={(e) => update({ bgColor: e.target.value })}
                className="w-full h-8 rounded border border-slate-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Text Color</label>
              <input
                type="color"
                value={b.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
                className="w-full h-8 rounded border border-slate-200 cursor-pointer"
              />
            </div>
          </div>
        </>
      );
    }

    case "heading": {
      const b = block as HeadingBlock;
      return (
        <>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Level</label>
            <div className="flex gap-2">
              {[1, 2, 3].map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => update({ level: l as 1 | 2 | 3 })}
                  className={`flex-1 py-1 rounded border text-xs font-semibold ${
                    b.level === l
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  H{l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={b.color}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
              />
              <input
                type="text"
                value={b.color}
                onChange={(e) => update({ color: e.target.value })}
                className="w-full h-8 rounded border border-slate-200 px-2 font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Alignment</label>
            <div className="flex gap-2">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update({ align: a })}
                  className={`flex-1 py-1 rounded border text-xs capitalize ${
                    b.align === a
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    }

    case "text": {
      const b = block as TextBlock;
      return (
        <>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Font Size ({b.fontSize}px)</label>
            <input
              type="range"
              min={12}
              max={22}
              value={b.fontSize}
              onChange={(e) => update({ fontSize: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={b.color}
                onChange={(e) => update({ color: e.target.value })}
                className="h-8 w-8 rounded border border-slate-200 cursor-pointer"
              />
              <input
                type="text"
                value={b.color}
                onChange={(e) => update({ color: e.target.value })}
                className="w-full h-8 rounded border border-slate-200 px-2 font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Alignment</label>
            <div className="flex gap-2">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update({ align: a })}
                  className={`flex-1 py-1 rounded border text-xs capitalize ${
                    b.align === a
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    }

    case "button": {
      const b = block as ButtonBlock;
      return (
        <>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Button Label</label>
            <input
              type="text"
              value={b.text}
              onChange={(e) => update({ text: e.target.value })}
              className="w-full h-8 rounded border border-slate-200 px-2"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Link URL</label>
            <input
              type="url"
              value={b.url}
              onChange={(e) => update({ url: e.target.value })}
              className="w-full h-8 rounded border border-slate-200 px-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Button Color</label>
              <input
                type="color"
                value={b.bgColor}
                onChange={(e) => update({ bgColor: e.target.value })}
                className="w-full h-8 rounded border border-slate-200 cursor-pointer"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Text Color</label>
              <input
                type="color"
                value={b.textColor}
                onChange={(e) => update({ textColor: e.target.value })}
                className="w-full h-8 rounded border border-slate-200 cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Corner Radius ({b.borderRadius}px)</label>
            <input
              type="range"
              min={0}
              max={24}
              value={b.borderRadius}
              onChange={(e) => update({ borderRadius: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Alignment</label>
            <div className="flex gap-2">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update({ align: a })}
                  className={`flex-1 py-1 rounded border text-xs capitalize ${
                    b.align === a
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    }

    case "image": {
      const b = block as ImageBlock;
      return (
        <>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Image URL</label>
            <input
              type="url"
              value={b.src}
              onChange={(e) => update({ src: e.target.value })}
              className="w-full h-8 rounded border border-slate-200 px-2"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Alt Description</label>
            <input
              type="text"
              value={b.alt}
              onChange={(e) => update({ alt: e.target.value })}
              className="w-full h-8 rounded border border-slate-200 px-2"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Width ({b.width}px)</label>
            <input
              type="range"
              min={100}
              max={600}
              step={10}
              value={b.width}
              onChange={(e) => update({ width: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </>
      );
    }

    case "divider": {
      const b = block as DividerBlock;
      return (
        <>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Divider Color</label>
            <input
              type="color"
              value={b.color}
              onChange={(e) => update({ color: e.target.value })}
              className="w-full h-8 rounded border border-slate-200 cursor-pointer"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Thickness ({b.thickness}px)</label>
            <input
              type="range"
              min={1}
              max={6}
              value={b.thickness}
              onChange={(e) => update({ thickness: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-600"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Spacing Margin ({b.margin}px)</label>
            <input
              type="range"
              min={8}
              max={40}
              value={b.margin}
              onChange={(e) => update({ margin: parseInt(e.target.value, 10) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </>
      );
    }

    case "spacer": {
      const b = block as SpacerBlock;
      return (
        <div>
          <label className="block font-medium text-slate-700 mb-1">Height ({b.height}px)</label>
          <input
            type="range"
            min={10}
            max={80}
            step={2}
            value={b.height}
            onChange={(e) => update({ height: parseInt(e.target.value, 10) })}
            className="w-full accent-indigo-600"
          />
        </div>
      );
    }

    default:
      return null;
  }
}
