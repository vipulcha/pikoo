// ============================================
// What each client is allowed to see
// ============================================
// The stored room holds everyone's todos (public and private) and each user's
// secret hash. Clients only get other people's public todo lists, their own
// list, and never the secrets.

import { RoomState, UserTodos } from "./types.js";

export function todosForUser(
  userTodos: Record<string, UserTodos> | undefined,
  viewerId: string | undefined
): Record<string, UserTodos> {
  const visible: Record<string, UserTodos> = {};
  for (const [userId, todos] of Object.entries(userTodos || {})) {
    if (todos.isPublic || userId === viewerId) visible[userId] = todos;
  }
  return visible;
}

export function roomForUser(room: RoomState, viewerId: string | undefined): Omit<RoomState, "userSecrets"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userSecrets, ...publicRoom } = room;
  return { ...publicRoom, userTodos: todosForUser(room.userTodos, viewerId) };
}
