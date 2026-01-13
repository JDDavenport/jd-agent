import { Node, mergeAttributes } from '@tiptap/core';

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { emoji?: string; type?: string }) => ReturnType;
      toggleCallout: (attributes?: { emoji?: string; type?: string }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  content: 'block+',

  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (element) => element.getAttribute('data-emoji') || '💡',
        renderHTML: (attributes) => ({
          'data-emoji': attributes.emoji,
        }),
      },
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-type') || 'info',
        renderHTML: (attributes) => ({
          'data-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const emoji = HTMLAttributes['data-emoji'] || '💡';
    const type = HTMLAttributes['data-type'] || 'info';

    const typeColors: Record<string, string> = {
      info: 'bg-blue-50 border-blue-200',
      warning: 'bg-yellow-50 border-yellow-200',
      error: 'bg-red-50 border-red-200',
      success: 'bg-green-50 border-green-200',
      note: 'bg-gray-50 border-gray-200',
    };

    const colorClass = typeColors[type] || typeColors.info;

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-callout': '',
        class: `callout ${colorClass} border-l-4 p-4 my-4 rounded-r-lg`,
      }),
      [
        'div',
        { class: 'callout-content flex gap-3' },
        ['span', { class: 'callout-emoji text-xl flex-shrink-0' }, emoji],
        ['div', { class: 'callout-body flex-1' }, 0],
      ],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    };
  },
});

export default Callout;
