import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Loader2, Sparkles, Search, PenLine, Settings, Key } from 'lucide-react';
import { clsx } from 'clsx';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface BlockVersion {
  id: string;
  label: string;
  content: string;
  createdAt: string;
}

interface ChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  /**
   * Texto actualmente seleccionado en el editor. Si está vacío, el asistente
   * trabajará sobre el documento completo.
   */
  selectedText: string;
  /** Inserta texto al final del documento. */
  onInsertText: (text: string) => void;
  /** Reemplaza la selección actual en el documento o bloque activo. */
  onReplaceSelection: (text: string) => void;
}

interface LLMConfig {
  apiKey: string;
  model: string;
}

const SYSTEM_PROMPT = `Eres un asistente de escritura experto especializado en ayudar a crear y mejorar documentos en formato Markdown.

Tus capacidades incluyen:
1. **Mejorar redacción**: Hacer el texto más claro, profesional y bien estructurado.
2. **Corregir gramática**: Identificar y corregir errores gramaticales y ortográficos.
3. **Generar contenido**: Crear nuevo contenido relevante basado en el contexto del documento.
4. **Estructurar documentos**: Sugerir mejoras en la organización y estructura.
5. **Formatear en Markdown**: Usar correctamente headers, listas, tablas, código, etc.

Reglas importantes:
- Responde siempre en español.
- Cuando sugieras texto para insertar, usa bloques de código markdown (\`\`\`markdown).
- Sé conciso pero útil.
- Mantén el tono profesional pero amigable.
- Cuando trabajes con bloques de código o diagramas, devuelve el bloque completo listo para reemplazar.`;

// Acciones rápidas predefinidas
const quickActions = [
  { icon: PenLine, label: 'Mejorar redacción', prompt: 'Mejora la redacción del siguiente texto, haciéndolo más claro y profesional:' },
  { icon: Sparkles, label: 'Generar resumen', prompt: 'Genera un resumen ejecutivo del siguiente documento:' },
  { icon: Search, label: 'Sugerir contenido', prompt: 'Basándote en el documento, sugiere qué secciones o contenido adicional podría añadirse:' },
];

// Llamada al LLM mediante OpenRouter
async function callLLM(messages: Array<{ role: string; content: string }>, config: LLMConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Falta la API key de OpenRouter');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Markdown Editor Assistant',
    },
    body: JSON.stringify({
      model: config.model || 'openrouter/auto',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Error en OpenRouter: ${response.status} ${response.statusText} - ${detail}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Respuesta vacía del modelo');
  }
  return text as string;
}

// Cargar configuración desde localStorage
function loadConfig(): LLMConfig {
  const saved = localStorage.getItem('openrouter_config');
  const storedKey = localStorage.getItem('openrouter_api_key') || '';
  if (saved) {
    const parsed = JSON.parse(saved) as Partial<LLMConfig>;
    return {
      apiKey: parsed.apiKey || storedKey,
      model: parsed.model || 'openrouter/auto',
    };
  }
  return {
    apiKey: storedKey,
    model: 'openrouter/auto',
  };
}

function saveConfig(config: LLMConfig) {
  localStorage.setItem('openrouter_config', JSON.stringify(config));
  if (config.apiKey) {
    localStorage.setItem('openrouter_api_key', config.apiKey);
  }
}

