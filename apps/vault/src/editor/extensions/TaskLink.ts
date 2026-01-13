import { Node, mergeAttributes } from '@tiptap/core';

export interface TaskLinkOptions {
  HTMLAttributes: Record<string, any>;
  onTaskClick?: (taskId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskLink: {
      setTaskLink: (attributes: { taskId: string; title: string }) => ReturnType;
    };
  }
}

export const TaskLink = Node.create<TaskLinkOptions>({
  name: 'taskLink',

  addOptions() {
    return {
      HTMLAttributes: {},
      onTaskClick: undefined,
    };
  },

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      taskId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-task-id'),
        renderHTML: (attributes) => ({
          'data-task-id': attributes.taskId,
        }),
      },
      title: {
        default: 'Untitled Task',
        parseHTML: (element) => element.getAttribute('data-title') || element.textContent,
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-task-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const title = HTMLAttributes['data-title'] || 'Untitled Task';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-task-link': '',
        class: 'task-link inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded cursor-pointer transition-colors',
        contenteditable: 'false',
      }),
      ['span', { class: 'task-icon' }, '✓'],
      ['span', { class: 'task-title' }, title],
    ];
  },

  addCommands() {
    return {
      setTaskLink:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // No default shortcuts for task links
    };
  },
});

export default TaskLink;
