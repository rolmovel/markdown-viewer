import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { BroadcastChannelNetworkAdapter } from '@automerge/automerge-repo-network-broadcastchannel';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';

// Adaptador principal: servidor de sincronización remoto (Automerge cloud)
const wsAdapter = new WebSocketClientAdapter('wss://sync.automerge.org');

// Opcional: BroadcastChannel para mejorar sync entre pestañas del mismo navegador
const broadcastAdapter = new BroadcastChannelNetworkAdapter();

// Flag persistido en localStorage para activar/desactivar sync de red
const syncEnabledFromStorage =
  typeof window !== 'undefined'
    ? window.localStorage.getItem('syncEnabled') !== 'false'
    : true;

const networkAdapters: any[] = [broadcastAdapter];

if (syncEnabledFromStorage) {
  networkAdapters.unshift(wsAdapter);
}

export const repo = new Repo({
  network: networkAdapters,
  storage: new IndexedDBStorageAdapter(),
});

// Debug mínimos
console.log('[Automerge] Repo inicializado');
console.log(
  '[Automerge] Network:',
  syncEnabledFromStorage
    ? 'wss://sync.automerge.org + BroadcastChannel'
    : 'Solo BroadcastChannel (sin sync remoto)'
);
console.log('[Automerge] Storage:', 'IndexedDB');
