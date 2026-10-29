/**
 * Keys for editor state that belongs to one project. localDB adds the
 * authenticated user scope on top of this key, so projects remain isolated
 * within an account as well as across accounts.
 */
export function projectStorageKey(projectId: string, key: string): string {
  return `keyvideo_project:${projectId}:${key}`;
}
