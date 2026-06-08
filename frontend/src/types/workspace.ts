export type BlockType = 'text' | 'todo' | 'kanban' | 'chart';

export interface BlockData {
  id: string;
  type: BlockType;
  title: string;
  content: any; // Flexible content based on type
  isLocked?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  blocks: BlockData[];
  isLocked?: boolean;
}

export interface OngoingTask {
  id: string;
  title: string;
}
