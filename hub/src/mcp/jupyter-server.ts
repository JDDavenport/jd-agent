#!/usr/bin/env bun
/**
 * JD Agent - Jupyter MCP Server
 *
 * Model Context Protocol server for Claude Code to interact with Jupyter notebooks.
 *
 * Tools provided:
 * - notebook_list: List all notebooks in the workspace
 * - notebook_read: Read a notebook's content
 * - notebook_read_cell: Read a specific cell from a notebook
 * - cell_execute: Execute a cell in a running kernel
 * - cell_create: Add a new cell to a notebook
 * - cell_update: Modify an existing cell
 * - kernel_list: List running kernels
 * - kernel_restart: Restart a kernel
 *
 * Usage:
 *   bun run hub/src/mcp/jupyter-server.ts
 *
 * Configure in Claude Code:
 *   Add to ~/.config/claude/mcp_servers.json
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, extname, basename } from 'path';

// ============================================
// Configuration
// ============================================

const JUPYTER_URL = process.env.JUPYTER_URL || 'http://localhost:8888';
const JUPYTER_TOKEN = process.env.JUPYTER_TOKEN || '';
const NOTEBOOK_DIR = process.env.JUPYTER_NOTEBOOK_DIR || './storage/notebooks';

// ============================================
// Types
// ============================================

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string[];
  outputs?: any[];
  execution_count?: number | null;
  metadata?: Record<string, unknown>;
}

interface NotebookJSON {
  cells: NotebookCell[];
  metadata: {
    kernelspec?: {
      name?: string;
      display_name?: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}

// ============================================
// Utility Functions
// ============================================

function findNotebooks(dir: string): string[] {
  const notebooks: string[] = [];

  if (!existsSync(dir)) return notebooks;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      notebooks.push(...findNotebooks(fullPath));
    } else if (entry.isFile() && extname(entry.name) === '.ipynb') {
      if (!entry.name.includes('.ipynb_checkpoints')) {
        notebooks.push(fullPath);
      }
    }
  }

  return notebooks;
}

function readNotebook(filePath: string): NotebookJSON | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeNotebook(filePath: string, notebook: NotebookJSON): boolean {
  try {
    writeFileSync(filePath, JSON.stringify(notebook, null, 2));
    return true;
  } catch {
    return false;
  }
}

async function jupyterRequest(
  path: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (JUPYTER_TOKEN) {
    headers['Authorization'] = `token ${JUPYTER_TOKEN}`;
  }

  const response = await fetch(`${JUPYTER_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Jupyter API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================
// MCP Server Setup
// ============================================

const server = new Server(
  {
    name: 'jupyter-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================
// Tool Definitions
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'notebook_list',
        description: 'List all Jupyter notebooks in the workspace',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'notebook_read',
        description: 'Read the full content of a Jupyter notebook',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the notebook file',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'notebook_read_cell',
        description: 'Read a specific cell from a notebook',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the notebook file',
            },
            cellIndex: {
              type: 'number',
              description: 'Index of the cell to read (0-based)',
            },
          },
          required: ['path', 'cellIndex'],
        },
      },
      {
        name: 'cell_create',
        description: 'Add a new cell to a notebook',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the notebook file',
            },
            cellType: {
              type: 'string',
              enum: ['code', 'markdown'],
              description: 'Type of cell to create',
            },
            source: {
              type: 'string',
              description: 'Content of the cell',
            },
            afterIndex: {
              type: 'number',
              description: 'Insert after this cell index (-1 for start)',
            },
          },
          required: ['path', 'cellType', 'source'],
        },
      },
      {
        name: 'cell_update',
        description: 'Update the content of an existing cell',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the notebook file',
            },
            cellIndex: {
              type: 'number',
              description: 'Index of the cell to update',
            },
            source: {
              type: 'string',
              description: 'New content for the cell',
            },
          },
          required: ['path', 'cellIndex', 'source'],
        },
      },
      {
        name: 'cell_execute',
        description: 'Execute a code cell in a running Jupyter kernel',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Jupyter session ID',
            },
            code: {
              type: 'string',
              description: 'Code to execute',
            },
          },
          required: ['sessionId', 'code'],
        },
      },
      {
        name: 'kernel_list',
        description: 'List running Jupyter kernels',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'session_list',
        description: 'List active Jupyter sessions',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'kernel_restart',
        description: 'Restart a Jupyter kernel',
        inputSchema: {
          type: 'object',
          properties: {
            kernelId: {
              type: 'string',
              description: 'ID of the kernel to restart',
            },
          },
          required: ['kernelId'],
        },
      },
    ],
  };
});

// ============================================
// Tool Implementations
// ============================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'notebook_list': {
        const notebooks = findNotebooks(NOTEBOOK_DIR);
        const results = notebooks.map((path) => {
          const nb = readNotebook(path);
          return {
            path,
            name: basename(path),
            cellCount: nb?.cells.length || 0,
            kernel: nb?.metadata.kernelspec?.display_name || 'Unknown',
          };
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'notebook_read': {
        const { path } = args as { path: string };
        const notebook = readNotebook(path);

        if (!notebook) {
          return {
            content: [{ type: 'text', text: `Error: Could not read notebook at ${path}` }],
            isError: true,
          };
        }

        // Format cells for readability
        const formattedCells = notebook.cells.map((cell, i) => ({
          index: i,
          type: cell.cell_type,
          source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
          executionCount: cell.execution_count,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  path,
                  kernel: notebook.metadata.kernelspec,
                  cellCount: notebook.cells.length,
                  cells: formattedCells,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'notebook_read_cell': {
        const { path, cellIndex } = args as { path: string; cellIndex: number };
        const notebook = readNotebook(path);

        if (!notebook) {
          return {
            content: [{ type: 'text', text: `Error: Could not read notebook at ${path}` }],
            isError: true,
          };
        }

        if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Cell index ${cellIndex} out of range (0-${notebook.cells.length - 1})`,
              },
            ],
            isError: true,
          };
        }

        const cell = notebook.cells[cellIndex];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  index: cellIndex,
                  type: cell.cell_type,
                  source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
                  outputs: cell.outputs,
                  executionCount: cell.execution_count,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'cell_create': {
        const { path, cellType, source, afterIndex = -1 } = args as {
          path: string;
          cellType: 'code' | 'markdown';
          source: string;
          afterIndex?: number;
        };

        const notebook = readNotebook(path);
        if (!notebook) {
          return {
            content: [{ type: 'text', text: `Error: Could not read notebook at ${path}` }],
            isError: true,
          };
        }

        const newCell: NotebookCell = {
          cell_type: cellType,
          source: source.split('\n').map((line, i, arr) => (i < arr.length - 1 ? line + '\n' : line)),
          metadata: {},
        };

        if (cellType === 'code') {
          newCell.outputs = [];
          newCell.execution_count = null;
        }

        // Insert at position
        const insertIndex = afterIndex + 1;
        notebook.cells.splice(insertIndex, 0, newCell);

        if (!writeNotebook(path, notebook)) {
          return {
            content: [{ type: 'text', text: `Error: Could not write notebook` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Created ${cellType} cell at index ${insertIndex}`,
            },
          ],
        };
      }

      case 'cell_update': {
        const { path, cellIndex, source } = args as {
          path: string;
          cellIndex: number;
          source: string;
        };

        const notebook = readNotebook(path);
        if (!notebook) {
          return {
            content: [{ type: 'text', text: `Error: Could not read notebook at ${path}` }],
            isError: true,
          };
        }

        if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
          return {
            content: [{ type: 'text', text: `Error: Cell index out of range` }],
            isError: true,
          };
        }

        notebook.cells[cellIndex].source = source
          .split('\n')
          .map((line, i, arr) => (i < arr.length - 1 ? line + '\n' : line));

        if (!writeNotebook(path, notebook)) {
          return {
            content: [{ type: 'text', text: `Error: Could not write notebook` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text', text: `Updated cell ${cellIndex}` }],
        };
      }

      case 'cell_execute': {
        const { sessionId, code } = args as { sessionId: string; code: string };

        // Get session to find kernel
        const sessions = await jupyterRequest('/api/sessions');
        const session = sessions.find((s: any) => s.id === sessionId);

        if (!session) {
          return {
            content: [{ type: 'text', text: `Error: Session ${sessionId} not found` }],
            isError: true,
          };
        }

        // Execute code via kernel
        const kernelId = session.kernel.id;
        const executeResult = await jupyterRequest(
          `/api/kernels/${kernelId}/execute`,
          'POST',
          { code }
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(executeResult, null, 2),
            },
          ],
        };
      }

      case 'kernel_list': {
        try {
          const kernels = await jupyterRequest('/api/kernels');
          return {
            content: [{ type: 'text', text: JSON.stringify(kernels, null, 2) }],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Jupyter server not running or not accessible at ${JUPYTER_URL}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'session_list': {
        try {
          const sessions = await jupyterRequest('/api/sessions');
          return {
            content: [{ type: 'text', text: JSON.stringify(sessions, null, 2) }],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Jupyter server not running or not accessible`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'kernel_restart': {
        const { kernelId } = args as { kernelId: string };

        try {
          await jupyterRequest(`/api/kernels/${kernelId}/restart`, 'POST');
          return {
            content: [{ type: 'text', text: `Kernel ${kernelId} restarted` }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: Could not restart kernel` }],
            isError: true,
          };
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// ============================================
// Start Server
// ============================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Jupyter MCP Server running');
}

main().catch(console.error);
