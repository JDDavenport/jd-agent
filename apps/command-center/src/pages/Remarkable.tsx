import { useState } from 'react';
import {
  useRemarkableCloudStatus,
  useRemarkableMbaStatus,
  useRemarkableMbaTree,
  useSyncRemarkableCloud,
  useSyncMbaFolder,
  useRenderDocument,
  formatDateTime,
  getDocumentIcon,
  type FolderTreeNode,
  type RemarkableDocument,
} from '../hooks/useRemarkable';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Recursive component for folder tree
function FolderNode({
  node,
  level = 0,
  onSelectDocument
}: {
  node: FolderTreeNode;
  level?: number;
  onSelectDocument: (doc: RemarkableDocument) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2);

  return (
    <div className="select-none">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-card-hover rounded-lg transition-colors text-left`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
      >
        <span className="text-text-muted text-sm">
          {isExpanded ? '▼' : '▶'}
        </span>
        <span>📁</span>
        <span className="font-medium">{node.name}</span>
        <span className="text-text-muted text-sm ml-auto">
          {node.children.length} docs, {node.subfolders.length} folders
        </span>
      </button>

      {isExpanded && (
        <div>
          {/* Subfolders */}
          {node.subfolders.map((subfolder) => (
            <FolderNode
              key={subfolder.id}
              node={subfolder}
              level={level + 1}
              onSelectDocument={onSelectDocument}
            />
          ))}

          {/* Documents */}
          {node.children.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onSelectDocument(doc)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-card-hover rounded-lg transition-colors text-left"
              style={{ paddingLeft: `${28 + level * 16}px` }}
            >
              <span>{getDocumentIcon(doc.type)}</span>
              <span className="truncate flex-1">{doc.name}</span>
              {doc.pageCount && (
                <span className="text-text-muted text-sm">
                  {doc.pageCount} pages
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Remarkable() {
  const [selectedDocument, setSelectedDocument] = useState<RemarkableDocument | null>(null);
  const [renderedPdf, setRenderedPdf] = useState<{ url: string; ocrText: string } | null>(null);

  const { data: cloudStatus, isLoading: loadingCloudStatus } = useRemarkableCloudStatus();
  const { data: mbaStatus, isLoading: loadingMbaStatus } = useRemarkableMbaStatus();
  const { data: mbaTree, isLoading: loadingTree } = useRemarkableMbaTree();

  const syncCloud = useSyncRemarkableCloud();
  const syncMba = useSyncMbaFolder();
  const renderDoc = useRenderDocument();

  const handleSyncCloud = async () => {
    try {
      await syncCloud.mutateAsync();
    } catch (error) {
      alert(`Cloud sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSyncMba = async () => {
    try {
      const result = await syncMba.mutateAsync();
      alert(result.message || 'MBA sync job queued');
    } catch (error) {
      alert(`MBA sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRenderDocument = async (doc: RemarkableDocument) => {
    setSelectedDocument(doc);
    setRenderedPdf(null);

    try {
      const result = await renderDoc.mutateAsync(doc.id);
      setRenderedPdf({
        url: result.pdfUrl,
        ocrText: result.ocrText,
      });
    } catch (error) {
      alert(`Render failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loadingCloudStatus && loadingMbaStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-2xl">📓</span>
            Remarkable Sync
          </h1>
          <p className="text-text-muted mt-1">
            {cloudStatus?.documentCount || 0} documents in cloud
            {cloudStatus?.lastSync && ` • Last sync: ${formatDateTime(new Date(cloudStatus.lastSync).getTime())}`}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={handleSyncCloud}
            disabled={syncCloud.isPending}
          >
            {syncCloud.isPending ? 'Syncing...' : '☁️ Sync Cloud'}
          </Button>
          <Button
            variant="primary"
            onClick={handleSyncMba}
            disabled={syncMba.isPending || !mbaStatus?.mbaFolderFound}
          >
            {syncMba.isPending ? 'Syncing...' : '📚 Sync MBA to Vault'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-400">
            {cloudStatus?.documentCount || 0}
          </div>
          <div className="text-sm text-text-muted">Cloud Documents</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">
            {mbaStatus?.syncedDocuments || 0}
          </div>
          <div className="text-sm text-text-muted">Synced to Vault</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {mbaStatus?.pendingDocuments || 0}
          </div>
          <div className="text-sm text-text-muted">Pending Sync</div>
        </div>
        <div className="card p-4">
          <div className={`text-2xl font-bold ${cloudStatus?.hasValidUserToken ? 'text-green-400' : 'text-red-400'}`}>
            {cloudStatus?.hasValidUserToken ? '✓' : '✗'}
          </div>
          <div className="text-sm text-text-muted">Cloud Connected</div>
        </div>
      </div>

      {/* MBA Folder Structure */}
      {mbaStatus?.mbaFolderFound && mbaStatus.folderStructure.length > 0 && (
        <div className="card p-4">
          <h3 className="text-lg font-semibold mb-3">MBA Folder Structure</h3>
          <div className="flex flex-wrap gap-4">
            {mbaStatus.folderStructure.map((semester) => (
              <div key={semester.id || semester.name} className="bg-dark-card-hover rounded-lg p-3">
                <div className="font-medium text-accent">{semester.name}</div>
                <div className="text-sm text-text-muted mt-1">
                  {semester.subfolders?.map(f => f.name).join(', ') || 'No classes'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Folder Tree */}
        <div className="card p-4">
          <h3 className="text-lg font-semibold mb-4">MBA Folder Tree</h3>

          {loadingTree ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : mbaTree?.tree ? (
            <div className="max-h-[500px] overflow-y-auto">
              {mbaTree.tree.map((node) => (
                <FolderNode
                  key={node.id}
                  node={node}
                  onSelectDocument={handleRenderDocument}
                />
              ))}
            </div>
          ) : mbaStatus?.mbaFolderFound === false ? (
            <div className="text-center py-8 text-text-muted">
              <div className="text-4xl mb-4">📁</div>
              <p>MBA BYU folder not found in Remarkable Cloud.</p>
              <p className="text-sm mt-2">
                Create a folder named "MBA BYU" in your Remarkable to get started.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-text-muted">
              <div className="text-4xl mb-4">☁️</div>
              <p>Click "Sync Cloud" to load documents from Remarkable.</p>
            </div>
          )}
        </div>

        {/* Document Preview */}
        <div className="card p-4">
          <h3 className="text-lg font-semibold mb-4">Document Preview</h3>

          {renderDoc.isPending ? (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner size="lg" />
              <p className="text-text-muted mt-4">Rendering PDF...</p>
              <p className="text-text-muted text-sm mt-1">This may take a minute for large documents</p>
            </div>
          ) : selectedDocument && renderedPdf ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{selectedDocument.name}</div>
                  <div className="text-sm text-text-muted">
                    {selectedDocument.pageCount || 1} pages • {formatDateTime(selectedDocument.lastModified)}
                  </div>
                </div>
                <a
                  href={`http://localhost:3000${renderedPdf.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary text-sm"
                >
                  📄 Open PDF
                </a>
              </div>

              {/* PDF Embed */}
              <div className="bg-dark-bg rounded-lg overflow-hidden" style={{ height: '400px' }}>
                <iframe
                  src={`http://localhost:3000${renderedPdf.url}`}
                  className="w-full h-full"
                  title={selectedDocument.name}
                />
              </div>

              {/* OCR Text */}
              {renderedPdf.ocrText && (
                <div>
                  <h4 className="font-medium mb-2">OCR Text Preview</h4>
                  <div className="bg-dark-bg rounded-lg p-4 max-h-[200px] overflow-y-auto text-sm text-text-muted whitespace-pre-wrap">
                    {renderedPdf.ocrText.slice(0, 2000)}
                    {renderedPdf.ocrText.length > 2000 && '...'}
                  </div>
                  <div className="text-xs text-text-muted mt-2">
                    {renderedPdf.ocrText.length} characters extracted
                  </div>
                </div>
              )}
            </div>
          ) : selectedDocument ? (
            <div className="text-center py-12 text-text-muted">
              <LoadingSpinner />
              <p className="mt-4">Loading document...</p>
            </div>
          ) : (
            <div className="text-center py-12 text-text-muted">
              <div className="text-4xl mb-4">📝</div>
              <p>Select a document from the tree to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Not Configured State */}
      {!cloudStatus?.configured && (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="text-xl font-semibold mb-2">Remarkable Cloud Not Configured</h3>
          <p className="text-text-muted mb-4">
            Set up your Remarkable device token to sync documents.
          </p>
          <div className="text-left max-w-md mx-auto bg-dark-bg rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-text-muted">
              <li>Go to <code className="text-accent">my.remarkable.com</code></li>
              <li>Navigate to Connect → Mobile App</li>
              <li>Copy the one-time code</li>
              <li>Set <code className="text-accent">REMARKABLE_DEVICE_TOKEN</code> in your .env</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default Remarkable;
