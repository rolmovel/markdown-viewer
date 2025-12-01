import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, FileText, Split, Eye, PenTool, Share2, MessageCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import Mermaid from './components/Mermaid';
import { clsx } from 'clsx';
// @ts-ignore
import testContent from './test/test.md?raw';
import { useRepo, useDocument } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl } from '@automerge/automerge-repo';
import type { DirectoryTreeDoc, TreeNode } from './collab/directoryTypes';
import type { MarkdownHistoryDoc } from './collab/historyTypes';

// Tipo del documento colaborativo
interface MarkdownDoc {
  content: string;
}

// Utilidad para buscar un nodo en el árbol por id
function findNodeById(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

// Comprobar si candidateId está dentro del subárbol de parent
function isDescendant(parent: TreeNode, candidateId: string): boolean {
  if (!parent.children) return false;
  for (const child of parent.children) {
    if (child.id === candidateId) return true;
    if (isDescendant(child, candidateId)) return true;
  }
  return false;
}

function App() {
  const repo = useRepo();
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [treeUrl, setTreeUrl] = useState<AutomergeUrl | null>(null);
  const [currentDocUrl, setCurrentDocUrl] = useState<AutomergeUrl | null>(null);
  const [currentHistoryUrl, setCurrentHistoryUrl] = useState<AutomergeUrl | null>(null);
  const [isCreatingTree, setIsCreatingTree] = useState(false);
  
  const searchParams = new URLSearchParams(window.location.search);
  const treeParam = searchParams.get('tree');
  const docParam = searchParams.get('doc');

  // Inicializar / cargar el documento de árbol colaborativo
  useEffect(() => {
    // Si ya tenemos un tree en la URL y es válido, usarlo
    if (treeParam && treeParam.startsWith('automerge:')) {
      setTreeUrl(treeParam as AutomergeUrl);
      return;
    }

    // Crear árbol nuevo con solo nodo raíz
    if (!isCreatingTree && !treeUrl) {
      setIsCreatingTree(true);
      const handle = repo.create<DirectoryTreeDoc>();
      handle.change((doc: DirectoryTreeDoc) => {
        doc.root = {
          id: crypto.randomUUID(),
          name: '/',
          type: 'folder',
          children: [],
        };
      });
      const newTreeUrl = handle.url as AutomergeUrl;

      const newSearchParams = new URLSearchParams(window.location.search);
      newSearchParams.set('tree', newTreeUrl);
      const newPath = `${window.location.pathname}?${newSearchParams.toString()}`;
      window.history.replaceState({}, '', newPath);

      setTreeUrl(newTreeUrl);
    }
  }, [repo, treeParam, treeUrl, isCreatingTree]);

  // Hook para el árbol de directorios
  const [treeDoc, changeTreeDoc] = useDocument<DirectoryTreeDoc>(treeUrl ?? undefined);

  // Sincronizar currentDocUrl con el parámetro doc
  useEffect(() => {
    if (docParam && docParam.startsWith('automerge:')) {
      setCurrentDocUrl(docParam as AutomergeUrl);
    }
  }, [docParam]);

  // Si no hay docParam pero el árbol tiene currentFileId, seleccionarlo
  useEffect(() => {
    if (!treeDoc || currentDocUrl) return;
    if (treeDoc.currentFileId) {
      const node = findNodeById(treeDoc.root, treeDoc.currentFileId);
      if (node && node.type === 'file' && node.docUrl) {
        setCurrentDocUrl(node.docUrl);
        const newSearchParams = new URLSearchParams(window.location.search);
        newSearchParams.set('tree', (treeUrl ?? '') as string);
        newSearchParams.set('doc', node.docUrl);
        const newPath = `${window.location.pathname}?${newSearchParams.toString()}`;
        window.history.replaceState({}, '', newPath);
      }
    }
  }, [treeDoc, currentDocUrl, treeUrl]);
  
  // Hook oficial para leer/escribir el documento activo
  const [doc, changeDoc] = useDocument<MarkdownDoc>(currentDocUrl ?? undefined);

  // Hook para el historial del documento activo
  const [historyDoc, changeHistoryDoc] = useDocument<MarkdownHistoryDoc>(currentHistoryUrl ?? undefined);
 
  // Si no hay documento actual seleccionado, crear uno nuevo automáticamente
  useEffect(() => {
    if (currentDocUrl) return;

    const handle = repo.create<MarkdownDoc>();
    handle.change((d: MarkdownDoc) => {
      d.content = '# Nuevo documento\n';
    });
    const newDocUrl = handle.url as AutomergeUrl;

    const historyHandle = repo.create<MarkdownHistoryDoc>();
    historyHandle.change((h: MarkdownHistoryDoc) => {
      h.docUrl = newDocUrl;
      h.commits = [];
      delete h.headId;
    });
    const newHistoryUrl = historyHandle.url as AutomergeUrl;

    setCurrentDocUrl(newDocUrl);
    setCurrentHistoryUrl(newHistoryUrl);
  }, [currentDocUrl, repo]);
  
  const content = doc?.content ?? '';
  
  const updateContent = (newContent: string) => {
    if (changeDoc) {
      changeDoc((d: MarkdownDoc) => {
        d.content = newContent;
      });
    }
  };

  const createFileInFolder = (folderId: string) => {
    if (!changeTreeDoc) return;

    // Crear documento de contenido
    const handle = repo.create<MarkdownDoc>();
    handle.change((d: MarkdownDoc) => {
      d.content = '# Nuevo documento\n';
    });
    const newDocUrl = handle.url as AutomergeUrl;

    // Crear documento de historial asociado a este archivo
    const historyHandle = repo.create<MarkdownHistoryDoc>();
    historyHandle.change((h: MarkdownHistoryDoc) => {
      h.docUrl = newDocUrl;
      h.commits = [];
      delete h.headId;
    });
    const newHistoryUrl = historyHandle.url as AutomergeUrl;

    const newId = crypto.randomUUID();

    changeTreeDoc((t: DirectoryTreeDoc) => {
      const folder = findNodeById(t.root, folderId);
      if (!folder || folder.type !== 'folder') return;
      if (!folder.children) folder.children = [];
      folder.children.push({
        id: newId,
        name: 'Nuevo documento',
        type: 'file',
        docUrl: newDocUrl,
        historyUrl: newHistoryUrl,
      });
      t.currentFileId = newId;
    });

    setCurrentDocUrl(newDocUrl);
    setCurrentHistoryUrl(newHistoryUrl);

    const newSearchParams = new URLSearchParams(window.location.search);
    if (treeUrl) newSearchParams.set('tree', treeUrl as string);
    newSearchParams.set('doc', newDocUrl as string);
    const newPath = `${window.location.pathname}?${newSearchParams.toString()}`;
    window.history.replaceState({}, '', newPath);
  };

  const createFolderInFolder = (folderId: string) => {
    if (!changeTreeDoc) return;

    const newId = crypto.randomUUID();
    changeTreeDoc((t: DirectoryTreeDoc) => {
      const folder = findNodeById(t.root, folderId);
      if (!folder || folder.type !== 'folder') return;
      if (!folder.children) folder.children = [];
      folder.children.push({
        id: newId,
        name: 'Nueva carpeta',
        type: 'folder',
        children: [],
      });
    });
  };

  // (Temporal) Creación dentro de carpeta: aún sin implementar lógica completa
  const handleCreateFolderInNode = (_parent: TreeNode) => {
    // TODO: implementar creación de subcarpetas dentro de cualquier carpeta
  };

  const handleCreateFileInNode = (_parent: TreeNode) => {
    // TODO: implementar creación de documentos dentro de cualquier carpeta
  };

  // Mover un nodo a otra carpeta (botón antiguo): delegar en DnD o mostrar aviso
  const handleMoveNode = (_node: TreeNode) => {
    alert('Para mover elementos usa arrastrar y soltar sobre la carpeta destino.');
  };

  // Mover por IDs (usado por DnD en la sidebar)
  const handleMoveByIds = (sourceId: string, targetFolderId: string) => {
    if (!changeTreeDoc || !treeDoc) return;

    // Evitar mover carpeta dentro de sí misma o de un descendiente
    const sourceNode = findNodeById(treeDoc.root, sourceId);
    const targetNode = findNodeById(treeDoc.root, targetFolderId);
    if (!sourceNode || !targetNode || targetNode.type !== 'folder') return;
    if (sourceNode.type === 'folder' && isDescendant(sourceNode, targetFolderId)) return;

    changeTreeDoc((t: DirectoryTreeDoc) => {
      let movedNodePlain: TreeNode | null = null;

      const removeFrom = (parent: TreeNode) => {
        if (!parent.children) return;
        parent.children = parent.children.filter(child => {
          if (child.id === sourceId) {
            // Clonar a un objeto JS plano para evitar referencias al documento Automerge
            movedNodePlain = JSON.parse(JSON.stringify(child)) as TreeNode;
            return false;
          }
          removeFrom(child);
          return true;
        });
      };

      removeFrom(t.root);
      if (!movedNodePlain) return;

      const folder = findNodeById(t.root, targetFolderId);
      if (!folder || folder.type !== 'folder') return;
      if (!folder.children) folder.children = [];
      folder.children.push(movedNodePlain);
    });
  };

  // Crear un nuevo documento Markdown en la raíz del árbol
  const handleCreateFileInRoot = () => {
    if (!treeUrl || !treeDoc) return;
    createFileInFolder(treeDoc.root.id);
  };

  // Crear una nueva carpeta en la raíz del árbol
  const handleCreateFolderInRoot = () => {
    if (!treeDoc) return;
    createFolderInFolder(treeDoc.root.id);
  };

  // Renombrar un nodo (carpeta o documento)
  const handleRenameNode = (node: TreeNode) => {
    if (!changeTreeDoc) return;

    const newName = window.prompt('Nuevo nombre', node.name);
    if (!newName || !newName.trim()) return;

    changeTreeDoc((t: DirectoryTreeDoc) => {
      const target = findNodeById(t.root, node.id);
      if (target) {
        target.name = newName.trim();
      }
    });
  };

  // Eliminar un nodo (carpeta o documento) del árbol
  const handleDeleteNode = (node: TreeNode) => {
    if (!changeTreeDoc || !treeDoc) return;

    const confirmed = window.confirm(
      node.type === 'folder'
        ? '¿Eliminar la carpeta y todo su contenido?'
        : '¿Eliminar este documento del árbol?'
    );
    if (!confirmed) return;

    changeTreeDoc((t: DirectoryTreeDoc) => {
      const removeFrom = (parent: TreeNode) => {
        if (!parent.children) return;
        parent.children = parent.children.filter(child => {
          if (child.id === node.id) return false;
          removeFrom(child);
          return true;
        });
      };
      removeFrom(t.root);

      if (t.currentFileId === node.id) {
        t.currentFileId = undefined;
      }
    });

    // Si el documento activo es el que se borra, limpiar selección y URL
    if (node.type === 'file' && node.docUrl === currentDocUrl) {
      setCurrentDocUrl(null);
      const params = new URLSearchParams(window.location.search);
      params.delete('doc');
      const path = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', path);
    }
  };

  // Seleccionar un archivo desde el árbol
  const handleSelectFile = (node: TreeNode) => {
    if (node.type !== 'file' || !node.docUrl) return;

    // Asegurar que el archivo tiene un documento de historial asociado
    let historyUrl = node.historyUrl;
    if (!historyUrl) {
      const historyHandle = repo.create<MarkdownHistoryDoc>();
      historyHandle.change((h: MarkdownHistoryDoc) => {
        h.docUrl = node.docUrl as AutomergeUrl;
        h.commits = [];
        delete h.headId;
      });
      historyUrl = historyHandle.url as AutomergeUrl;

      if (changeTreeDoc) {
        const createdHistoryUrl = historyUrl;
        changeTreeDoc((t: DirectoryTreeDoc) => {
          const target = findNodeById(t.root, node.id);
          if (target && target.type === 'file') {
            target.historyUrl = createdHistoryUrl;
          }
        });
      }
    }

    setCurrentDocUrl(node.docUrl);
    setCurrentHistoryUrl(historyUrl ?? null);

    if (changeTreeDoc) {
      changeTreeDoc((t: DirectoryTreeDoc) => {
        t.currentFileId = node.id;
      });
    }

    const newSearchParams = new URLSearchParams(window.location.search);
    if (treeUrl) newSearchParams.set('tree', treeUrl as string);
    newSearchParams.set('doc', node.docUrl);
    const newPath = `${window.location.pathname}?${newSearchParams.toString()}`;
    window.history.replaceState({}, '', newPath);
  };

  const handleSaveVersion = () => {
    if (!changeHistoryDoc || !historyDoc) {
      alert('No hay historial cargado para este documento.');
      return;
    }

    const headId = historyDoc.headId;
    if (headId) {
      const headCommit = historyDoc.commits?.find(c => c.id === headId);
      if (headCommit && headCommit.content === content) {
        alert('No hay cambios desde la última versión.');
        return;
      }
    }

    const message = window.prompt('Mensaje para esta versión:', 'Guardado rápido');
    if (!message || !message.trim()) return;

    const newCommitId = crypto.randomUUID();

    changeHistoryDoc(h => {
      if (!h.commits) h.commits = [];
      const parents = h.headId ? [h.headId] : [];
      h.commits.push({
        id: newCommitId,
        parents,
        createdAt: Date.now(),
        message: message.trim(),
        content,
      });
      h.headId = newCommitId;
    });
  };

  // Función para copiar el enlace de colaboración
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Enlace copiado. Compártelo para colaborar en este documento.');
  };
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const handleExportPDF = () => {
    const element = previewRef.current;
    if (!element) return;

    const opt = {
      margin: [10, 10],
      filename: 'documento-markdown.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-2 text-indigo-600">
          <FileText className="w-6 h-6" />
          <h1 className="text-xl font-bold text-slate-800">Markdown Editor</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('edit')}
              className={clsx(
                "p-2 rounded-md transition-colors",
                viewMode === 'edit' ? "bg-white shadow text-indigo-600" : "text-slate-500 hover:text-slate-700"
              )}
              title="Solo Editor"
            >
              <PenTool className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={clsx(
                "p-2 rounded-md transition-colors",
                viewMode === 'split' ? "bg-white shadow text-indigo-600" : "text-slate-500 hover:text-slate-700"
              )}
              title="Dividido"
            >
              <Split className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={clsx(
                "p-2 rounded-md transition-colors",
                viewMode === 'preview' ? "bg-white shadow text-indigo-600" : "text-slate-500 hover:text-slate-700"
              )}
              title="Solo Vista Previa"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={copyShareLink}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
            title="Copiar enlace para colaborar"
          >
            <Share2 className="w-4 h-4" />
            Compartir
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>

          {/* Botones de guardado de versión y asistente desactivados */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className={clsx(
            "flex flex-col border-r border-slate-200 bg-white transition-all duration-300",
            viewMode === 'edit' ? "w-full" : viewMode === 'split' ? "w-1/2" : "w-0 hidden"
          )}>
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Editor (Markdown)
            </div>
            {currentDocUrl ? (
              <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => updateContent(e.target.value)}
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  setSelectionStart(target.selectionStart);
                  setSelectionEnd(target.selectionEnd);
                }}
                className="flex-1 w-full p-6 resize-none outline-none font-mono text-sm leading-relaxed text-slate-800"
                placeholder="Escribe tu markdown aquí..."
                spellCheck={false}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                Crea o selecciona un documento en la barra lateral.
              </div>
            )}
          </div>

          {/* Preview */}
          <div className={clsx(
            "flex flex-col bg-white transition-all duration-300",
            viewMode === 'preview' ? "w-full" : viewMode === 'split' ? "w-1/2" : "w-0 hidden"
          )}>
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
            <span>Vista Previa</span>
          </div>
          <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div 
              ref={previewRef} 
              className={clsx(
                "pdf-page prose prose-lg prose-slate max-w-none bg-white p-16 rounded-xl shadow-sm min-h-full mx-auto border border-slate-100",
                // Personalización específica de cabeceras
                "prose-headings:font-bold prose-headings:text-slate-800",
                "prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-slate-200",
                "prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-indigo-700",
                "prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-slate-600",
                // Párrafos y listas
                "prose-p:leading-7 prose-p:text-slate-600",
                "prose-li:marker:text-indigo-500 prose-li:text-slate-600",
                // Bloques de código y pre (fondo gris muy suave, sin marco marcado)
                "prose-pre:bg-slate-100 prose-pre:shadow-none prose-pre:border-0",
                "prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
                // Citas y otros elementos
                "prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:text-slate-600",
                "prose-table:border-collapse prose-th:bg-slate-100 prose-th:p-3 prose-td:p-3 prose-tr:border-b prose-tr:border-slate-100"
              )}
              style={{ width: '210mm', minHeight: '297mm' }} // A4 size approx for WYSIWYG feel
            >
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code(props: any) {
                    const {children, className, node, ...rest} = props;
                    const match = /language-(\w+)/.exec(className || '');
                    const isMermaid = match && match[1] === 'mermaid';

                    if (isMermaid) {
                      return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                    }

                    return match ? (
                      <div className="relative group">
                        <div className="absolute right-2 top-2 text-xs text-slate-400 font-mono">{match[1]}</div>
                        <code {...rest} className={className}>
                          {children}
                        </code>
                      </div>
                    ) : (
                      <code {...rest} className={className}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {content}
              </Markdown>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* Asistente desactivado */}
    </div>
  );
}

export default App;
