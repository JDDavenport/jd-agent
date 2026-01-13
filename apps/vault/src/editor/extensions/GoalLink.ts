import { Node, mergeAttributes } from '@tiptap/core';

export interface GoalLinkOptions {
  HTMLAttributes: Record<string, any>;
  onGoalClick?: (goalId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    goalLink: {
      setGoalLink: (attributes: { goalId: string; title: string }) => ReturnType;
    };
  }
}

export const GoalLink = Node.create<GoalLinkOptions>({
  name: 'goalLink',

  addOptions() {
    return {
      HTMLAttributes: {},
      onGoalClick: undefined,
    };
  },

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      goalId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-goal-id'),
        renderHTML: (attributes) => ({
          'data-goal-id': attributes.goalId,
        }),
      },
      title: {
        default: 'Untitled Goal',
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
        tag: 'span[data-goal-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const title = HTMLAttributes['data-title'] || 'Untitled Goal';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-goal-link': '',
        class: 'goal-link inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 hover:bg-green-200 text-green-700 rounded cursor-pointer transition-colors',
        contenteditable: 'false',
      }),
      ['span', { class: 'goal-icon' }, '🎯'],
      ['span', { class: 'goal-title' }, title],
    ];
  },

  addCommands() {
    return {
      setGoalLink:
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
      // No default shortcuts for goal links
    };
  },
});

export default GoalLink;
