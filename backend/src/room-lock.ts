// ============================================
// Per-room lock
// ============================================
// Every store operation reads the whole room, changes it, and writes it back.
// Running a room's operations one at a time stops concurrent events from
// overwriting each other and makes the server's arrival order the real order.
// (In-process only; with several backend instances this would need a Redis lock.)

const roomQueues = new Map<string, Promise<void>>();

export function withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
  const previous = roomQueues.get(roomId) ?? Promise.resolve();
  const result = previous.then(fn);
  const tail = result.then(() => undefined, () => undefined);
  roomQueues.set(roomId, tail);
  tail.then(() => {
    if (roomQueues.get(roomId) === tail) roomQueues.delete(roomId);
  });
  return result;
}
