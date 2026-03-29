import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTodoMutation,
  deleteTodoMutation,
  listTodosOptions,
  listTodosQueryKey,
  updateTodoMutation,
} from "@/api-gen/@tanstack/react-query.gen";
import { updateTodo } from "@/api-gen/sdk.gen";
import type { TodoItem } from "@/api-gen/types.gen";
import { drainQueue, enqueue, opId } from "@/lib/pending-sync";
import {
  applyStoredDescriptions,
  clearTodoDescription,
  persistTodoDescription,
} from "@/lib/todo-descriptions";
import {
  normalizeDescription,
  toUpdateTodoRequest,
  type TodoPatch,
  type TodoWithDescription,
} from "@/lib/todo-patch";
import SyncStatus from "./SyncStatus";

// The backend uses "week" (not "thisWeek"), and done is a boolean field.
// Column mapping: Later = !done && bucket==="later"
//                 This Week = !done && bucket==="week"
//                 Today = !done && bucket==="today"
//                 Done = done===true

type BucketId = "later" | "week" | "today" | "done";
type CreatableBucketId = Exclude<BucketId, "done">;

const BUCKETS: { id: BucketId; label: string }[] = [
  { id: "later", label: "Later" },
  { id: "week", label: "This Week" },
  { id: "today", label: "Today" },
  { id: "done", label: "Done" },
];

function bucketItems(todos: TodoWithDescription[], bucketId: BucketId): TodoWithDescription[] {
  if (bucketId === "done") return todos.filter((t) => t.done);
  return todos.filter((t) => !t.done && t.bucket === bucketId);
}

interface TodoCardProps {
  todo: TodoWithDescription;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onSave: (patch: TodoPatch) => void;
}

