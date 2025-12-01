import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

// Adaptador principal: servidor de sincronización público de Automerge
const wsAdapter = new WebSocketClientAdapter('wss://sync.automerge.org');

// Opcional: BroadcastChannel para mejorar sync entre pestañas del mismo navegador
const broadcastAdapter = new BroadcastChannelNetworkAdapter();

export const repo = new Repo({
  network: [wsAdapter, broadcastAdapter],
  storage: new IndexedDBStorageAdapter(),
});

// Debug mínimos
console.log('[Automerge] Repo inicializado con WebSocket + BroadcastChannel');
console.log('[Automerge] Network:', 'wss://sync.automerge.org + BroadcastChannel');
console.log('[Automerge] Storage:', 'IndexedDB');
