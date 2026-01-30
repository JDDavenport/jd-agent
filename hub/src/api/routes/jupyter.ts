/**
 * JD Agent - Jupyter API Routes
 *
 * Endpoints for Jupyter notebook integration:
 * - Get server status
 * - Get launch URL
 * - List and manage notebooks
 * - Trigger sync operations
 */

import { Hono } from 'hono';
import { jupyterIntegration } from '../../integrations/jupyter';
import { notebookService } from '../../services/notebook-service';
import { notebookWatcherService } from '../../services/notebook-watcher-service';
import { addNotebookSyncJob } from '../../jobs/queue';

const jupyterRouter = new Hono();

// ============================================
// Server Status
// ============================================

/**
 * GET /api/jupyter/status
 * Check if Jupyter server is running
 */
jupyterRouter.get('/status', async (c) => {
  try {
    const status = await jupyterIntegration.checkStatus();
    const watcherStatus = notebookWatcherService.getStatus();

    return c.json({
      success: true,
      data: {
        server: status,
        watcher: watcherStatus,
        config: {
          notebookDir: jupyterIntegration.getNotebookDir(),
        },
      },
    });
  } catch (error) {
    console.error('[Jupyter API] Error checking status:', error);
    return c.json(
      {
        success: false,
        error: { code: 'STATUS_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// Launch URL
// ============================================

/**
 * GET /api/jupyter/launch
 * Get the URL to launch Jupyter Lab
 */
jupyterRouter.get('/launch', async (c) => {
  try {
    const launchUrl = jupyterIntegration.getLabUrl();
    const status = await jupyterIntegration.checkStatus();

    return c.json({
      success: true,
      data: {
        url: launchUrl,
        isRunning: status.isRunning,
        message: status.isRunning
          ? 'Jupyter Lab is running'
          : 'Jupyter Lab is not running. Start it with: jupyter lab',
      },
    });
  } catch (error) {
    console.error('[Jupyter API] Error getting launch URL:', error);
    return c.json(
      {
        success: false,
        error: { code: 'LAUNCH_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// List Notebooks
// ============================================

/**
 * GET /api/jupyter/notebooks
 * List all tracked notebooks
 */
jupyterRouter.get('/notebooks', async (c) => {
  try {
    const notebooks = await notebookService.list();

    return c.json({
      success: true,
      data: notebooks,
      count: notebooks.length,
    });
  } catch (error) {
    console.error('[Jupyter API] Error listing notebooks:', error);
    return c.json(
      {
        success: false,
        error: { code: 'LIST_ERROR', message: String(error) },
      },
      500
    );
  }
});

/**
 * GET /api/jupyter/notebooks/:id
 * Get a specific notebook by ID
 */
jupyterRouter.get('/notebooks/:id', async (c) => {
  const { id } = c.req.param();

  try {
    const notebook = await notebookService.getById(id);

    if (!notebook) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notebook not found' },
        },
        404
      );
    }

    // Get URL to open this notebook
    const openUrl = jupyterIntegration.getNotebookUrl(notebook.filePath);

    return c.json({
      success: true,
      data: {
        ...notebook,
        openUrl,
      },
    });
  } catch (error) {
    console.error('[Jupyter API] Error getting notebook:', error);
    return c.json(
      {
        success: false,
        error: { code: 'GET_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// Search Notebooks
// ============================================

/**
 * GET /api/jupyter/search
 * Search notebooks by content
 */
jupyterRouter.get('/search', async (c) => {
  const query = c.req.query('q');

  if (!query) {
    return c.json(
      {
        success: false,
        error: { code: 'MISSING_QUERY', message: 'Search query is required' },
      },
      400
    );
  }

  try {
    const results = await notebookService.search(query);

    return c.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('[Jupyter API] Error searching notebooks:', error);
    return c.json(
      {
        success: false,
        error: { code: 'SEARCH_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// Statistics
// ============================================

/**
 * GET /api/jupyter/stats
 * Get notebook statistics
 */
jupyterRouter.get('/stats', async (c) => {
  try {
    const stats = await notebookService.getStats();

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Jupyter API] Error getting stats:', error);
    return c.json(
      {
        success: false,
        error: { code: 'STATS_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// Sync Operations
// ============================================

/**
 * POST /api/jupyter/sync
 * Trigger a manual sync of all notebooks
 */
jupyterRouter.post('/sync', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const forceReprocess = body.force === true;

    // Queue a sync job
    const job = await addNotebookSyncJob({ forceReprocess });

    return c.json({
      success: true,
      data: {
        jobId: job.id,
        message: 'Notebook sync job queued',
      },
    });
  } catch (error) {
    console.error('[Jupyter API] Error triggering sync:', error);
    return c.json(
      {
        success: false,
        error: { code: 'SYNC_ERROR', message: String(error) },
      },
      500
    );
  }
});

/**
 * POST /api/jupyter/sync/immediate
 * Sync notebooks immediately (blocking)
 */
jupyterRouter.post('/sync/immediate', async (c) => {
  try {
    const result = await notebookService.syncAll();

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Jupyter API] Error syncing immediately:', error);
    return c.json(
      {
        success: false,
        error: { code: 'SYNC_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// Watcher Control
// ============================================

/**
 * POST /api/jupyter/watcher/start
 * Start the notebook file watcher
 */
jupyterRouter.post('/watcher/start', async (c) => {
  try {
    const started = notebookWatcherService.startWatching();

    return c.json({
      success: true,
      data: {
        started,
        status: notebookWatcherService.getStatus(),
      },
    });
  } catch (error) {
    console.error('[Jupyter API] Error starting watcher:', error);
    return c.json(
      {
        success: false,
        error: { code: 'WATCHER_ERROR', message: String(error) },
      },
      500
    );
  }
});

/**
 * POST /api/jupyter/watcher/stop
 * Stop the notebook file watcher
 */
jupyterRouter.post('/watcher/stop', async (c) => {
  try {
    notebookWatcherService.stopWatching();

    return c.json({
      success: true,
      data: {
        status: notebookWatcherService.getStatus(),
      },
    });
  } catch (error) {
    console.error('[Jupyter API] Error stopping watcher:', error);
    return c.json(
      {
        success: false,
        error: { code: 'WATCHER_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// Sessions and Kernels
// ============================================

/**
 * GET /api/jupyter/kernels
 * List running Jupyter kernels
 */
jupyterRouter.get('/kernels', async (c) => {
  try {
    const kernels = await jupyterIntegration.listKernels();

    return c.json({
      success: true,
      data: kernels,
    });
  } catch (error) {
    console.error('[Jupyter API] Error listing kernels:', error);
    return c.json(
      {
        success: false,
        error: { code: 'KERNELS_ERROR', message: String(error) },
      },
      500
    );
  }
});

/**
 * GET /api/jupyter/sessions
 * List active Jupyter sessions
 */
jupyterRouter.get('/sessions', async (c) => {
  try {
    const sessions = await jupyterIntegration.listSessions();

    return c.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('[Jupyter API] Error listing sessions:', error);
    return c.json(
      {
        success: false,
        error: { code: 'SESSIONS_ERROR', message: String(error) },
      },
      500
    );
  }
});

// ============================================
// Delete Notebook
// ============================================

/**
 * DELETE /api/jupyter/notebooks/:id
 * Delete a notebook record (and optionally the file)
 */
jupyterRouter.delete('/notebooks/:id', async (c) => {
  const { id } = c.req.param();
  const deleteFile = c.req.query('deleteFile') === 'true';

  try {
    const result = await notebookService.delete(id, deleteFile);

    if (result.success) {
      return c.json({
        success: true,
        message: deleteFile ? 'Notebook and file deleted' : 'Notebook record deleted',
      });
    } else {
      return c.json(
        {
          success: false,
          error: { code: 'DELETE_ERROR', message: result.error },
        },
        400
      );
    }
  } catch (error) {
    console.error('[Jupyter API] Error deleting notebook:', error);
    return c.json(
      {
        success: false,
        error: { code: 'DELETE_ERROR', message: String(error) },
      },
      500
    );
  }
});

export default jupyterRouter;
