import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";

type BucketId = "later" | "thisWeek" | "today" | "done";

interface Todo {
  id: string;
  title: string;
  bucket: BucketId;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  dayKey?: string | null;
  weekKey?: string | null;
}

interface TodoState {
  items: Todo[];
  isLoading: boolean;
  error?: string;
}

type TodoAction =
  | { type: "loaded"; items: Todo[] }
  | { type: "loadError"; error: string }
  | { type: "add"; title: string }
  | { type: "move"; id: string; bucket: BucketId }
  | { type: "rollover"; now: string };

interface TodoRepository {
  loadTodos(): Promise<Todo[]>;
  saveTodos(todos: Todo[]): Promise<void>;
}

const STORAGE_KEY = "flodo.todos.v1";

const BUCKETS: { id: BucketId; label: string }[] = [
  { id: "later", label: "Later" },
  { id: "thisWeek", label: "This Week" },
  { id: "today", label: "Today" },
  { id: "done", label: "Done" },
];

function getDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+target - +yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function applyAutoFlow(todos: Todo[], now = new Date()): Todo[] {
  const todayKey = getDayKey(now);
  const weekKey = getWeekKey(now);

  let changed = false;

  const items = todos.map((todo) => {
    if (todo.bucket === "done") return todo;

    let bucket = todo.bucket;
    let dayKey = todo.dayKey ?? null;
    let weekKeyMeta = todo.weekKey ?? null;

    if (bucket === "today") {
      if (!dayKey) {
        dayKey = todayKey;
      } else if (dayKey !== todayKey) {
        bucket = "thisWeek";
        weekKeyMeta = weekKey;
        dayKey = null;
      }
    }

    if (bucket === "thisWeek") {
      if (!weekKeyMeta) {
        weekKeyMeta = weekKey;
      } else if (weekKeyMeta !== weekKey) {
        bucket = "later";
        weekKeyMeta = null;
      }
    }

    const changedTodo =
      bucket !== todo.bucket ||
      dayKey !== (todo.dayKey ?? null) ||
      weekKeyMeta !== (todo.weekKey ?? null);

    if (!changedTodo) return todo;

    changed = true;
    return {
      ...todo,
      bucket,
      dayKey,
      weekKey: weekKeyMeta,
    };
  });

  return changed ? items : todos;
}

class LocalStorageTodoRepository implements TodoRepository {
  async loadTodos(): Promise<Todo[]> {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Todo[];
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  async saveTodos(todos: Todo[]): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const serialized = JSON.stringify(todos);
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // ignore
    }
  }
}

function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case "loaded": {
      const normalized = applyAutoFlow(action.items);
      return { ...state, items: normalized, isLoading: false, error: undefined };
    }
    case "loadError":
      return { ...state, isLoading: false, error: action.error };

    case "add": {
      const title = action.title.trim();
      if (!title) return state;
      const now = new Date().toISOString();
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const newTodo: Todo = {
        id,
        title,
        bucket: "later",
        createdAt: now,
        updatedAt: now,
        dayKey: null,
        weekKey: null,
      };
      return { ...state, items: [newTodo, ...state.items] };
    }

    case "move": {
      const now = new Date();
      const nowIso = now.toISOString();
      const todayKey = getDayKey(now);
      const weekKey = getWeekKey(now);

      let changed = false;
      const items = state.items.map((todo) => {
        if (todo.id !== action.id) return todo;
        if (todo.bucket === action.bucket) return todo;

        changed = true;

        if (action.bucket === "later") {
          return {
            ...todo,
            bucket: "later",
            dayKey: null,
            weekKey: null,
            completedAt: null,
            updatedAt: nowIso,
          };
        }
        if (action.bucket === "thisWeek") {
          return {
            ...todo,
            bucket: "thisWeek",
            weekKey,
            dayKey: null,
            completedAt: null,
            updatedAt: nowIso,
          };
        }
        if (action.bucket === "today") {
          return {
            ...todo,
            bucket: "today",
            dayKey: todayKey,
            weekKey,
            completedAt: null,
            updatedAt: nowIso,
          };
        }
        return {
          ...todo,
          bucket: "done",
          completedAt: nowIso,
          updatedAt: nowIso,
        };
      });

      if (!changed) return state;
      return { ...state, items };
    }

    case "rollover": {
      const now = new Date(action.now);
      const items = applyAutoFlow(state.items, now);
      if (items === state.items) return state;
      return { ...state, items };
    }

    default:
      return state;
  }
}

