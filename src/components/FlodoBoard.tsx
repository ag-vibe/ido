import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTodoMutation,
  deleteTodoMutation,
  listTodosOptions,
  updateTodoMutation,
} from "@/api-gen/@tanstack/react-query.gen";
import type { TodoItem } from "@/api-gen/types.gen";

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
      "group flex items-center gap-3 py-2 border-b border-dashed border-[rgba(203,192,173,0.8)] cursor-pointer select-none";
    const dragging = "bg-[rgba(44,38,31,0.02)] opacity-80";

    const textClass = todo.done
      ? "flex-1 break-words text-xs leading-snug text-(--sea-ink-soft) line-through decoration-[rgba(139,129,115,0.6)] sm:text-[13px]"
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
        className={`${rowBase} ${isDragging ? dragging : ""}`}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleDone();
          }}
          aria-label={todo.done ? "Mark as not done" : "Mark as done"}
          className="flex h-4 w-4 flex-none items-center justify-center rounded-sm border border-[rgba(203,192,173,0.95)] bg-transparent"
        >
          {todo.done && (
            <span className="block h-2.5 w-2.5 rounded-[3px] bg-[rgba(44,38,31,0.9)]" />
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
            className="flex-1 border-none bg-transparent text-xs leading-snug text-(--sea-ink) focus:outline-none focus:ring-0 sm:text-[13px]"
          />
        ) : (
          <p className={textClass} onDoubleClick={startEdit}>
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
          className="ml-1 flex-none text-[10px] text-(--sea-ink-soft) opacity-0 transition-opacity group-hover:opacity-100"
        >
          ×
        </button>
      </div>
    );
  }
);

TodoCard.displayName = "TodoCard";

export const FlodoBoard: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: todos = [], isLoading, isError } = useQuery(listTodosOptions());

  const createMutation = useMutation({
    ...createTodoMutation(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["listTodos"] }),
  });

  const updateMutation = useMutation({
    ...updateTodoMutation(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["listTodos"] }),
  });

  const deleteMutation = useMutation({
    ...deleteTodoMutation(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["listTodos"] }),
  });

  const [draft, setDraft] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTodayLabel(
      now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    );
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const title = draft.trim();
      if (!title) return;
      createMutation.mutate({ body: { title } });
      setDraft("");
    },
    [draft, createMutation]
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

        if (bucketId === "done") {
          updateMutation.mutate({ body: { done: true }, path: { id } });
        } else {
          updateMutation.mutate({ body: { bucket: bucketId, done: false }, path: { id } });
        }
      };
    },
    [updateMutation]
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
        <p className="text-xs text-red-500">Failed to load todos. Is the backend running?</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen w-screen items-stretch bg-(--bg-base)">
      <section className="flex flex-1 flex-col overflow-hidden bg-(--surface)">
        <div className="grid min-h-screen grid-cols-1 divide-y divide-[rgba(214,204,187,0.9)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
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
                className="flex flex-col bg-(--surface)"
              >
                <header className="flex items-baseline justify-between gap-2 px-5 pt-5 pb-3">
                  <div>
                    <h2 className="text-[15px] font-medium text-(--sea-ink)">
                      {bucket.label}
                    </h2>
                    <p className="text-[11px] text-(--sea-ink-soft)">{countLabel}</p>
                  </div>
                  {bucket.id === "today" && todayLabel && (
                    <span className="text-[12px] text-(--sea-ink-soft)">
                      {todayLabel}
                    </span>
                  )}
                </header>

                <div className="flex flex-1 flex-col px-5 pb-5">
                  {bucket.id === "later" && (
                    <form onSubmit={handleSubmit} className="mb-1.5">
                      <div className="flex items-center gap-2 py-2 border-b border-dashed border-[rgba(203,192,173,0.8)]">
                        <span className="h-4 w-4 flex-none rounded-sm border border-[rgba(203,192,173,0.95)] bg-transparent" />
                        <input
                          type="text"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Add a task"
                          className="flex-1 border-none bg-transparent text-xs leading-snug text-(--sea-ink) placeholder:text-[rgba(139,129,115,0.9)] focus:outline-none focus:ring-0 sm:text-[13px]"
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
                          onToggleDone={() =>
                            updateMutation.mutate({
                              body: { done: !todo.done },
                              path: { id: todo.id },
                            })
                          }
                          onDelete={() =>
                            deleteMutation.mutate({ path: { id: todo.id } })
                          }
                          onRename={(title) =>
                            updateMutation.mutate({
                              body: { title },
                              path: { id: todo.id },
                            })
                          }
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
