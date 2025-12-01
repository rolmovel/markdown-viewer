import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, FileText, Split, Eye, PenTool, Share2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import Mermaid from './components/Mermaid';
import { clsx } from 'clsx';
// @ts-ignore
import testContent from './test/test.md?raw';
import { useRepo, useDocument } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl } from '@automerge/automerge-repo';
import type { DirectoryTreeDoc, TreeNode } from './collab/directoryTypes';

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

function App() {
  const repo = useRepo();
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [treeUrl, setTreeUrl] = useState<AutomergeUrl | null>(null);
  const [currentDocUrl, setCurrentDocUrl] = useState<AutomergeUrl | null>(null);
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
  const [treeDoc] = useDocument<DirectoryTreeDoc>(treeUrl ?? undefined);

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

  // Si no hay documento actual seleccionado, crear uno nuevo automáticamente
  useEffect(() => {
    if (currentDocUrl) return;

    const handle = repo.create<MarkdownDoc>();
    handle.change((d: MarkdownDoc) => {
      d.content = '# Nuevo documento\n';
    });
    const newDocUrl = handle.url as AutomergeUrl;

    setCurrentDocUrl(newDocUrl);
    
    // Actualizar la URL para incluir el doc
    const newSearchParams = new URLSearchParams(window.location.search);
    if (treeUrl) newSearchParams.set('tree', treeUrl as string);
    newSearchParams.set('doc', newDocUrl as string);
    const newPath = `${window.location.pathname}?${newSearchParams.toString()}`;
    window.history.replaceState({}, '', newPath);
  }, [currentDocUrl, repo, treeUrl]);
  
  const content = doc?.content ?? '';
  
  const updateContent = (newContent: string) => {
    if (changeDoc) {
      changeDoc((d: MarkdownDoc) => {
        d.content = newContent;
      });
    }
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
