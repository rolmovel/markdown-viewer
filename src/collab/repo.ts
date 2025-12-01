import { Repo } from '@automerge/automerge-repo';
import { WebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';

export const repo = new Repo({
  network: [
    new WebSocketClientAdapter('wss://sync.automerge.org'),
  ],
});
