import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface PageLinkOptions {
  HTMLAttributes: Record<string, any>;
  onPageClick?: (pageId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageLink: {
      setPageLink: (attributes: { pageId: string; title: string }) => ReturnType;
    };
  }
}

export const PageLink = Node.create<PageLinkOptions>({
  name: 'pageLink',

  addOptions() {
    return {
      HTMLAttributes: {},
      onPageClick: undefined,
    };
  },

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-page-id'),
        renderHTML: (attributes) => ({
          'data-page-id': attributes.pageId,
        }),
      },
      title: {
        default: 'Untitled',
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
        tag: 'span[data-page-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const title = HTMLAttributes['data-title'] || 'Untitled';

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-page-link': '',
        class: 'page-link inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded cursor-pointer transition-colors text-sm',
        contenteditable: 'false',
      }),
      ['span', { class: 'page-icon' }, '📄'],
      ['span', { class: 'page-title underline-offset-2 hover:underline' }, title],
    ];
  },

  addCommands() {
    return {
      setPageLink:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },

  addProseMirrorPlugins() {
    const { onPageClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey('pageLinkClick'),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target as HTMLElement;
            const pageLink = target.closest('[data-page-link]');

            if (pageLink && onPageClick) {
              const pageId = pageLink.getAttribute('data-page-id');
              if (pageId) {
                event.preventDefault();
                onPageClick(pageId);
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});

export default PageLink;
