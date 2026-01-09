// Design tokens inspired by Notion's design system

export const tokens = {
  colors: {
    // Text colors (warm grays like Notion)
    text: {
      primary: '#37352f',
      secondary: '#787774',
      muted: '#9b9a97',
      placeholder: '#b4b4b4',
      link: '#2383e2',
    },

    // Background colors
    bg: {
      default: '#ffffff',
      sidebar: '#fbfbfa',
      hover: 'rgba(55, 53, 47, 0.08)',
      active: 'rgba(55, 53, 47, 0.16)',
      selected: 'rgba(35, 131, 226, 0.14)',
      tertiary: '#f7f6f3',
    },

    // Border colors
    border: {
      light: 'rgba(55, 53, 47, 0.09)',
      medium: 'rgba(55, 53, 47, 0.16)',
    },

    // Callout background colors
    callout: {
      gray: '#f1f1ef',
      brown: '#f4eeee',
      orange: '#fbecdd',
      yellow: '#fbf3db',
      green: '#edf3ec',
      blue: '#e7f3f8',
      purple: '#f4f0f7',
      pink: '#faf1f5',
      red: '#fdebec',
    },

    // Accent colors
    accent: {
      blue: '#2383e2',
      purple: '#9065b0',
    },
  },

  // Typography
  fonts: {
    sans: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '24px',
    '2xl': '30px',
    '3xl': '40px',
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.625,
  },

  // Spacing (8px grid system)
  spacing: {
    0: '0px',
    0.5: '2px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    20: '80px',
    24: '96px',
  },

  // Layout
  layout: {
    sidebarWidth: '224px',
    sidebarCollapsedWidth: '0px',
    editorMaxWidth: '708px',
    editorPadding: '96px',
  },

  // Border radius
  borderRadius: {
    sm: '3px',
    md: '4px',
    lg: '6px',
    xl: '8px',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.08)',
    lg: '0 15px 40px rgba(0, 0, 0, 0.15)',
    dropdown: '0 4px 24px rgba(0, 0, 0, 0.15)',
  },

  // Transitions
  transitions: {
    fast: '100ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
  },

  // Z-index layers
  zIndex: {
    dropdown: 100,
    modal: 200,
    tooltip: 300,
    commandPalette: 400,
  },
} as const;

// CSS custom properties for use in stylesheets
export const cssVariables = `
  :root {
    /* Text colors */
    --text-primary: ${tokens.colors.text.primary};
    --text-secondary: ${tokens.colors.text.secondary};
    --text-muted: ${tokens.colors.text.muted};
    --text-placeholder: ${tokens.colors.text.placeholder};
    --text-link: ${tokens.colors.text.link};

    /* Background colors */
    --bg-default: ${tokens.colors.bg.default};
    --bg-sidebar: ${tokens.colors.bg.sidebar};
    --bg-hover: ${tokens.colors.bg.hover};
    --bg-active: ${tokens.colors.bg.active};
    --bg-selected: ${tokens.colors.bg.selected};
    --bg-tertiary: ${tokens.colors.bg.tertiary};

    /* Border colors */
    --border-light: ${tokens.colors.border.light};
    --border-medium: ${tokens.colors.border.medium};

    /* Callout colors */
    --callout-gray: ${tokens.colors.callout.gray};
    --callout-brown: ${tokens.colors.callout.brown};
    --callout-orange: ${tokens.colors.callout.orange};
    --callout-yellow: ${tokens.colors.callout.yellow};
    --callout-green: ${tokens.colors.callout.green};
    --callout-blue: ${tokens.colors.callout.blue};
    --callout-purple: ${tokens.colors.callout.purple};
    --callout-pink: ${tokens.colors.callout.pink};
    --callout-red: ${tokens.colors.callout.red};

    /* Typography */
    --font-sans: ${tokens.fonts.sans};
    --font-mono: ${tokens.fonts.mono};

    /* Layout */
    --sidebar-width: ${tokens.layout.sidebarWidth};
    --editor-max-width: ${tokens.layout.editorMaxWidth};
    --editor-padding: ${tokens.layout.editorPadding};

    /* Shadows */
    --shadow-sm: ${tokens.shadows.sm};
    --shadow-md: ${tokens.shadows.md};
    --shadow-lg: ${tokens.shadows.lg};
    --shadow-dropdown: ${tokens.shadows.dropdown};
  }
`;

export default tokens;
