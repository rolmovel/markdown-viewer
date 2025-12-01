import { Folder, FileText, Plus, ChevronDown, Pencil, Trash2, Move } from 'lucide-react';
import { clsx } from 'clsx';
import type { TreeNode } from '../collab/directoryTypes';

interface DirectorySidebarProps {
  tree: TreeNode | null;
  currentFileId?: string;
  onSelectFile: (node: TreeNode) => void;
  onCreateFileInRoot: () => void;
  onCreateFolderInRoot: () => void;
  onRenameNode: (node: TreeNode) => void;
  onDeleteNode: (node: TreeNode) => void;
  onMoveNode: (node: TreeNode) => void;
  onCreateFolderInNode: (parent: TreeNode) => void;
  onCreateFileInNode: (parent: TreeNode) => void;
  // DnD: mover un nodo (sourceId) a una carpeta destino (targetFolderId)
  onMoveByIds: (sourceId: string, targetFolderId: string) => void;
}

function renderNode(
  node: TreeNode,
  currentFileId: string | undefined,
  onSelectFile: (node: TreeNode) => void,
  onRenameNode: (node: TreeNode) => void,
  onDeleteNode: (node: TreeNode) => void,
  onMoveNode: (node: TreeNode) => void,
  onCreateFolderInNode: (parent: TreeNode) => void,
  onCreateFileInNode: (parent: TreeNode) => void,
  onMoveByIds: (sourceId: string, targetFolderId: string) => void,
  depth = 0,
) {
  const isFile = node.type === 'file';
  const isActive = isFile && node.id === currentFileId;

  if (node.type === 'folder') {
    return (
      <div
        key={node.id}
        className="space-y-1"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sourceId = e.dataTransfer.getData('text/plain');
          if (!sourceId || sourceId === node.id) return;
          onMoveByIds(sourceId, node.id);
        }}
      >
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600 uppercase px-2 mt-3 group">
          <div className="flex items-center gap-2">
            <Folder className="w-3 h-3" />
            <span>{node.name}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onCreateFolderInNode(node)}
              className="p-1 rounded hover:bg-slate-200"
              title="Nueva subcarpeta"
            >
              <Folder className="w-3 h-3" />
            </button>
            <button
              onClick={() => onCreateFileInNode(node)}
              className="p-1 rounded hover:bg-slate-200"
              title="Nuevo documento en esta carpeta"
            >
              <FileText className="w-3 h-3" />
            </button>
            <button
              onClick={() => onRenameNode(node)}
              className="p-1 rounded hover:bg-slate-200"
              title="Renombrar carpeta"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onMoveNode(node)}
              className="p-1 rounded hover:bg-slate-200"
              title="Mover carpeta"
            >
              <Move className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDeleteNode(node)}
              className="p-1 rounded hover:bg-red-100 text-red-500"
              title="Eliminar carpeta"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="ml-3 border-l border-slate-200 pl-2 space-y-0.5">
          {node.children?.map(child =>
            renderNode(
              child,
              currentFileId,
              onSelectFile,
              onRenameNode,
              onDeleteNode,
              onMoveNode,
              onCreateFolderInNode,
              onCreateFileInNode,
              onMoveByIds,
              depth + 1,
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      key={node.id}
      className="flex items-center justify-between gap-2 group px-1"
    >
      <button
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', node.id);
        }}
        onClick={() => onSelectFile(node)}
        className={clsx(
          'flex-1 flex items-center gap-2 px-1.5 py-1.5 text-xs rounded-md text-left transition-colors',
          isActive
            ? 'bg-indigo-100 text-indigo-700 font-semibold'
            : 'text-slate-600 hover:bg-slate-100'
        )}
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="truncate">{node.name}</span>
      </button>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRenameNode(node)}
          className="p-1 rounded hover:bg-slate-200"
          title="Renombrar documento"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={() => onMoveNode(node)}
          className="p-1 rounded hover:bg-slate-200"
          title="Mover documento"
        >
          <Move className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDeleteNode(node)}
          className="p-1 rounded hover:bg-red-100 text-red-500"
          title="Eliminar documento"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function DirectorySidebar({
  tree,
  currentFileId,
  onSelectFile,
  onCreateFileInRoot,
  onCreateFolderInRoot,
  onRenameNode,
  onDeleteNode,
  onMoveNode,
  onCreateFolderInNode,
  onCreateFileInNode,
  onMoveByIds,
}: DirectorySidebarProps) {
  return (
    <aside className="w-56 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-1 text-xs font-semibold text-slate-600 uppercase tracking-wide">
          <ChevronDown className="w-3 h-3" />
          <span>Documentos</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateFolderInRoot}
            className="inline-flex items-center justify-center w-5 h-5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
            title="Nueva carpeta en la raíz"
          >
            <Folder className="w-3 h-3" />
          </button>
          <button
            onClick={onCreateFileInRoot}
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
            title="Nuevo documento en la raíz"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 text-xs">
        {tree ? (
          renderNode(
            tree,
            currentFileId,
            onSelectFile,
            onRenameNode,
            onDeleteNode,
            onMoveNode,
            onCreateFolderInNode,
            onCreateFileInNode,
            onMoveByIds,
          )
        ) : (
          <p className="text-[11px] text-slate-400 px-2 mt-2">
            Cargando árbol de directorios...
          </p>
        )}
      </div>
    </aside>
  );
}
