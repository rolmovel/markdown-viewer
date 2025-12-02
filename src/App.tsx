import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, FileText, Split, Eye, PenTool, Share2, Clock } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import Mermaid from './components/Mermaid';
import KrokiDiagram from './components/KrokiDiagram';
import { clsx } from 'clsx';
// @ts-ignore
import testContent from './test/test.md?raw';
import { useRepo, useDocument } from '@automerge/automerge-repo-react-hooks';
import type { AutomergeUrl } from '@automerge/automerge-repo';
import type { DirectoryTreeDoc, TreeNode } from './collab/directoryTypes';
import type { MarkdownHistoryDoc, DocCommit } from './collab/historyTypes';
import DiagramHelpModal from './components/DiagramHelpModal';

// Tipo del documento colaborativo
interface Annotation {
  id: string;
  type: 'text' | 'diagram';
  start: number;
  end: number;
  codeBlockStart?: number;
  codeBlockEnd?: number;
  body: string;
  createdAt: string;
  resolved: boolean;
}

interface MarkdownDoc {
  content: string;
  annotations: Annotation[];
  historyUrl?: AutomergeUrl;
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
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('syncEnabled');
    return stored !== 'false';
  });
  const [, setCurrentBlock] = useState<{
    lang: string;
    start: number;
    end: number;
  } | null>(null);
  const [isDiagramHelpOpen, setIsDiagramHelpOpen] = useState(false);
  const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState(false);
  const [pendingAnnotationRange, setPendingAnnotationRange] = useState<{ start: number; end: number } | null>(null);
  const [pendingAnnotationBody, setPendingAnnotationBody] = useState('');
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(true);
  const [sidePanelTab, setSidePanelTab] = useState<'annotations' | 'history'>('annotations');
  const [historyDocUrl, setHistoryDocUrl] = useState<AutomergeUrl | null>(null);
  const [isHistoryPreviewOpen, setIsHistoryPreviewOpen] = useState(false);
  const [historyPreviewCommitId, setHistoryPreviewCommitId] = useState<string | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [pendingSnapshotMessage, setPendingSnapshotMessage] = useState('');
  
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

  // Hook para el árbol de directorios (aunque la UI de árbol no se muestre, el doc sigue existiendo)
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

  // Documento de historial asociado al documento Markdown actual (se crea bajo demanda)
  const [historyDoc, changeHistoryDoc] = useDocument<MarkdownHistoryDoc>(historyDocUrl ?? undefined);
  
  // Si no hay documento actual seleccionado **y tampoco viene uno en la URL**, crear uno nuevo automáticamente
  useEffect(() => {
    // Si ya tenemos doc seleccionado, no hacer nada
    if (currentDocUrl) return;

    // Si la URL ya trae un doc=automerge:..., respetarlo y no crear uno nuevo
    if (docParam && docParam.startsWith('automerge:')) return;

    const handle = repo.create<MarkdownDoc>();
    handle.change((d: MarkdownDoc) => {
      d.content = '# Nuevo documento\n';
      d.annotations = [] as any;
    });
    const newDocUrl = handle.url as AutomergeUrl;

    setCurrentDocUrl(newDocUrl);
    
    // Actualizar la URL para incluir el doc
    const newSearchParams = new URLSearchParams(window.location.search);
    if (treeUrl) newSearchParams.set('tree', treeUrl as string);
    newSearchParams.set('doc', newDocUrl as string);
    const newPath = `${window.location.pathname}?${newSearchParams.toString()}`;
    window.history.replaceState({}, '', newPath);
  }, [currentDocUrl, repo, treeUrl, docParam]);
  
  const content = doc?.content ?? '';
  const annotations: Annotation[] = doc?.annotations ?? [];
  const historyCommits: DocCommit[] = historyDoc?.commits ?? [];
  const historyPreviewCommit =
    historyPreviewCommitId && historyCommits
      ? historyCommits.find((c) => c.id === historyPreviewCommitId) ?? null
      : null;
  
  const updateContent = (newContent: string) => {
    if (changeDoc) {
      changeDoc((d: MarkdownDoc) => {
        d.content = newContent;
      });
    }
  };

  // Asegurar que exista un documento de historial para el documento actual (compartido vía MarkdownDoc.historyUrl)
  useEffect(() => {
    if (!currentDocUrl || !repo || !doc) {
      setHistoryDocUrl(null);
      return;
    }

    // Si el propio documento ya conoce su historyUrl, usarlo directamente
    if (doc.historyUrl) {
      setHistoryDocUrl(doc.historyUrl as AutomergeUrl);
      return;
    }

    // Migración opcional desde historiales locales previos (si existen)
    let migratedUrl: AutomergeUrl | null = null;
    if (typeof window !== 'undefined') {
      const key = `history:${currentDocUrl}`;
      const existing = window.localStorage.getItem(key);
      if (existing && existing.startsWith('automerge:')) {
        migratedUrl = existing as AutomergeUrl;
      }
    }

    if (migratedUrl) {
      setHistoryDocUrl(migratedUrl);
      if (changeDoc) {
        changeDoc((d: MarkdownDoc) => {
          d.historyUrl = migratedUrl as AutomergeUrl;
        });
      }
      return;
    }

    const handle = repo.create<MarkdownHistoryDoc>();
    handle.change((dHist: MarkdownHistoryDoc) => {
      dHist.docUrl = currentDocUrl as AutomergeUrl;
      dHist.commits = [] as any;
    });
    const url = handle.url as AutomergeUrl;

    if (changeDoc) {
      changeDoc((d: MarkdownDoc) => {
        d.historyUrl = url;
      });
    }

    setHistoryDocUrl(url);
  }, [currentDocUrl, repo, doc, changeDoc]);

  const handleCreateSnapshot = () => {
    if (!historyDoc || !changeHistoryDoc || !currentDocUrl) return;
    setPendingSnapshotMessage('');
    setIsSnapshotModalOpen(true);
  };

  const handleConfirmSnapshot = () => {
    if (!changeHistoryDoc || !historyDoc || !currentDocUrl) return;

    const trimmed = pendingSnapshotMessage.trim() || 'Snapshot manual';
    const now = Date.now();

    const newCommit: DocCommit = {
      id: crypto.randomUUID(),
      parents: historyDoc.headId ? [historyDoc.headId] : [],
      createdAt: now,
      message: trimmed,
      content,
    };

    changeHistoryDoc((d: MarkdownHistoryDoc) => {
      if (!d.commits) {
        d.commits = [] as any;
      }
      d.commits.push(newCommit);
      d.headId = newCommit.id;
      if (!d.docUrl) {
        d.docUrl = currentDocUrl as AutomergeUrl;
      }
    });

    setIsSnapshotModalOpen(false);
    setPendingSnapshotMessage('');
  };

  const handleCancelSnapshot = () => {
    setIsSnapshotModalOpen(false);
    setPendingSnapshotMessage('');
  };

  const handleRestoreFromSnapshot = (commit: DocCommit) => {
    if (!changeDoc || !changeHistoryDoc) return;

    changeDoc((d: MarkdownDoc) => {
      d.content = commit.content;
    });

    changeHistoryDoc((d: MarkdownHistoryDoc) => {
      const rollbackCommit: DocCommit = {
        id: crypto.randomUUID(),
        parents: d.headId ? [d.headId] : [],
        createdAt: Date.now(),
        message: `Rollback a snapshot (${new Date(commit.createdAt).toLocaleString()})`,
        content: commit.content,
      };
      if (!d.commits) {
        d.commits = [] as any;
      }
      d.commits.push(rollbackCommit);
      d.headId = rollbackCommit.id;
    });
  };

  const handleOpenSnapshotPreview = (commitId: string) => {
    setHistoryPreviewCommitId(commitId);
    setIsHistoryPreviewOpen(true);
  };

  const handleCloseSnapshotPreview = () => {
    setIsHistoryPreviewOpen(false);
    setHistoryPreviewCommitId(null);
  };

  const detectCodeBlockAtPosition = (text: string, pos: number) => {
    const fence = '```';
    const blockStart = text.lastIndexOf(fence, pos);
    if (blockStart === -1) return null;

    const firstLineEnd = text.indexOf('\n', blockStart);
    const firstLine = firstLineEnd === -1 ? text.slice(blockStart) : text.slice(blockStart, firstLineEnd);
    const lang = firstLine.replace(/^```/, '').trim() || 'markdown';

    const searchFrom = firstLineEnd === -1 ? blockStart + fence.length : firstLineEnd + 1;
    let blockEndFence = text.indexOf('\n```', searchFrom);
    if (blockEndFence === -1) {
      // intentar encontrar "```" al final del texto
      const lastFence = text.indexOf(fence, searchFrom);
      if (lastFence !== -1) {
        blockEndFence = lastFence;
      } else {
        blockEndFence = text.length;
      }
    }

    const blockEnd = blockEndFence + (text.startsWith('```', blockEndFence + 1) ? 3 : 4); // incluir cierre

    return {
      lang,
      start: blockStart,
      end: Math.min(blockEnd, text.length),
    };
  };

  const updateCurrentBlockFromSelection = () => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart ?? 0;
    const info = detectCodeBlockAtPosition(content, pos);
    setCurrentBlock(info);
  };

  const applyTextTransformation = (
    transform: (full: string, selectionStart: number, selectionEnd: number) => {
      text: string;
      newSelectionStart: number;
      newSelectionEnd: number;
    },
  ) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;

    const { text, newSelectionStart, newSelectionEnd } = transform(content, start, end);
    if (text === content) return;

    updateContent(text);

    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(newSelectionStart, newSelectionEnd);
    });
  };

  const wrapSelection = (wrapper: string) => {
    applyTextTransformation((full, start, end) => {
      const before = full.slice(0, start);
      const selected = full.slice(start, end) || 'texto';
      const after = full.slice(end);
      const wrapped = `${wrapper}${selected}${wrapper}`;
      const newText = `${before}${wrapped}${after}`;
      const base = before.length + wrapper.length;
      return {
        text: newText,
        newSelectionStart: base,
        newSelectionEnd: base + selected.length,
      };
    });
  };

  const insertMermaidTemplate = (kind: string) => {
    switch (kind) {
      case 'flowchart':
        insertBlock('\n```mermaid\ngraph TD\n  A[Inicio] --> B[Paso 1]--> C[Fin]\n```\n');
        break;
      case 'sequence':
        insertBlock('\n```mermaid\nsequenceDiagram\n  participant A as Cliente\n  participant B as Servidor\n  A->>B: Petición\n  B-->>A: Respuesta\n```\n');
        break;
      case 'class':
        insertBlock('\n```mermaid\nclassDiagram\n  Clase01 <|-- Clase02\n  Clase01 : +int id\n  Clase01 : +string nombre\n```\n');
        break;
      case 'state':
        insertBlock('\n```mermaid\nstateDiagram-v2\n  [*] --> Idle\n  Idle --> Running : start\n  Running --> Idle : stop\n```\n');
        break;
      case 'er':
        insertBlock('\n```mermaid\nerDiagram\n  CLIENT ||--o{ ORDER : realiza\n  ORDER }o--o{ PRODUCTO : contiene\n```\n');
        break;
      case 'gantt':
        insertBlock('\n```mermaid\n%%{init: {"theme": "default"}}%%\ngantt\n  title Plan de proyecto\n  dateFormat  YYYY-MM-DD\n  section Fase 1\n  Tarea1 :a1, 2025-01-01, 3d\n  Tarea2 :after a1  , 4d\n```\n');
        break;
      case 'pie':
        insertBlock('\n```mermaid\npie title Distribución\n  "Opción A" : 40\n  "Opción B" : 30\n  "Opción C" : 30\n```\n');
        break;
      case 'mindmap':
        insertBlock('\n```mermaid\nmindmap\n  root((Tema))\n    Idea 1\n    Idea 2\n```\n');
        break;
      case 'timeline':
        insertBlock('\n```mermaid\ntimeline\n  title Hitos\n  2024 : Inicio\n  2025 : Lanzamiento\n```\n');
        break;
      default:
        break;
    }
  };

  // insertKrokiTemplate existía para plantillas Kroki, pero actualmente no se usa en la UI

  const insertLink = () => {
    const url = window.prompt('URL del enlace:');
    if (!url) return;

    applyTextTransformation((full, start, end) => {
      const before = full.slice(0, start);
      const selected = full.slice(start, end) || 'texto';
      const after = full.slice(end);
      const link = `[${selected}](${url})`;
      const newText = `${before}${link}${after}`;
      const labelStart = before.length + 1; // después de '['
      return {
        text: newText,
        newSelectionStart: labelStart,
        newSelectionEnd: labelStart + selected.length,
      };
    });
  };

  const toggleHeading = (level: 1 | 2 | 3) => {
    applyTextTransformation((full, start) => {
      const lineStart = full.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = full.indexOf('\n', start);
      const end = lineEnd === -1 ? full.length : lineEnd;
      const line = full.slice(lineStart, end).replace(/^#+\s*/, '');
      const prefix = '#'.repeat(level) + ' ';
      const newLine = prefix + (line || 'Título');
      const newText = full.slice(0, lineStart) + newLine + full.slice(end);
      const caret = lineStart + prefix.length;
      return {
        text: newText,
        newSelectionStart: caret,
        newSelectionEnd: caret + (line || 'Título').length,
      };
    });
  };

  const insertBlock = (block: string) => {
    applyTextTransformation((full, start, end) => {
      const before = full.slice(0, start);
      const after = full.slice(end);
      const insertion = block;
      const newText = `${before}${insertion}${after}`;
      const caret = before.length + insertion.length;
      return {
        text: newText,
        newSelectionStart: caret,
        newSelectionEnd: caret,
      };
    });
  };

  const handleSearchNext = () => {
    if (!searchText) return;
    const textarea = editorRef.current;
    const haystack = content;
    const from = textarea ? textarea.selectionEnd : 0;
    let index = haystack.indexOf(searchText, from);
    if (index === -1) {
      index = haystack.indexOf(searchText, 0);
      if (index === -1) return;
    }
    const start = index;
    const end = index + searchText.length;
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(start, end);
    });
  };

  const handleReplaceNext = () => {
    if (!searchText) return;
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = content.slice(start, end);
    if (selected === searchText && replaceText !== undefined) {
      const newText = content.slice(0, start) + replaceText + content.slice(end);
      updateContent(newText);
      const caret = start + replaceText.length;
      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        editorRef.current.setSelectionRange(caret, caret);
      });
    }
    handleSearchNext();
  };

  const addTextAnnotation = (start: number, end: number, body: string) => {
    if (!changeDoc) return;
    if (start === end) return;

    changeDoc((d: MarkdownDoc) => {
      if (!d.annotations) {
        d.annotations = [] as any;
      }
      d.annotations.push({
        id: crypto.randomUUID(),
        type: 'text',
        start,
        end,
        body,
        createdAt: new Date().toISOString(),
        resolved: false,
      });
    });
  };

  const toggleResolveAnnotation = (id: string) => {
    if (!changeDoc) return;
    changeDoc((d: MarkdownDoc) => {
      if (!d.annotations) return;
      const ann = d.annotations.find((a) => a.id === id);
      if (!ann) return;
      if (ann.resolved) return;
      ann.resolved = true;
    });
  };

  const showDiagramHelp = () => {
    setIsDiagramHelpOpen(true);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Enlace copiado. Compártelo para colaborar en este documento.');
  };
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;

    const highlighted = root.querySelectorAll('span[data-annotation-highlight]');
    highlighted.forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    });

    const activeAnnotations = annotations.filter((a) => a.type === 'text' && !a.resolved);

    if (activeAnnotations.length === 0) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.nodeValue && node.nodeValue.trim()) {
        textNodes.push(node);
      }
    }

    for (const ann of activeAnnotations) {
      const rawSnippet = content.slice(ann.start, ann.end);
      const snippet = rawSnippet.trim();
      if (!snippet) continue;

      for (const node of textNodes) {
        const value = node.nodeValue ?? '';
        const index = value.indexOf(snippet);
        if (index === -1) continue;

        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + snippet.length);

        const wrapper = document.createElement('span');
        wrapper.setAttribute('data-annotation-highlight', ann.id);
        wrapper.className = 'bg-amber-100 rounded px-0.5 cursor-pointer';

        range.surroundContents(wrapper);
        break;
      }
    }
  }, [annotations, content]);

  const handleAddTextAnnotationFromSelection = () => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) {
      alert('Selecciona primero el texto que quieres anotar.');
      return;
    }
    setPendingAnnotationRange({ start, end });
    setPendingAnnotationBody('');
    setIsAnnotationModalOpen(true);
  };

  const focusAnnotation = (ann: Annotation) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const originalSnippet = content.slice(ann.start, ann.end).trim();
    let start = ann.start;
    let end = ann.end;

    if (originalSnippet) {
      const idx = content.indexOf(originalSnippet);
      if (idx !== -1) {
        start = idx;
        end = idx + originalSnippet.length;
      }
    }

    const safeStart = Math.max(0, Math.min(content.length, start));
    const safeEnd = Math.max(0, Math.min(content.length, end));

    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(safeStart, safeEnd);
    });
  };

  const handleConfirmAnnotation = () => {
    if (!pendingAnnotationRange) return;
    const trimmed = pendingAnnotationBody.trim();
    if (!trimmed) return;

    addTextAnnotation(pendingAnnotationRange.start, pendingAnnotationRange.end, trimmed);
    setIsAnnotationModalOpen(false);
    setPendingAnnotationRange(null);
    setPendingAnnotationBody('');
  };

  const handleCancelAnnotation = () => {
    setIsAnnotationModalOpen(false);
    setPendingAnnotationRange(null);
    setPendingAnnotationBody('');
  };

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
        <div className="flex items-center gap-3 text-indigo-600">
          <FileText className="w-6 h-6" />
          <h1 className="text-xl font-bold text-slate-800">Markdown Editor</h1>
          <button
            type="button"
            onClick={() => {
              setIsSyncEnabled((prev) => {
                const next = !prev;
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem('syncEnabled', next ? 'true' : 'false');
                  window.location.reload();
                }
                return next;
              });
            }}
            className="ml-4 flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            title={isSyncEnabled ? 'Sincronización activada' : 'Sincronización desactivada'}
          >
            <span
              className={clsx(
                'inline-flex h-3 w-3 rounded-full border border-slate-300',
                isSyncEnabled ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]' : 'bg-red-500 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]'
              )}
            />
            <span>{isSyncEnabled ? 'Sync ON' : 'Sync OFF'}</span>
          </button>
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

          <button
            onClick={showDiagramHelp}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
            title="Ayuda para generar diagramas Mermaid y Kroki"
          >
            Ayuda diagramas
          </button>

          <button
            onClick={handleCreateSnapshot}
            disabled={!currentDocUrl || !historyDocUrl}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium text-sm"
            title="Guardar snapshot manual de la versión actual"
          >
            <Clock className="w-4 h-4" />
            Guardar snapshot
          </button>
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
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 bg-white text-xs text-slate-600">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => wrapSelection('**')}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection('*')}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection('`')}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  {'</>'}
                </button>
                <button
                  type="button"
                  onClick={insertLink}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  Link
                </button>
              </div>
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <button
                  type="button"
                  onClick={() => toggleHeading(1)}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => toggleHeading(2)}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => toggleHeading(3)}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  H3
                </button>
              </div>
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <button
                  type="button"
                  onClick={() => insertBlock('\n- elemento\n')}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  Lista
                </button>
                <select
                  className="px-1 py-1 border border-slate-200 rounded text-xs bg-white"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    insertMermaidTemplate(v);
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>
                    Mermaid
                  </option>
                  <option value="flowchart">Flujo (graph TD)</option>
                  <option value="sequence">Secuencia</option>
                  <option value="class">Clases</option>
                  <option value="state">Estados</option>
                  <option value="er">ER</option>
                  <option value="gantt">Gantt</option>
                  <option value="pie">Pie</option>
                  <option value="mindmap">Mindmap</option>
                  <option value="timeline">Timeline</option>
                </select>
                <button
                  type="button"
                  onClick={() => insertBlock('\n```\n// código\n```\\n')}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  Código
                </button>
              </div>
              <div className="flex-1 min-w-[260px] flex flex-wrap items-center gap-1 border-l border-slate-200 pl-2">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar"
                  className="min-w-[120px] flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                />
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Reemplazar"
                  className="min-w-[120px] flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                />
                <button
                  type="button"
                  onClick={handleSearchNext}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  Buscar
                </button>
                <button
                  type="button"
                  onClick={handleReplaceNext}
                  className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100"
                >
                  Reemplazar
                </button>
                <button
                  type="button"
                  onClick={handleAddTextAnnotationFromSelection}
                  className="px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  title="Crear anotación sobre el texto seleccionado"
                >
                  Añadir anotación
                </button>
              </div>
            </div>
            {currentDocUrl ? (
              <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => updateContent(e.target.value)}
                onClick={updateCurrentBlockFromSelection}
                onKeyUp={updateCurrentBlockFromSelection}
                onSelect={updateCurrentBlockFromSelection}
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
                    const lang = match?.[1];

                    // Mermaid sigue yendo por el componente específico (lazy load)
                    if (lang === 'mermaid') {
                      return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                    }

                    // Mapeo de lenguajes a tipos de Kroki
                    const krokiTypeByLang: Record<string, string> = {
                      // Core
                      plantuml: 'plantuml',
                      mermaid: 'mermaid',
                      dot: 'graphviz',
                      graphviz: 'graphviz',
                      er: 'erd',
                      erd: 'erd',

                      // BlockDiag family
                      blockdiag: 'blockdiag',
                      seqdiag: 'seqdiag',
                      actdiag: 'actdiag',
                      nwdiag: 'nwdiag',
                      packetdiag: 'packetdiag',
                      rackdiag: 'rackdiag',

                      // Otros tipos soportados
                      bpmn: 'bpmn',
                      bytefield: 'bytefield',
                      c4plantuml: 'c4plantuml',
                      d2: 'd2',
                      ditaa: 'ditaa',
                      nomnoml: 'nomnoml',
                      pikchr: 'pikchr',
                      svgbob: 'svgbob',
                      structurizr: 'structurizr',
                      symbolator: 'symbolator',
                      umlet: 'umlet',
                      vega: 'vega',
                      vegalite: 'vegalite',
                      wavedrom: 'wavedrom',
                      wireviz: 'wireviz',
                    };

                    if (lang && krokiTypeByLang[lang]) {
                      return (
                        <KrokiDiagram
                          type={krokiTypeByLang[lang]}
                          code={String(children)}
                        />
                      );
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

        <aside
          className={clsx(
            'border-l border-slate-200 bg-white flex flex-col text-sm transition-all duration-200',
            isAnnotationsOpen ? 'w-80' : 'w-9'
          )}
        >
          <div className="bg-slate-50 px-2 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => setIsAnnotationsOpen((prev) => !prev)}
              className="flex items-center justify-center w-6 h-6 rounded border border-slate-200 bg-white text-[10px] text-slate-600 hover:bg-slate-100 flex-shrink-0"
              title={isAnnotationsOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
            >
              {isAnnotationsOpen ? '⟩' : '⟨'}
            </button>
            {isAnnotationsOpen && (
              <div className="flex items-center justify-between gap-2 flex-1">
                <div className="inline-flex items-center bg-white border border-slate-200 rounded-md overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSidePanelTab('annotations')}
                    className={clsx(
                      'px-2 py-1 text-[11px]',
                      sidePanelTab === 'annotations'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    Anotaciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidePanelTab('history')}
                    className={clsx(
                      'px-2 py-1 text-[11px] border-l border-slate-200',
                      sidePanelTab === 'history'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    Historial
                  </button>
                </div>
                {sidePanelTab === 'annotations' && (
                  <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">{annotations.length}</span>
                )}
                {sidePanelTab === 'history' && (
                  <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">{historyCommits.length}</span>
                )}
              </div>
            )}
          </div>
          {isAnnotationsOpen && sidePanelTab === 'annotations' && (
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {annotations.length === 0 && (
                <div className="text-xs text-slate-400">
                  No hay anotaciones. Selecciona texto en el editor y usa "Añadir anotación".
                </div>
              )}
              {annotations
                .slice()
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((ann) => {
                  const snippet = content.slice(ann.start, ann.end).replace(/\s+/g, ' ').trim();
                  return (
                    <div
                      key={ann.id}
                      className={clsx(
                        'border rounded-md p-2 space-y-1',
                        ann.resolved ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-amber-50 border-amber-200'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">
                          {ann.type === 'diagram' ? 'Diagrama' : 'Texto'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!ann.resolved) toggleResolveAnnotation(ann.id);
                          }}
                          className={clsx(
                            'text-[10px] px-2 py-0.5 rounded border',
                            ann.resolved
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-600'
                          )}
                        >
                          {ann.resolved ? 'Resuelta' : 'Marcar resuelta'}
                        </button>
                      </div>
                      {snippet && (
                        <div className="text-[11px] text-slate-500 italic line-clamp-2">
                          “{snippet}”
                        </div>
                      )}
                      <div className="text-[12px] text-slate-700 whitespace-pre-wrap">
                        {ann.body}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        {!ann.resolved && (
                          <button
                            type="button"
                            onClick={() => focusAnnotation(ann)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800"
                          >
                            Ver en editor
                          </button>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {new Date(ann.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          {isAnnotationsOpen && sidePanelTab === 'history' && (
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {(!historyDoc || historyCommits.length === 0) && (
                <div className="text-xs text-slate-400">
                  No hay snapshots todavía. Usa "Guardar snapshot" para crear uno.
                </div>
              )}
              {historyCommits
                .slice()
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((commit) => (
                  <div
                    key={commit.id}
                    className="border rounded-md p-2 space-y-1 bg-slate-50 border-slate-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-semibold text-slate-700 truncate">
                          {commit.message || 'Snapshot'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(commit.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenSnapshotPreview(commit.id)}
                        className="text-[11px] px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRestoreFromSnapshot(commit)}
                        className="text-[11px] px-2 py-0.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        Restaurar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </aside>
      </main>

      {isHistoryPreviewOpen && historyPreviewCommit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-5xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-slate-800">Snapshot</h2>
                <div className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                  <span>{new Date(historyPreviewCommit.createdAt).toLocaleString()}</span>
                  {historyPreviewCommit.message && (
                    <span className="truncate max-w-[260px]">“{historyPreviewCommit.message}”</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSnapshotPreview}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              <div className="grid grid-cols-2 gap-3 h-full">
                <div className="flex flex-col h-full">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                    <span>Snapshot guardado</span>
                  </div>
                  <textarea
                    readOnly
                    className="w-full h-full min-h-[260px] text-xs font-mono border border-slate-200 rounded-md p-2 bg-white whitespace-pre resize-none"
                    value={historyPreviewCommit.content}
                  />
                </div>
                <div className="flex flex-col h-full">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                    <span>Contenido actual</span>
                  </div>
                  <textarea
                    readOnly
                    className="w-full h-full min-h-[260px] text-xs font-mono border border-slate-200 rounded-md p-2 bg-white whitespace-pre resize-none"
                    value={content}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSnapshotModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Nuevo snapshot</h2>
              <button
                type="button"
                onClick={handleCancelSnapshot}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Escribe un comentario para este snapshot del documento.
            </div>
            <textarea
              value={pendingSnapshotMessage}
              onChange={(e) => setPendingSnapshotMessage(e.target.value)}
              className="w-full min-h-[120px] text-sm border border-slate-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-y"
              placeholder="Descripción de la versión, cambios importantes, etc."
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleCancelSnapshot}
                className="px-3 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSnapshot}
                className="px-3 py-1.5 text-xs rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!pendingSnapshotMessage.trim()}
              >
                Guardar snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {isAnnotationModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Nueva anotación</h2>
              <button
                type="button"
                onClick={handleCancelAnnotation}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Escribe el texto de la anotación para el fragmento seleccionado.
            </div>
            <textarea
              value={pendingAnnotationBody}
              onChange={(e) => setPendingAnnotationBody(e.target.value)}
              className="w-full min-h-[120px] text-sm border border-slate-200 rounded-md p-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
              placeholder="Comentario, explicación, tarea pendiente, etc."
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleCancelAnnotation}
                className="px-3 py-1.5 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAnnotation}
                className="px-3 py-1.5 text-xs rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!pendingAnnotationRange || !pendingAnnotationBody.trim()}
              >
                Guardar anotación
              </button>
            </div>
          </div>
        </div>
      )}

      <DiagramHelpModal
        isOpen={isDiagramHelpOpen}
        onClose={() => setIsDiagramHelpOpen(false)}
      />
    </div>
  );
}

export default App;