const TodoCard: React.FC<TodoCardProps> = React.memo(
  ({ todo, isDragging, onDragStart, onDragEnd, onToggleDone, onDelete, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [showDescriptionInput, setShowDescriptionInput] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    const descriptionInputRef = useRef<HTMLInputElement>(null);

    const rowBase =
      "group flex items-start gap-3 py-2 border-b border-dashed border-[var(--row-border)] cursor-pointer select-none";
    const dragging = "bg-[var(--drag-bg)] opacity-80";

    const textClass = todo.done
      ? "break-words text-xs leading-snug text-(--sea-ink-soft) line-through decoration-[var(--strike-color)] sm:text-[13px]"
      : "break-words text-xs leading-snug text-(--sea-ink) sm:text-[13px]";
    const descriptionTextClass = todo.done
      ? "break-words text-[11px] leading-snug text-(--sea-ink-soft) opacity-75 line-through decoration-[var(--strike-color)]"
      : "break-words text-[11px] leading-snug text-(--sea-ink-soft)";

    const startEdit = () => {
      const currentDescription = normalizeDescription(todo.description);
      setEditValue(todo.title);
      setEditDescription(currentDescription);
      setShowDescriptionInput(Boolean(currentDescription));
      setEditing(true);
    };

    const commitEdit = () => {
      const patch: TodoPatch = {};
      const nextTitle = editValue.trim();
      const currentDescription = normalizeDescription(todo.description);
      const nextDescription = editDescription.trim();

      if (nextTitle && nextTitle !== todo.title) {
        patch.title = nextTitle;
      }
      if (nextDescription !== currentDescription) {
        patch.description = nextDescription;
      }

      if (Object.keys(patch).length > 0) {
        onSave(patch);
      }
      setEditing(false);
      setShowDescriptionInput(false);
    };

    const cancelEdit = () => {
      setEditing(false);
      setShowDescriptionInput(false);
    };

    const handleEditorBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      const nextFocused = event.relatedTarget as Node | null;
      if (nextFocused && editorRef.current?.contains(nextFocused)) {
        return;
      }
      commitEdit();
    };

    const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
      }
      if (event.key === "Tab" && !showDescriptionInput) {
        event.preventDefault();
        setShowDescriptionInput(true);
        requestAnimationFrame(() => {
          descriptionInputRef.current?.focus();
        });
      }
    };

    const handleDescriptionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
      }
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
        <div className="min-w-0 flex-1">
          {editing ? (
            <div ref={editorRef} className="flex flex-col gap-1">
              <input
                autoFocus
                type="text"
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
                onBlur={handleEditorBlur}
                onKeyDown={handleTitleKeyDown}
                data-testid="todo-title-input"
                className="border-none bg-transparent text-xs leading-snug text-(--sea-ink) focus:outline-none focus:ring-0 sm:text-[13px]"
              />
              {showDescriptionInput && (
                <input
                  ref={descriptionInputRef}
                  type="text"
                  value={editDescription}
                  placeholder="Description"
                  onChange={(event) => setEditDescription(event.target.value)}
                  onBlur={handleEditorBlur}
                  onKeyDown={handleDescriptionKeyDown}
                  data-testid="todo-description-input"
                  className="border-none bg-transparent text-[11px] leading-snug text-(--sea-ink-soft) placeholder:text-(--placeholder-text) focus:outline-none focus:ring-0"
                />
              )}
            </div>
          ) : (
            <div
              onDoubleClick={(event) => {
                event.stopPropagation();
                startEdit();
              }}
            >
              <p data-testid="todo-title" className={textClass}>
                {todo.title}
              </p>
              {normalizeDescription(todo.description) && (
                <p data-testid="todo-description" className={descriptionTextClass}>
                  {normalizeDescription(todo.description)}
                </p>
              )}
            </div>
          )}
        </div>
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

  const { data: serverTodos = [], isLoading, isError } = useQuery(listTodosOptions());
  const todos = useMemo(
    () => applyStoredDescriptions(serverTodos as TodoWithDescription[]),
    [serverTodos],
  );

  // --- Optimistic update helpers ---
  const optimisticAdd = (item: TodoWithDescription) => {
    queryClient.setQueryData<TodoWithDescription[]>(listTodosQueryKey(), (prev = []) => [
      item,
      ...prev,
    ]);
  };
  const optimisticUpdate = (id: string, patch: TodoPatch) => {
    if ("description" in patch) {
      persistTodoDescription(id, patch.description ?? "");
    }
    queryClient.setQueryData<TodoWithDescription[]>(listTodosQueryKey(), (prev = []) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };
  const optimisticRemove = (id: string) => {
    clearTodoDescription(id);
    queryClient.setQueryData<TodoWithDescription[]>(listTodosQueryKey(), (prev = []) =>
      prev.filter((t) => t.id !== id),
    );
  };

  const createMutation = useMutation({
    ...createTodoMutation(),
  });

  const updateMutation = useMutation({
    ...updateTodoMutation(),
    onMutate: async ({ path, body }) => {
      await queryClient.cancelQueries({ queryKey: listTodosQueryKey() });
      const snapshot = queryClient.getQueryData<TodoWithDescription[]>(listTodosQueryKey());
      optimisticUpdate(path.id, body as TodoPatch);
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
      const snapshot = queryClient.getQueryData<TodoWithDescription[]>(listTodosQueryKey());
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
  const [composerBucket, setComposerBucket] = useState<CreatableBucketId | null>(null);
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

  const openComposer = useCallback((bucketId: CreatableBucketId) => {
    setComposerBucket(bucketId);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerBucket(null);
    setDraft("");
  }, []);

  const createInBucket = useCallback(
    async (bucketId: CreatableBucketId) => {
      const title = draft.trim();
      if (!title) return;

      const tempId = `temp-${Date.now()}`;
      const tempItem: TodoWithDescription = {
        id: tempId,
        title,
        bucket: bucketId,
        done: false,
        createdAt: new Date().toISOString(),
        description: "",
      };

      setDraft("");
      setComposerBucket(null);

      if (!navigator.onLine) {
        optimisticAdd(tempItem);
        enqueue({ id: opId(), type: "create", title, tempId, bucket: bucketId });
        return;
      }

      const snapshot = queryClient.getQueryData<TodoWithDescription[]>(listTodosQueryKey());
      optimisticAdd(tempItem);

      try {
        const created = (await createMutation.mutateAsync({ body: { title } })) as TodoWithDescription;
        queryClient.setQueryData<TodoWithDescription[]>(listTodosQueryKey(), (prev = []) =>
          prev.map((todo) => (todo.id === tempId ? { ...created, bucket: bucketId } : todo)),
        );

        if (bucketId !== "later") {
          const moveResult = await updateTodo({
            path: { id: created.id },
            body: toUpdateTodoRequest({ bucket: bucketId, done: false }),
          });

          if (moveResult.error) {
            queryClient.setQueryData<TodoWithDescription[]>(listTodosQueryKey(), (prev = []) =>
              prev.map((todo) => (todo.id === created.id ? { ...todo, bucket: "later" } : todo)),
            );
          }
        }

        void queryClient.invalidateQueries({ queryKey: listTodosQueryKey() });
      } catch {
        queryClient.setQueryData(listTodosQueryKey(), snapshot ?? []);
      }
    },
    [createMutation, draft, optimisticAdd, queryClient],
  );

  const handleSubmit = useCallback(
    (bucketId: CreatableBucketId) => {
      return (event: React.FormEvent) => {
        event.preventDefault();
        void createInBucket(bucketId);
      };
    },
    [createInBucket],
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
          updateMutation.mutate({ body: toUpdateTodoRequest({ done: true }), path: { id } });
        } else {
          updateMutation.mutate({
            body: toUpdateTodoRequest({ bucket: bucketId, done: false }),
            path: { id },
          });
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
                onDoubleClick={() => {
                  if (bucket.id !== "done") {
                    openComposer(bucket.id);
                  }
                }}
                data-testid={`todo-bucket-${bucket.id}`}
                className="flex flex-col bg-(--surface)"
              >
                <header className="flex items-baseline justify-between gap-2 px-5 pt-5 pb-3">
                  <div>
                    <h2 className="text-[15px] font-medium text-(--sea-ink)">{bucket.label}</h2>
                    <p className="text-[11px] text-(--sea-ink-soft)">{countLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {bucket.id === "today" && todayLabel && (
                      <span className="text-[12px] text-(--sea-ink-soft)">{todayLabel}</span>
                    )}
                    {bucket.id !== "done" && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openComposer(bucket.id as CreatableBucketId); }}
                        aria-label={`Add task to ${bucket.label}`}
                        data-testid={`todo-add-${bucket.id}`}
                        className="text-[18px] leading-none text-(--sea-ink-soft) hover:text-(--sea-ink) transition-colors"
                      >
                        +
                      </button>
                    )}
                  </div>
                </header>

                <div className="flex flex-1 flex-col px-5 pb-5">
                  {bucket.id !== "done" && composerBucket === bucket.id && (
                    <form onSubmit={handleSubmit(bucket.id)} className="mb-1.5">
                      <div className="flex items-center gap-2 py-2 border-b border-dashed border-(--row-border)">
                        <span className="h-4 w-4 flex-none rounded-sm border border-(--checkbox-border) bg-transparent" />
                        <input
                          autoFocus
                          type="text"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => {
                            if (!draft.trim()) {
                              closeComposer();
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              closeComposer();
                            }
                          }}
                          placeholder={`Add to ${bucket.label}`}
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
                            const patch: TodoPatch = { done: !todo.done };
                            if (!navigator.onLine) {
                              optimisticUpdate(todo.id, patch);
                              enqueue({ id: opId(), type: "update", todoId: todo.id, patch });
                              return;
                            }
                            updateMutation.mutate({
                              body: toUpdateTodoRequest(patch),
                              path: { id: todo.id },
                            });
                          }}
                          onDelete={() => {
                            if (!navigator.onLine) {
                              optimisticRemove(todo.id);
                              enqueue({ id: opId(), type: "delete", todoId: todo.id });
                              return;
                            }
                            deleteMutation.mutate({ path: { id: todo.id } });
                          }}
                          onSave={(patch) => {
                            if (!navigator.onLine) {
                              optimisticUpdate(todo.id, patch);
                              enqueue({ id: opId(), type: "update", todoId: todo.id, patch });
                              return;
                            }
                            updateMutation.mutate({
                              body: toUpdateTodoRequest(patch),
                              path: { id: todo.id },
                            });
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
