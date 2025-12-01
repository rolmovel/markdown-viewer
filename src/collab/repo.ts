import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

// Adaptador principal: servidor de sincronización local (Docker)
const wsAdapter = new WebSocketClientAdapter('ws://localhost:3030');

// Opcional: BroadcastChannel para mejorar sync entre pestañas del mismo navegador
const broadcastAdapter = new BroadcastChannelNetworkAdapter();

export const repo = new Repo({
  network: [wsAdapter, broadcastAdapter],
  storage: new IndexedDBStorageAdapter(),
});

// Debug mínimos
console.log('[Automerge] Repo inicializado con WebSocket + BroadcastChannel');
console.log('[Automerge] Network:', 'ws://localhost:3030 + BroadcastChannel');
console.log('[Automerge] Storage:', 'IndexedDB');
