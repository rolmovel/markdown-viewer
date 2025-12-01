import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

// Crear adaptador WebSocket con logs de debug
const wsAdapter = new WebSocketClientAdapter('wss://sync.automerge.org');

export const repo = new Repo({
  network: [wsAdapter],
  storage: new IndexedDBStorageAdapter(),
});

// Debug: logs de conexión
console.log('[Automerge] Repo inicializado con WebSocket:', 'wss://sync.automerge.org');
console.log('[Automerge] Storage:', 'IndexedDB');

// Log cuando se carga un documento
repo.on('document', ({ handle }) => {
  console.log('[Automerge] Documento cargado:', handle.url);
});
