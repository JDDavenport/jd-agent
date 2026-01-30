import type { JSONContent } from '@tiptap/react';
import type {
  BatchBlockOperation,
  CreateVaultBlockInput,
  VaultBlockType,
} from '../api';

const CALLOUT_COLOR_MAP: Record<string, 'gray' | 'yellow' | 'red' | 'green' | 'blue'> = {
  info: 'blue',
  warning: 'yellow',
  error: 'red',
  success: 'green',
  note: 'gray',
};

function extractText(node?: JSONContent): string {
  if (!node) return '';
  if (node.type === 'text') {
    return node.text || '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (!node.content || node.content.length === 0) {
    return '';
  }
  return node.content.map(extractText).join('');
}

function getListItemText(node: JSONContent): string {
  const paragraph = node.content?.find((child) => child.type === 'paragraph');
  if (paragraph) {
    return extractText(paragraph);
  }
  return extractText(node);
}

function pushBlock(
  blocks: CreateVaultBlockInput[],
  type: VaultBlockType,
  content: CreateVaultBlockInput['content']
) {
  if (type === 'divider') {
    blocks.push({ type, content: {} });
    return;
  }

  if (type === 'image' && (!content || !('url' in content) || !content.url)) {
    return;
  }

  if (type === 'file' && (!content || !('url' in content) || !content.url)) {
    return;
  }

  if (type === 'bookmark' && (!content || !('url' in content) || !content.url)) {
    return;
  }

  const text =
    typeof content === 'object' && content && 'text' in content
      ? String(content.text || '')
      : '';

  if (type === 'text' || type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
    if (!text.trim()) return;
  }

  blocks.push({ type, content });
}

function parseNodes(nodes: JSONContent[] | undefined, blocks: CreateVaultBlockInput[]) {
  if (!nodes || nodes.length === 0) return;

  nodes.forEach((node) => {
    switch (node.type) {
      case 'paragraph': {
        const text = extractText(node);
        pushBlock(blocks, 'text', { text });
        break;
      }
      case 'heading': {
        const level = (node.attrs?.level ?? 1) as 1 | 2 | 3;
        const text = extractText(node);
        const type: VaultBlockType = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
        pushBlock(blocks, type, { text, level });
        break;
      }
      case 'bulletList': {
        node.content?.forEach((item) => {
          if (item.type === 'listItem') {
            const text = getListItemText(item);
            pushBlock(blocks, 'bulleted_list', { text });
          }
        });
        break;
      }
      case 'orderedList': {
        node.content?.forEach((item) => {
          if (item.type === 'listItem') {
            const text = getListItemText(item);
            pushBlock(blocks, 'numbered_list', { text });
          }
        });
        break;
      }
      case 'taskList': {
        node.content?.forEach((item) => {
          if (item.type === 'taskItem') {
            const text = getListItemText(item);
            const checked = Boolean(item.attrs?.checked);
            pushBlock(blocks, 'todo', { text, checked });
          }
        });
        break;
      }
      case 'blockquote': {
        const text = extractText(node);
        pushBlock(blocks, 'quote', { text });
        break;
      }
      case 'codeBlock': {
        const code = extractText(node);
        const language = node.attrs?.language ?? undefined;
        pushBlock(blocks, 'code', { code, language });
        break;
      }
      case 'horizontalRule': {
        pushBlock(blocks, 'divider', {});
        break;
      }
      case 'image': {
        pushBlock(blocks, 'image', {
          url: node.attrs?.src,
          caption: node.attrs?.alt || undefined,
        });
        break;
      }
      case 'callout': {
        const text = extractText(node);
        pushBlock(blocks, 'callout', {
          text,
          emoji: node.attrs?.emoji,
          color: CALLOUT_COLOR_MAP[node.attrs?.type] ?? 'blue',
        });
        break;
      }
      case 'toggle': {
        const summaryNode = node.content?.find((child) => child.type === 'toggleSummary');
        const text = extractText(summaryNode);
        pushBlock(blocks, 'toggle', { text });
        break;
      }
      case 'fileAttachment': {
        pushBlock(blocks, 'file', {
          url: node.attrs?.url,
          filename: node.attrs?.filename || 'Untitled',
          size: node.attrs?.size,
          mimeType: node.attrs?.mimeType,
        });
        break;
      }
      case 'bookmark': {
        pushBlock(blocks, 'bookmark', {
          url: node.attrs?.url,
          title: node.attrs?.title,
          description: node.attrs?.description,
          favicon: node.attrs?.favicon,
          image: node.attrs?.image,
        });
        break;
      }
      case 'pageLink': {
        pushBlock(blocks, 'page_link', {
          pageId: node.attrs?.pageId,
          title: node.attrs?.title,
        });
        break;
      }
      case 'taskLink': {
        pushBlock(blocks, 'task_link', {
          taskId: node.attrs?.taskId,
          title: node.attrs?.title,
        });
        break;
      }
      case 'goalLink': {
        pushBlock(blocks, 'goal_link', {
          goalId: node.attrs?.goalId,
          title: node.attrs?.title,
        });
        break;
      }
      default: {
        if (node.content) {
          parseNodes(node.content, blocks);
        }
        break;
      }
    }
  });
}

export function tiptapJsonToBlocks(doc: JSONContent | null | undefined): CreateVaultBlockInput[] {
  if (!doc || !doc.content) return [];
  const blocks: CreateVaultBlockInput[] = [];
  parseNodes(doc.content, blocks);
  return blocks;
}

export function buildReplaceOperations(
  existingBlockIds: string[],
  blocks: CreateVaultBlockInput[]
): BatchBlockOperation[] {
  const deleteOps: BatchBlockOperation[] = existingBlockIds.map((id) => ({
    op: 'delete',
    blockId: id,
  }));

  const createOps: BatchBlockOperation[] = blocks.map((block) => ({
    op: 'create',
    data: block,
  }));

  return [...deleteOps, ...createOps];
}
