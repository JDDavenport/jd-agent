import { Node, mergeAttributes } from '@tiptap/core';

export interface BookmarkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attributes: {
        url: string;
        title?: string;
        description?: string;
        favicon?: string;
        image?: string;
      }) => ReturnType;
    };
  }
}

export const Bookmark = Node.create<BookmarkOptions>({
  name: 'bookmark',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-url'),
        renderHTML: (attributes) => ({
          'data-url': attributes.url,
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
      description: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-description'),
        renderHTML: (attributes) => ({
          'data-description': attributes.description,
        }),
      },
      favicon: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-favicon'),
        renderHTML: (attributes) => ({
          'data-favicon': attributes.favicon,
        }),
      },
      image: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-image'),
        renderHTML: (attributes) => ({
          'data-image': attributes.image,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-bookmark]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes['data-url'];
    const title = HTMLAttributes['data-title'] || url;
    const description = HTMLAttributes['data-description'];
    const favicon = HTMLAttributes['data-favicon'];
    const image = HTMLAttributes['data-image'];

    // Extract domain for display
    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }

    const content: any[] = [
      [
        'div',
        { class: 'bookmark-info flex-1 min-w-0' },
        ['div', { class: 'bookmark-title font-medium text-gray-900 truncate' }, title],
        description
          ? ['div', { class: 'bookmark-description text-sm text-gray-500 line-clamp-2 mt-1' }, description]
          : '',
        [
          'div',
          { class: 'bookmark-url flex items-center gap-1 mt-2 text-xs text-gray-400' },
          favicon
            ? ['img', { src: favicon, class: 'w-4 h-4', alt: '' }]
            : ['span', { class: 'text-base' }, '🔗'],
          ['span', { class: 'truncate' }, domain],
        ],
      ],
    ];

    if (image) {
      content.push([
        'div',
        { class: 'bookmark-image flex-shrink-0 w-32 h-20 ml-4' },
        [
          'img',
          {
            src: image,
            alt: '',
            class: 'w-full h-full object-cover rounded',
          },
        ],
      ]);
    }

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-bookmark': '',
        class: 'bookmark my-2',
      }),
      [
        'a',
        {
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'flex items-start p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors no-underline text-inherit',
        },
        ...content,
      ],
    ];
  },

  addCommands() {
    return {
      setBookmark:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },
});

export default Bookmark;
