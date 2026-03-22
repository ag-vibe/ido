import React, { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTodoMutation,
  deleteTodoMutation,
  listTodosOptions,
  listTodosQueryKey,
  updateTodoMutation,
} from "@/api-gen/@tanstack/react-query.gen";
import type { TodoItem } from "@/api-gen/types.gen";
import { drainQueue, enqueue, opId } from "@/lib/pending-sync";
import SyncStatus from "./SyncStatus";

// The backend uses "week" (not "thisWeek"), and done is a boolean field.
// Column mapping: Later = !done && bucket==="later"
//                 This Week = !done && bucket==="week"
//                 Today = !done && bucket==="today"
//                 Done = done===true

type BucketId = "later" | "week" | "today" | "done";

const BUCKETS: { id: BucketId; label: string }[] = [
  { id: "later", label: "Later" },
  { id: "week", label: "This Week" },
  { id: "today", label: "Today" },
  { id: "done", label: "Done" },
];

function bucketItems(todos: TodoItem[], bucketId: BucketId): TodoItem[] {
  if (bucketId === "done") return todos.filter((t) => t.done);
  return todos.filter((t) => !t.done && t.bucket === bucketId);
}

interface TodoCardProps {
  todo: TodoItem;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

const TodoCard: React.FC<TodoCardProps> = React.memo(
  ({ todo, isDragging, onDragStart, onDragEnd, onToggleDone, onDelete, onRename }) => {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");

    const rowBase =
      "group flex items-center gap-3 py-2 border-b border-dashed border-[var(--row-border)] cursor-pointer select-none";
    const dragging = "bg-[var(--drag-bg)] opacity-80";

    const textClass = todo.done
      ? "flex-1 break-words text-xs leading-snug text-(--sea-ink-soft) line-through decoration-[var(--strike-color)] sm:text-[13px]"
      : "flex-1 break-words text-xs leading-snug text-(--sea-ink) sm:text-[13px]";

    const startEdit = () => {
      setEditValue(todo.title);
      setEditing(true);
    };

    const commitEdit = () => {
      if (editValue.trim()) onRename(editValue.trim());
      setEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") commitEdit();
      if (e.key === "Escape") setEditing(false);
    };

    return (
      <div
        draggable={!editing}
        onDragStart={editing ? undefined : onDragStart}
        onDragEnd={editing ? undefined : onDragEnd}
        data-testid="todo-card"
        className={`${rowBase} ${isDragging ? dragging : ""}`}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleDone();
          }}
          aria-label={todo.done ? "Mark as not done" : "Mark as done"}
          data-testid="todo-toggle"
          className="flex h-4 w-4 flex-none items-center justify-center rounded-sm border border-(--checkbox-border) bg-transparent"
        >
          {todo.done && (
            <span className="block h-2.5 w-2.5 rounded-[3px] bg-(--checkbox-fill)" />
          )}
        </button>
        {editing ? (
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKeyDown}
            data-testid="todo-title-input"
            className="flex-1 border-none bg-transparent text-xs leading-snug text-(--sea-ink) focus:outline-none focus:ring-0 sm:text-[13px]"
          />
        ) : (
          <p data-testid="todo-title" className={textClass} onDoubleClick={startEdit}>
            {todo.title}
          </p>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="Delete task"
          data-testid="todo-delete"
          className="ml-1 flex-none text-[10px] text-(--sea-ink-soft) opacity-0 transition-opacity group-hover:opacity-100"
        >
          ×
        </button>
      </div>
    );
  },
);

TodoCard.displayName = "TodoCard";

