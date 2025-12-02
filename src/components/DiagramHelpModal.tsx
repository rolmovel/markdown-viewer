import React from 'react';

interface DiagramHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpSection {
  title: string;
  description: string;
  code: string;
}

const sections: HelpSection[] = [
  {
    title: 'Markdown - conceptos básicos y bloques de código',
    description:
      'Sintaxis general de Markdown para texto, títulos, listas y bloques de código. Úsalo cuando no estés en un bloque de diagrama.',
    code:
      'Texto normal y **negrita** o *cursiva*.\n\n' +
      '# Título nivel 1\n' +
      '## Título nivel 2\n' +
      '### Título nivel 3\n\n' +
      '- Elemento de lista 1\n' +
      '- Elemento de lista 2\n' +
      '  - Sub-elemento\n\n' +
      '1. Paso 1\n' +
      '2. Paso 2\n\n' +
      '```\n' +
      'Bloque de código genérico (sin resaltar lenguaje).\n' +
      '```\n\n' +
      '```js\n' +
      'const saludo = "hola";\n' +
      'console.log(saludo);\n' +
      '```\n\n' +
      '```mermaid\n' +
      'graph TD\n' +
      '  A[Inicio] --> B[Fin]\n' +
      '```\n\n' +
      '```plantuml\n' +
      '@startuml\n' +
      'Alice -> Bob: Hola\n' +
      '@enduml\n' +
      '```',
  },
  {
    title: 'Mermaid - Diagrama de flujo (graph TD)',
    description:
      'Usa diagramas de flujo para representar procesos paso a paso con decisiones y caminos alternativos.',
    code:
      '```mermaid\n' +
      'graph TD\n' +
      '  A[Inicio] --> B{¿Condición?}\n' +
      '  B -- Sí --> C[Camino 1]\n' +
      '  B -- No --> D[Camino 2]\n' +
      '  C --> E[Fin]\n' +
      '  D --> E\n' +
      '```',
  },
  {
    title: 'Mermaid - Diagrama de secuencia (sequenceDiagram)',
    description:
      'Muestra mensajes en el tiempo entre actores (cliente, servidor, servicios internos, etc.).',
    code:
      '```mermaid\n' +
      'sequenceDiagram\n' +
      '  participant C as Cliente\n' +
      '  participant S as Servidor\n' +
      '  C->>S: Solicitud\n' +
      '  S-->>C: Respuesta\n' +
      '```',
  },
  {
    title: 'Mermaid - Diagrama de clases (classDiagram)',
    description:
      'Modela clases, atributos y relaciones entre entidades de dominio.',
    code:
      '```mermaid\n' +
      'classDiagram\n' +
      '  class Usuario {\n' +
      '    +int id\n' +
      '    +string nombre\n' +
      '    +login()\n' +
      '  }\n' +
      '  class Pedido {\n' +
      '    +int id\n' +
      '    +fecha fecha\n' +
      '  }\n' +
      '  Usuario "1" -- "*" Pedido : realiza\n' +
      '```',
  },
  {
    title: 'Mermaid - Diagrama de estados (stateDiagram-v2)',
    description:
      'Modela el ciclo de vida de una entidad mediante estados y transiciones.',
    code:
      '```mermaid\n' +
      'stateDiagram-v2\n' +
      '  [*] --> Idle\n' +
      '  Idle --> Running : start()\n' +
      '  Running --> Paused : pause()\n' +
      '  Paused --> Running : resume()\n' +
      '  Running --> [*] : stop()\n' +
      '```',
  },
  {
    title: 'Mermaid - ER (erDiagram)',
    description:
      'Para esquemas entidad-relación, similar a tablas y claves en bases de datos.',
    code:
      '```mermaid\n' +
      'erDiagram\n' +
      '  CLIENT ||--o{ ORDER : realiza\n' +
      '  ORDER }o--o{ PRODUCT : contiene\n' +
      '```',
  },
  {
    title: 'Mermaid - Gantt (gantt)',
    description:
      'Planificación temporal de tareas y fases de un proyecto.',
    code:
      '```mermaid\n' +
      'gantt\n' +
      '  dateFormat  YYYY-MM-DD\n' +
      '  title Plan de proyecto\n' +
      '  section Fase 1\n' +
      '    Analisis     :a1, 2025-01-01, 5d\n' +
      '    Desarrollo   :after a1, 10d\n' +
      '```',
  },
  {
    title: 'Mermaid - Pie (pie)',
    description: 'Gráfico circular para mostrar proporciones de un total.',
    code:
      '```mermaid\n' +
      'pie title Distribución de tráfico\n' +
      '  "Móvil" : 60\n' +
      '  "Escritorio" : 30\n' +
      '  "Tablet" : 10\n' +
      '```',
  },
  {
    title: 'Mermaid - Mindmap (mindmap)',
    description:
      'Mapas mentales jerárquicos para organizar ideas, tareas o requisitos.',
    code:
      '```mermaid\n' +
      'mindmap\n' +
      '  root((Proyecto))\n' +
      '    Ideas\n' +
      '      Idea 1\n' +
      '      Idea 2\n' +
      '    Tareas\n' +
      '      Tarea A\n' +
      '      Tarea B\n' +
      '```',
  },
  {
    title: 'Mermaid - Timeline (timeline)',
    description: 'Línea de tiempo de hitos o versiones.',
    code:
      '```mermaid\n' +
      'timeline\n' +
      '  title Hitos del producto\n' +
      '  2024-01-01 : MVP\n' +
      '  2024-06-01 : Beta\n' +
      '  2024-12-01 : GA\n' +
      '```',
  },
  {
    title: 'Kroki - PlantUML (actividad básica)',
    description: 'Diagrama de actividad UML con decisiones y acciones.',
    code:
      '```plantuml\n' +
      '@startuml\n' +
      'start\n' +
      '  :Validar entrada;\n' +
      '  if (OK?) then (sí)\n' +
      '    :Procesar;\n' +
      '  else (no)\n' +
      '    :Mostrar error;\n' +
      '  endif\n' +
      'stop\n' +
      '@enduml\n' +
      '```',
  },
  {
    title: 'Kroki - C4 con PlantUML (contenedores)',
    description: 'Vista de contenedores del modelo C4: usuarios, apps, APIs.',
    code:
      '```c4plantuml\n' +
      '@startuml C4_Elements\n' +
      '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml\n\n' +
      'Person(personAlias, "Label", "Optional Description")\n' +
      'Container(containerAlias, "Label", "Technology", "Optional Description")\n' +
      'System(systemAlias, "Label", "Optional Description")\n\n' +
      'Rel(personAlias, containerAlias, "Label", "Optional Technology")\n' +
      '@enduml\n' +
      '```',
  },
  {
    title: 'Kroki - Graphviz / DOT',
    description: 'Grafo dirigido genérico para flujos, dependencias o redes.',
    code:
      '```dot\n' +
      'digraph G {\n' +
      '  rankdir=LR;\n' +
      '  A -> B;\n' +
      '  B -> C;\n' +
      '}\n' +
      '```',
  },
  {
    title: 'Kroki - D2 (diagrama declarativo)',
    description: 'Lenguaje legible para describir nodos y relaciones.',
    code:
      '```d2\n' +
      'user: "Usuario"\n' +
      'app: "Aplicación"\n' +
      'db: "Base de datos"\n' +
      'user -> app: "usa"\n' +
      'app -> db: "lee/escribe"\n' +
      '```',
  },
  {
    title: 'Kroki - ERD (entidad-relación)',
    description: 'Tablas y relaciones típicas de una base de datos.',
    code:
      '```erd\n' +
      '[Usuario] {\n' +
      '  *id\n' +
      '  nombre\n' +
      '}\n' +
      '[Pedido] {\n' +
      '  *id\n' +
      '  fecha\n' +
      '}\n' +
      'Usuario ||--o{ Pedido\n' +
      '```',
  },
  {
    title: 'Kroki - Vega-Lite (barras sencillas)',
    description: 'Gráfico declarativo en JSON para datos tabulares.',
    code:
      '```vegalite\n' +
      '{\n' +
      '  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",\n' +
      '  "description": "Ejemplo de barras",\n' +
      '  "data": {"values": [\n' +
      '    {"categoria": "A", "valor": 10},\n' +
      '    {"categoria": "B", "valor": 20}\n' +
      '  ]},\n' +
      '  "mark": "bar",\n' +
      '  "encoding": {\n' +
      '    "x": {"field": "categoria", "type": "nominal"},\n' +
      '    "y": {"field": "valor", "type": "quantitative"}\n' +
      '  }\n' +
      '}\n' +
      '```',
  },
];

export default function DiagramHelpModal({ isOpen, onClose }: DiagramHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white max-w-4xl w-full max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Ayuda para diagramas</h2>
            <p className="text-xs text-slate-500">
              Referencia rápida de sintaxis y uso para Mermaid y Kroki. Copia y adapta los ejemplos en tu documento.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs text-slate-700 bg-slate-50">
          {sections.map((s, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-1 text-sm">{s.title}</h3>
              <p className="mb-2 text-[11px] text-slate-600">{s.description}</p>
              <pre className="bg-slate-900 text-slate-100 rounded-md p-2 text-[11px] overflow-x-auto whitespace-pre-wrap">
                {s.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
