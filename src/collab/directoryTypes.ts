import type { AutomergeUrl } from '@automerge/automerge-repo';

export type NodeType = 'folder' | 'file';

export interface TreeNode {
  id: string;
  name: string;
  type: NodeType;
  children?: TreeNode[];
  docUrl?: AutomergeUrl; // solo para archivos
  historyUrl?: AutomergeUrl; // documento de historial asociado al archivo
}

export interface DirectoryTreeDoc {
  root: TreeNode;
  /** id del nodo archivo actualmente seleccionado (opcional) */
  currentFileId?: string;
}
