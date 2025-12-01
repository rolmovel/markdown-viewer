import React, { useEffect, useRef, useState } from 'react';

// Lazy loading de Mermaid: no lo importamos en top-level para evitar
// problemas de inicialización en el bundle minificado de producción.
// En su lugar, lo cargamos dinámicamente cuando se necesita.

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current) return;
      
      try {
        let mermaid = (window as any).mermaid;

        // Si mermaid aún no está en window (por CDN), intentar importarlo dinámicamente
        if (!mermaid) {
          const mod = await import('mermaid');
          mermaid = mod.default || mod;
          (window as any).mermaid = mermaid;
        }
        
        // Inicializar solo una vez
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
        });
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError('Error al renderizar diagrama');
      }
    };

    if (chart) {
      renderChart();
    }
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded border border-red-200 text-sm">
        <p className="font-semibold">Error en diagrama Mermaid:</p>
        <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
        <pre className="mt-2 text-xs opacity-75">{chart}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="mermaid py-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default Mermaid;
