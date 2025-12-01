import type { AutomergeUrl } from '@automerge/automerge-repo';

export interface DocCommit {
  id: string;
  parents: string[];
  createdAt: number;
  author?: string;
  message: string;
  content: string;
}

export interface MarkdownHistoryDoc {
  /** URL del documento Markdown principal al que pertenece este historial */
  docUrl: AutomergeUrl;
  /** Lista de commits (versiones) ordenados por creación ascendente */
  commits: DocCommit[];
  /** Identificador del commit considerado HEAD (última versión "oficial") */
  headId?: string;
}