export default function ChatAssistant({ 
  isOpen, 
  onClose, 
  documentContent, 
  selectedText,
  onInsertText,
  onReplaceSelection,
}: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de escritura. Puedo ayudarte a:\n\n• **Mejorar la redacción** de tu documento\n• **Buscar información** relevante\n• **Generar contenido** nuevo\n• **Corregir gramática** y estilo\n\nPrimero, configura tu API key en ⚙️ Ajustes.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<LLMConfig>(loadConfig);
  const [versions, setVersions] = useState<BlockVersion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus en el input cuando se abre el chat
  useEffect(() => {
    if (isOpen && !showSettings) {
      inputRef.current?.focus();
    }
  }, [isOpen, showSettings]);

  // Guardar config cuando cambia
  useEffect(() => {
    saveConfig(config);
  }, [config]);

  // Inicializar versiones cuando cambia el bloque seleccionado o se abre el chat
  useEffect(() => {
    if (!isOpen) return;
    if (!selectedText || !selectedText.trim()) {
      setVersions([]);
      return;
    }
    setVersions([
      {
        id: 'v0',
        label: 'Versión inicial del bloque',
        content: selectedText,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, [isOpen, selectedText]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    if (!config.apiKey) {
      setShowSettings(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Construir contexto con el documento y, si existe, la selección
      const baseDocumentContext = documentContent 
        ? `\n\n---\nCONTENIDO COMPLETO DEL DOCUMENTO (truncado si es muy largo):\n${documentContent.slice(0, 4000)}${documentContent.length > 4000 ? '\n[...documento truncado...]' : ''}\n---\n`
        : '';

      const selectionContext = selectedText
        ? `\n\n---\nTEXTO SELECCIONADO SOBRE EL QUE DEBES TRABAJAR PRINCIPALMENTE:\n${selectedText}\n---\n`
        : '';

      // Construir mensajes para el LLM
      const llmMessages = [
        { role: 'system', content: SYSTEM_PROMPT + baseDocumentContext + selectionContext },
        ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: content },
      ];

      const response = await callLLM(llmMessages, config);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}. Verifica tu API key en ⚙️ Ajustes.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    const target = selectedText && selectedText.trim().length > 0 ? selectedText : documentContent;
    const fullPrompt = `${prompt}\n\n---\n${target.slice(0, 2000)}${target.length > 2000 ? '...' : ''}`;
    sendMessage(fullPrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Extraer bloques de código del mensaje para permitir inserción
  const renderMessageContent = (content: string, isAssistant: boolean) => {
    // Capturamos cualquier bloque con ```<lang> ... ``` para preservar fences y lenguaje
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
    const parts: (string | { type: 'code'; content: string })[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }
      // match[0] es el bloque completo incluyendo ``` y el lenguaje (por ejemplo ```mermaid)
      parts.push({ type: 'code', content: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (typeof part === 'string') {
            return (
              <div key={i} className="whitespace-pre-wrap">
                {part.split('\n').map((line, j) => (
                  <span key={j}>
                    {line.split(/(\*\*.*?\*\*)/).map((segment, k) => {
                      if (segment.startsWith('**') && segment.endsWith('**')) {
                        return <strong key={k}>{segment.slice(2, -2)}</strong>;
                      }
                      return segment;
                    })}
                    {j < part.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            );
          } else {
            return (
              <div key={i} className="relative group space-y-2">
                <pre className="bg-slate-800 text-slate-100 p-3 rounded-lg text-sm overflow-x-auto">
                  <code>{part.content}</code>
                </pre>
                {isAssistant && (
                  <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onInsertText(part.content)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2 py-1 rounded"
                    >
                      Insertar al final
                    </button>
                    <button
                      onClick={() => {
                        const id = `v${versions.length + 1}-${Date.now()}`;
                        const label = `Versión ${versions.length + 1} del bloque`;
                        setVersions(prev => [
                          ...prev,
                          {
                            id,
                            label,
                            content: part.content,
                            createdAt: new Date().toISOString(),
                          },
                        ]);
                        onReplaceSelection(part.content);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2 py-1 rounded"
                    >
                      Reemplazar bloque
                    </button>
                  </div>
                )}
              </div>
            );
          }
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-semibold">Asistente de Escritura</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              "p-1.5 rounded transition-colors",
              showSettings ? "bg-white/30" : "hover:bg-white/20"
            )}
            title="Configuración"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Key className="w-4 h-4" />
            Configuración de OpenRouter
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                placeholder="openrouter/auto"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">OpenRouter API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-or-v1-..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                La API key se guarda localmente en tu navegador.
              </p>
            </div>
          </div>

          {config.apiKey && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              API key configurada
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(action.prompt)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <action.icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          ))}
        </div>

        {versions.length > 0 && (
          <div className="border-t border-slate-200 pt-2 mt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Versiones del bloque</span>
              <span>{versions.length}</span>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onReplaceSelection(v.content)}
                  className="w-full text-left px-2 py-1 rounded text-[11px] bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-600"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx(
              "flex gap-3",
              message.role === 'user' ? "flex-row-reverse" : ""
            )}
          >
            <div className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
              message.role === 'user' 
                ? "bg-indigo-100 text-indigo-600" 
                : "bg-gradient-to-br from-indigo-500 to-purple-500 text-white"
            )}>
              {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={clsx(
              "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
              message.role === 'user'
                ? "bg-indigo-600 text-white rounded-br-md"
                : "bg-slate-100 text-slate-700 rounded-bl-md"
            )}>
              {renderMessageContent(message.content, message.role === 'assistant')}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            rows={2}
            className="flex-1 resize-none border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="self-end p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Shift + Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
