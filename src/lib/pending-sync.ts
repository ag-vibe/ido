/**
 * Offline pending operations queue.
 * Operations are persisted to localStorage so they survive page refreshes.
 * On reconnect, drainQueue() replays them against the server in order.
 */

import type { QueryClient } from "@tanstack/react-query";
import { listTodosQueryKey } from "@/api-gen/@tanstack/react-query.gen";
import { createTodo, updateTodo, deleteTodo } from "@/api-gen/sdk.gen";
import type { TodoItem } from "@/api-gen/types.gen";
import { toUpdateTodoRequest } from "@/lib/todo-patch";
import type { TodoPatch } from "@/lib/todo-patch";

const QUEUE_KEY = "flodo.pending-ops.v1";
let drainInFlight: Promise<void> | null = null;

export type PendingOp =
  | { id: string; type: "create"; title: string; tempId: string }
  | {
      id: string;
      type: "update";
      todoId: string;
      patch: TodoPatch;
    }
  | { id: string; type: "delete"; todoId: string };

function load(): PendingOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function save(queue: PendingOp[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): PendingOp[] {
  return load();
}

export function enqueue(op: PendingOp): void {
  const queue = load();
  queue.push(op);
  save(queue);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("flodo:queue-changed"));
  }
}

export function dequeue(id: string): void {
  const queue = load().filter((op) => op.id !== id);
  save(queue);
}

/** Replace all tempId references in the queue with the real server id after a create resolves. */
export function replaceTempId(tempId: string, realId: string): void {
  const queue = load().map((op) => {
    if (op.type === "update" && op.todoId === tempId) {
      return { ...op, todoId: realId };
    }
    if (op.type === "delete" && op.todoId === tempId) {
      return { ...op, todoId: realId };
    }
    return op;
  });
  save(queue);
}

/**
 * Drain the pending queue — send each operation to the server in order.
 * Successful ops are removed; failed ops remain for the next drain attempt.
 */
export async function drainQueue(queryClient: QueryClient): Promise<void> {
  if (drainInFlight) {
    return drainInFlight;
  }

  drainInFlight = (async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    let hadSuccess = false;

    for (const op of queue) {
      try {
        if (op.type === "create") {
          const res = await createTodo({ body: { title: op.title } });
          if (res.error) throw new Error("create failed");
          // Update any subsequent ops that referenced the tempId
          replaceTempId(op.tempId, (res.data as TodoItem).id);
          dequeue(op.id);
          hadSuccess = true;
        } else if (op.type === "update") {
          const res = await updateTodo({
            path: { id: op.todoId },
            body: toUpdateTodoRequest(op.patch),
          });
          if (res.error) throw new Error("update failed");
          dequeue(op.id);
          hadSuccess = true;
        } else if (op.type === "delete") {
          const res = await deleteTodo({ path: { id: op.todoId } });
          if (res.error) throw new Error("delete failed");
          dequeue(op.id);
          hadSuccess = true;
        }
      } catch {
        // Leave op in queue for next drain; stop processing to preserve order
        break;
      }
    }

    if (hadSuccess) {
      // Refetch from server so local cache reflects real state
      await queryClient.invalidateQueries({ queryKey: listTodosQueryKey() });
    }
  })();

  try {
    await drainInFlight;
  } finally {
    drainInFlight = null;
  }
}

/** Unique op id generator */
export function opId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
