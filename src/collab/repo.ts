import { Repo } from '@automerge/automerge-repo';
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

// Usar BroadcastChannel para sincronización entre pestañas del mismo navegador
// Esto funciona sin necesidad de servidor externo
const broadcastAdapter = new BroadcastChannelNetworkAdapter();

export const repo = new Repo({
  network: [broadcastAdapter],
  storage: new IndexedDBStorageAdapter(),
});

// Debug: logs de conexión
console.log('[Automerge] Repo inicializado con BroadcastChannel (sync entre pestañas)');
console.log('[Automerge] Storage:', 'IndexedDB');

// Log cuando se carga un documento
repo.on('document', ({ handle }) => {
  console.log('[Automerge] Documento cargado:', handle.url);
});