export const FlodoBoard: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: todos = [], isLoading, isError } = useQuery(listTodosOptions());

  // --- Optimistic update helpers ---
  const optimisticAdd = (item: TodoItem) => {
    queryClient.setQueryData<TodoItem[]>(listTodosQueryKey(), (prev = []) => [item, ...prev]);
  };
  const optimisticUpdate = (id: string, patch: Partial<TodoItem>) => {
    queryClient.setQueryData<TodoItem[]>(listTodosQueryKey(), (prev = []) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };
  const optimisticRemove = (id: string) => {
    queryClient.setQueryData<TodoItem[]>(listTodosQueryKey(), (prev = []) =>
      prev.filter((t) => t.id !== id),
    );
  };

  const createMutation = useMutation({
    ...createTodoMutation(),
    onMutate: async ({ body }) => {
      await queryClient.cancelQueries({ queryKey: listTodosQueryKey() });
      const snapshot = queryClient.getQueryData<TodoItem[]>(listTodosQueryKey());
      const tempItem: TodoItem = {
        id: `temp-${Date.now()}`,
        title: body.title,
        bucket: "later",
        done: false,
        createdAt: new Date().toISOString(),
      };
      optimisticAdd(tempItem);
      return { snapshot, tempId: tempItem.id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(listTodosQueryKey(), ctx.snapshot);
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: listTodosQueryKey() }),
  });

  const updateMutation = useMutation({
    ...updateTodoMutation(),
    onMutate: async ({ path, body }) => {
      await queryClient.cancelQueries({ queryKey: listTodosQueryKey() });
      const snapshot = queryClient.getQueryData<TodoItem[]>(listTodosQueryKey());
      optimisticUpdate(path.id, body);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(listTodosQueryKey(), ctx.snapshot);
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: listTodosQueryKey() }),
  });

  const deleteMutation = useMutation({
    ...deleteTodoMutation(),
    onMutate: async ({ path }) => {
      await queryClient.cancelQueries({ queryKey: listTodosQueryKey() });
      const snapshot = queryClient.getQueryData<TodoItem[]>(listTodosQueryKey());
      optimisticRemove(path.id);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(listTodosQueryKey(), ctx.snapshot);
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: listTodosQueryKey() }),
  });

  const [draft, setDraft] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTodayLabel(
      now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    );
  }, []);

  // Drain pending queue on reconnect (or on mount if already online)
  useEffect(() => {
    const handleOnline = () => void drainQueue(queryClient);
    window.addEventListener("online", handleOnline);
    if (navigator.onLine) void drainQueue(queryClient);
    return () => window.removeEventListener("online", handleOnline);
  }, [queryClient]);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const title = draft.trim();
      if (!title) return;
      if (!navigator.onLine) {
        const tempId = `temp-${Date.now()}`;
        const tempItem: TodoItem = {
          id: tempId,
          title,
          bucket: "later",
          done: false,
          createdAt: new Date().toISOString(),
        };
        optimisticAdd(tempItem);
        enqueue({ id: opId(), type: "create", title, tempId });
        setDraft("");
        return;
      }
      createMutation.mutate({ body: { title } });
      setDraft("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, createMutation],
  );

  const handleDragStart = useCallback((id: string) => {
    return (event: React.DragEvent<HTMLDivElement>) => {
      setDraggingId(id);
      event.dataTransfer.setData("text/plain", id);
      event.dataTransfer.effectAllowed = "move";
    };
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  const handleDrop = useCallback(
    (bucketId: BucketId) => {
      return (event: React.DragEvent<HTMLDivElement | HTMLElement>) => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain");
        setDraggingId(null);
        if (!id) return;

        const patch =
          bucketId === "done"
            ? { done: true as const }
            : { bucket: bucketId as TodoItem["bucket"], done: false as const };

        if (!navigator.onLine) {
          optimisticUpdate(id, patch);
          enqueue({ id: opId(), type: "update", todoId: id, patch });
          return;
        }
        if (bucketId === "done") {
          updateMutation.mutate({ body: { done: true }, path: { id } });
        } else {
          updateMutation.mutate({ body: { bucket: bucketId, done: false }, path: { id } });
        }
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateMutation],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-(--bg-base) px-4">
        <p className="text-xs text-(--sea-ink-soft)">Loading…</p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-(--bg-base) px-4">
        <p className="text-xs text-(--sea-ink-soft)">Something went wrong. Please try again.</p>
      </main>
    );
  }

  return (
    <main
      data-testid="todo-board"
      className="flex min-h-screen w-screen items-stretch bg-(--bg-base)"
    >
      <div className="fixed top-4 right-4 z-50">
        <SyncStatus />
      </div>
      <section className="flex flex-1 flex-col overflow-hidden bg-(--surface)">
        <div className="grid min-h-screen grid-cols-1 divide-y divide-(--col-divider) sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          {BUCKETS.map((bucket) => {
            const items = bucketItems(todos, bucket.id);

            const countLabel =
              bucket.id === "done"
                ? `${items.length} closed task${items.length === 1 ? "" : "s"}`
                : `${items.length} open task${items.length === 1 ? "" : "s"}`;

            return (
              <section
                key={bucket.id}
                onDragOver={handleDragOver}
                onDrop={handleDrop(bucket.id)}
                data-testid={`todo-bucket-${bucket.id}`}
                className="flex flex-col bg-(--surface)"
              >
                <header className="flex items-baseline justify-between gap-2 px-5 pt-5 pb-3">
                  <div>
                    <h2 className="text-[15px] font-medium text-(--sea-ink)">{bucket.label}</h2>
                    <p className="text-[11px] text-(--sea-ink-soft)">{countLabel}</p>
                  </div>
                  {bucket.id === "today" && todayLabel && (
                    <span className="text-[12px] text-(--sea-ink-soft)">{todayLabel}</span>
                  )}
                </header>

                <div className="flex flex-1 flex-col px-5 pb-5">
                  {bucket.id === "later" && (
                    <form onSubmit={handleSubmit} className="mb-1.5">
                      <div className="flex items-center gap-2 py-2 border-b border-dashed border-(--row-border)">
                        <span className="h-4 w-4 flex-none rounded-sm border border-(--checkbox-border) bg-transparent" />
                        <input
                          type="text"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Add a task"
                          data-testid="todo-new-input"
                          className="flex-1 border-none bg-transparent text-xs leading-snug text-(--sea-ink) placeholder:text-(--placeholder-text) focus:outline-none focus:ring-0 sm:text-[13px]"
                        />
                      </div>
                    </form>
                  )}

                  {bucket.id === "today" && items.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-xs text-(--sea-ink-soft)">
                      You are all done.
                    </div>
                  ) : (
                    <div className="flex-1">
                      {items.map((todo) => (
                        <TodoCard
                          key={todo.id}
                          todo={todo}
                          isDragging={draggingId === todo.id}
                          onDragStart={handleDragStart(todo.id)}
                          onDragEnd={handleDragEnd}
                          onToggleDone={() => {
                            const patch = { done: !todo.done };
                            if (!navigator.onLine) {
                              optimisticUpdate(todo.id, patch);
                              enqueue({ id: opId(), type: "update", todoId: todo.id, patch });
                              return;
                            }
                            updateMutation.mutate({ body: patch, path: { id: todo.id } });
                          }}
                          onDelete={() => {
                            if (!navigator.onLine) {
                              optimisticRemove(todo.id);
                              enqueue({ id: opId(), type: "delete", todoId: todo.id });
                              return;
                            }
                            deleteMutation.mutate({ path: { id: todo.id } });
                          }}
                          onRename={(title) => {
                            const patch = { title };
                            if (!navigator.onLine) {
                              optimisticUpdate(todo.id, patch);
                              enqueue({ id: opId(), type: "update", todoId: todo.id, patch });
                              return;
                            }
                            updateMutation.mutate({ body: patch, path: { id: todo.id } });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
};
