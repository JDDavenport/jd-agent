import { Node, mergeAttributes } from '@tiptap/core';

export interface ToggleOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: () => ReturnType;
      unsetToggle: () => ReturnType;
    };
  }
}

// Toggle Summary (the clickable header)
export const ToggleSummary = Node.create({
  name: 'toggleSummary',

  group: 'block',

  content: 'inline*',

  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'summary',
      mergeAttributes(HTMLAttributes, {
        class: 'toggle-summary cursor-pointer select-none font-medium py-1 hover:bg-gray-50 rounded',
      }),
      0,
    ];
  },
});

// Toggle Content (the collapsible body)
export const ToggleContent = Node.create({
  name: 'toggleContent',

  group: 'block',

  content: 'block+',

  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-toggle-content]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-toggle-content': '',
        class: 'toggle-content pl-5 border-l-2 border-gray-200 ml-2 mt-2',
      }),
      0,
    ];
  },
});

// Toggle (details element wrapper)
export const Toggle = Node.create<ToggleOptions>({
  name: 'toggle',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  content: 'toggleSummary toggleContent',

  defining: true,

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: (attributes) => {
          if (!attributes.open) {
            return {};
          }
          return { open: '' };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'toggle my-2 p-2 bg-gray-50 rounded-lg border border-gray-200',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setToggle:
        () =>
        ({ commands, state }) => {
          const { selection } = state;
          const { $from } = selection;
          const text = $from.parent.textContent || 'Toggle heading';

          return commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [
              {
                type: 'toggleSummary',
                content: [{ type: 'text', text }],
              },
              {
                type: 'toggleContent',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Toggle content...' }],
                  },
                ],
              },
            ],
          });
        },
      unsetToggle:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },
});

export default Toggle;
