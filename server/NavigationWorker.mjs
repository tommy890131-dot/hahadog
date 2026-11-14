import { parentPort } from 'node:worker_threads';
import { navigation } from '../packages/shared/ZombieNavigation.mjs';

// The expensive shortest-path calculation never blocks the Node.js game tick.
parentPort.on('message', ({ id, x, y, z }) => {
  try {
    const { goal, dist, next } = navigation.routeTo({ x, y, z });
    parentPort.postMessage({ id, goal, dist, next }, [dist.buffer, next.buffer]);
  } catch (error) {
    parentPort.postMessage({ id, error: String(error?.message ?? error) });
  }
});
