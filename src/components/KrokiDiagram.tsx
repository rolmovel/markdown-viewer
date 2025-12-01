import React, { useEffect, useState } from 'react';

interface KrokiDiagramProps {
  type: string; // e.g. 'plantuml', 'graphviz', 'bpmn', etc.
  code: string;
}

// URL base de Kroki: configurable vía VITE_KROKI_URL, por defecto localhost para desarrollo
const KROKI_BASE_URL = (import.meta as any).env?.VITE_KROKI_URL || 'http://localhost:8000';

// Componente que llama al servidor Kroki y renderiza el SVG devuelto.
const KrokiDiagram: React.FC<KrokiDiagramProps> = ({ type, code }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const render = async () => {
      // Si no hay código, no hacemos nada
      if (!code.trim()) return;

      // Si la URL de Kroki no está configurada, mostrar aviso en lugar de fallar
      if (!KROKI_BASE_URL) {
        setError('Kroki no está configurado (VITE_KROKI_URL).');
        return;
      }

      try {
        setError(null);
        const res = await fetch(`${KROKI_BASE_URL.replace(/\/$/, '')}/${type}/svg`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: code,
        });
        if (!res.ok) {
          const msg = `Kroki error: ${res.status} ${res.statusText}`;
          console.warn(msg);
          setError(msg);
          return;
        }
        const text = await res.text();
        setSvg(text);
      } catch (e: any) {
        console.error('Kroki render error', e);
        setError(e?.message ?? 'Error al renderizar diagrama con Kroki');
      }
    };

    render();
  }, [type, code]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded border border-red-200 text-sm">
        <p className="font-semibold">Error en diagrama Kroki:</p>
        <pre className="mt-1 whitespace-pre-wrap text-xs">{error}</pre>
        <pre className="mt-2 text-xs opacity-75">{code}</pre>
      </div>
    );
  }

  if (!svg) return <div className="text-xs text-slate-400">Renderizando diagrama...</div>;

  return (
    <div
      className="py-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default KrokiDiagram;
