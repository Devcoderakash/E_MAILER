export type BlockType =
  | "header"
  | "heading"
  | "text"
  | "button"
  | "image"
  | "divider"
  | "spacer"
  | "columns"
  | "footer";

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeaderBlock extends BaseBlock {
  type: "header";
  title: string;
  subtitle?: string;
  bgColor: string;
  textColor: string;
  align: "left" | "center" | "right";
  padding: number;
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  color: string;
  align: "left" | "center" | "right";
  paddingTop: number;
  paddingBottom: number;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  content: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  align: "left" | "center" | "right";
  paddingTop: number;
  paddingBottom: number;
}

export interface ButtonBlock extends BaseBlock {
  type: "button";
  text: string;
  url: string;
  bgColor: string;
  textColor: string;
  borderRadius: number;
  align: "left" | "center" | "right";
  paddingY: number;
  paddingX: number;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  alt: string;
  width: number;
  align: "left" | "center" | "right";
  url?: string;
  borderRadius: number;
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
  color: string;
  thickness: number;
  style: "solid" | "dashed" | "dotted";
  margin: number;
}

export interface SpacerBlock extends BaseBlock {
  type: "spacer";
  height: number;
}

export interface ColumnsBlock extends BaseBlock {
  type: "columns";
  leftContent: string;
  rightContent: string;
  bgColor?: string;
  padding: number;
}

export interface FooterBlock extends BaseBlock {
  type: "footer";
  companyName: string;
  address: string;
  unsubscribeText: string;
  bgColor: string;
  textColor: string;
}

export type EmailBlock =
  | HeaderBlock
  | HeadingBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | FooterBlock;

export interface EditorDocument {
  blocks: EmailBlock[];
  settings: {
    contentWidth: number;
    backgroundColor: string;
    cardColor: string;
    fontFamily: string;
  };
}

export interface SampleMergeVariables {
  first_name: string;
  last_name: string;
  email: string;
  company: string;
}
