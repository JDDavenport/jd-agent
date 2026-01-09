import { Extension } from '@tiptap/core';

/**
 * TabIndentation Extension
 *
 * Handles Tab and Shift+Tab for list indentation in the editor.
 * - Tab: Indent list item (sink)
 * - Shift+Tab: Outdent list item (lift)
 */
export const TabIndentation = Extension.create({
  name: 'tabIndentation',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Try to sink list item first
        if (this.editor.commands.sinkListItem('listItem')) {
          return true;
        }
        // Then try task item
        if (this.editor.commands.sinkListItem('taskItem')) {
          return true;
        }
        // Default: prevent tab from leaving editor
        return true;
      },
      'Shift-Tab': () => {
        // Try to lift list item first
        if (this.editor.commands.liftListItem('listItem')) {
          return true;
        }
        // Then try task item
        if (this.editor.commands.liftListItem('taskItem')) {
          return true;
        }
        // Default: prevent shift+tab from leaving editor
        return true;
      },
    };
  },
});
