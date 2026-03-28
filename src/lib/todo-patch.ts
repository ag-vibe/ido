import type { TodoItem, UpdateTodoRequest } from "@/api-gen/types.gen";

export type TodoWithDescription = TodoItem & {
  description?: string;
};

export type TodoPatch = Partial<Pick<TodoItem, "title" | "bucket" | "done">> & {
  description?: string;
};

export function toUpdateTodoRequest(patch: TodoPatch): UpdateTodoRequest {
  return patch as unknown as UpdateTodoRequest;
}

export function normalizeDescription(description: string | undefined): string {
  return description?.trim() ?? "";
}