function useTodos(repository: TodoRepository) {
  const [state, dispatch] = useReducer(todoReducer, {
    items: [],
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await repository.loadTodos();
        if (!cancelled) {
          dispatch({ type: "loaded", items });
        }
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: "loadError",
            error: err instanceof Error ? err.message : "Failed to load todos",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (state.isLoading) return;
    void repository.saveTodos(state.items);
  }, [state.items, state.isLoading, repository]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.setInterval(() => {
      dispatch({ type: "rollover", now: new Date().toISOString() });
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const addTodo = useCallback((title: string) => {
    dispatch({ type: "add", title });
  }, []);

  const moveTodo = useCallback((id: string, bucket: BucketId) => {
    dispatch({ type: "move", id, bucket });
  }, []);

  return { state, addTodo, moveTodo };
}

interface TodoCardProps {
  todo: Todo;
  isDragging: boolean;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onToggleDone: () => void;
}

const TodoCard: React.FC<TodoCardProps> = React.memo(
  ({ todo, isDragging, onDragStart, onDragEnd, onToggleDone }) => {
    const rowBase =
      "flex items-center gap-3 py-2.5 border-b border-dashed border-[rgba(148,163,184,0.35)]";
    const dragging =
      "bg-[rgba(15,23,42,0.02)] opacity-80";

    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={`${rowBase} ${isDragging ? dragging : ""}`}
      >
        <button
          type="button"
          onClick={onToggleDone}
          aria-label={todo.bucket === "done" ? "Mark as not done" : "Mark as done"}
          className="flex h-4 w-4 flex-none items-center justify-center rounded-[4px] border border-[rgba(148,163,184,0.7)] bg-white/80"
        >
          {todo.bucket === "done" && (
            <span className="block h-2 w-2 rounded-[2px] bg-[rgba(15,23,42,0.85)]" />
          )}
        </button>
        <p className="flex-1 break-words text-xs leading-snug text-[var(--sea-ink)] sm:text-[13px]">
          {todo.title}
        </p>
      </div>
    );
  }
);

TodoCard.displayName = "TodoCard";

export const FlodoBoard: React.FC = () => {
  const repository = useMemo(() => new LocalStorageTodoRepository(), []);
  const { state, addTodo, moveTodo } = useTodos(repository);

  const [draft, setDraft] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const label = now.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    setTodayLabel(label);
  }, []);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!draft.trim()) return;
      addTodo(draft);
      setDraft("");
    },
    [draft, addTodo]
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
    (bucket: BucketId) => {
      return (event: React.DragEvent<HTMLDivElement | HTMLElement>) => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain");
        setDraggingId(null);
        if (id) {
          moveTodo(id, bucket);
        }
      };
    },
    [moveTodo]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  if (state.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] px-4">
        <p className="text-xs text-[var(--sea-ink-soft)]">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-stretch justify-center bg-[var(--bg-base)] px-3 py-4 sm:px-6 sm:py-6">
      <section className="flex w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-[rgba(148,163,184,0.25)] bg-[var(--surface)] shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="grid min-h-[520px] grid-cols-1 divide-y divide-[rgba(148,163,184,0.2)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          {BUCKETS.map((bucket) => {
            const items = state.items.filter((todo) => todo.bucket === bucket.id);

            const countLabel =
              bucket.id === "done"
                ? `${items.length} closed task${items.length === 1 ? "" : "s"}`
                : `${items.length} open task${items.length === 1 ? "" : "s"}`;

            return (
              <section
                key={bucket.id}
                onDragOver={handleDragOver}
                onDrop={handleDrop(bucket.id)}
                className="flex flex-col bg-[var(--surface)]"
              >
                <header className="flex items-baseline justify-between gap-2 px-6 pt-5 pb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--sea-ink)]">
                      {bucket.label}
                    </h2>
                    <p className="text-[11px] text-[var(--sea-ink-soft)]">{countLabel}</p>
                  </div>
                  {bucket.id === "today" && todayLabel && (
                    <span className="text-[11px] text-[var(--sea-ink-soft)]">
                      {todayLabel}
                    </span>
                  )}
                </header>

                <div className="flex flex-1 flex-col px-6 pb-6">
                  {bucket.id === "later" && (
                    <form onSubmit={handleSubmit} className="mb-1.5">
                      <div className="flex items-center gap-3 py-2.5 border-b border-dashed border-[rgba(148,163,184,0.35)]">
                        <span className="h-4 w-4 flex-none rounded-[4px] border border-[rgba(148,163,184,0.5)] bg-transparent" />
                        <input
                          type="text"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Add a task"
                          className="flex-1 border-none bg-transparent text-xs leading-snug text-[var(--sea-ink)] placeholder:text-[rgba(148,163,184,0.9)] focus:outline-none focus:ring-0 sm:text-[13px]"
                        />
                      </div>
                    </form>
                  )}

                  {bucket.id === "today" && items.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center text-xs text-[var(--sea-ink-soft)]">
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
                            if (todo.bucket !== "done") {
                              moveTodo(todo.id, "done");
                            }
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
