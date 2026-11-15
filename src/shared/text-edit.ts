export const textEditCommands = ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll', 'delete'] as const
export type TextEditCommand = (typeof textEditCommands)[number]
