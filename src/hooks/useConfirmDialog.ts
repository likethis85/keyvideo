import { useState } from 'react';

export interface ConfirmDialogState {
  title: string;
  message: string;
  onConfirm: () => void;
}

export function useConfirmDialog() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const showConfirm = (title: string, message: string, onConfirm: () => void) => setConfirmDialog({ title, message, onConfirm });
  const closeConfirm = () => setConfirmDialog(null);
  return { confirmDialog, showConfirm, closeConfirm };
}
