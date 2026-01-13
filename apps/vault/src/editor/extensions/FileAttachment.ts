import { Node, mergeAttributes } from '@tiptap/core';

export interface FileAttachmentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      setFileAttachment: (attributes: {
        url: string;
        filename: string;
        size?: number;
        mimeType?: string;
      }) => ReturnType;
    };
  }
}

export const FileAttachment = Node.create<FileAttachmentOptions>({
  name: 'fileAttachment',

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
      filename: {
        default: 'Untitled',
        parseHTML: (element) => element.getAttribute('data-filename'),
        renderHTML: (attributes) => ({
          'data-filename': attributes.filename,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => {
          const size = element.getAttribute('data-size');
          return size ? parseInt(size, 10) : null;
        },
        renderHTML: (attributes) => ({
          'data-size': attributes.size?.toString() || '',
        }),
      },
      mimeType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-mimetype'),
        renderHTML: (attributes) => ({
          'data-mimetype': attributes.mimeType,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-file-attachment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const url = HTMLAttributes['data-url'];
    const filename = HTMLAttributes['data-filename'] || 'Untitled';
    const size = HTMLAttributes['data-size'];
    const mimeType = HTMLAttributes['data-mimetype'];

    // Format file size
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Get icon based on mime type
    const getIcon = (mime: string | null): string => {
      if (!mime) return '📄';
      if (mime.startsWith('image/')) return '🖼️';
      if (mime.startsWith('video/')) return '🎬';
      if (mime.startsWith('audio/')) return '🎵';
      if (mime.includes('pdf')) return '📕';
      if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
      if (mime.includes('document') || mime.includes('word')) return '📝';
      if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
      return '📄';
    };

    const icon = getIcon(mimeType);
    const sizeText = size ? formatSize(parseInt(size, 10)) : '';

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-file-attachment': '',
        class: 'file-attachment flex items-center gap-3 p-3 my-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer',
      }),
      [
        'a',
        {
          href: url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'flex items-center gap-3 w-full no-underline text-inherit',
        },
        ['span', { class: 'file-icon text-2xl' }, icon],
        [
          'div',
          { class: 'file-info flex-1 min-w-0' },
          ['div', { class: 'file-name font-medium text-gray-900 truncate' }, filename],
          sizeText
            ? ['div', { class: 'file-size text-xs text-gray-500' }, sizeText]
            : '',
        ],
        [
          'span',
          { class: 'download-icon text-gray-400' },
          '↓',
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setFileAttachment:
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

export default FileAttachment;
