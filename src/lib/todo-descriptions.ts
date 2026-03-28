import { normalizeDescription, type TodoWithDescription } from "@/lib/todo-patch";

const DESCRIPTION_KEY = "flodo.todo-descriptions.v1";

type DescriptionMap = Record<string, string>;

function readDescriptionMap(): DescriptionMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DESCRIPTION_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as DescriptionMap;
  } catch {
    return {};
  }
}

function writeDescriptionMap(next: DescriptionMap): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(DESCRIPTION_KEY, JSON.stringify(next));
}

export function applyStoredDescriptions(todos: TodoWithDescription[]): TodoWithDescription[] {
  const localMap = readDescriptionMap();
  return todos.map((todo) => {
    const serverDescription = normalizeDescription(todo.description);
    if (serverDescription) {
      return { ...todo, description: serverDescription };
    }
    const localDescription = normalizeDescription(localMap[todo.id]);
    if (!localDescription) {
      return todo;
    }
    return { ...todo, description: localDescription };
  });
}

export function persistTodoDescription(todoId: string, description: string): void {
  const normalized = normalizeDescription(description);
  const nextMap = readDescriptionMap();
  if (!normalized) {
    delete nextMap[todoId];
    writeDescriptionMap(nextMap);
    return;
  }
  nextMap[todoId] = normalized;
  writeDescriptionMap(nextMap);
}

export function clearTodoDescription(todoId: string): void {
  const nextMap = readDescriptionMap();
  if (!(todoId in nextMap)) {
    return;
  }
  delete nextMap[todoId];
  writeDescriptionMap(nextMap);
}
