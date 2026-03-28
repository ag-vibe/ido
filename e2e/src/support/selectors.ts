export const selectors = {
  board: '[data-testid="todo-board"]',
  syncStatus: '[data-testid="sync-status"]',
  newInput: '[data-testid="todo-new-input"]',
  todoCard: '[data-testid="todo-card"]',
  todoTitle: '[data-testid="todo-title"]',
  todoTitleInput: '[data-testid="todo-title-input"]',
  todoDescription: '[data-testid="todo-description"]',
  todoDescriptionInput: '[data-testid="todo-description-input"]',
  todoToggle: '[data-testid="todo-toggle"]',
  todoDelete: '[data-testid="todo-delete"]',
  bucket: (bucketId: "later" | "week" | "today" | "done") =>
    `[data-testid="todo-bucket-${bucketId}"]`,
};
