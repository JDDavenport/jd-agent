import { useState, useRef, useCallback } from 'react';
import {
  XMarkIcon,
  CloudArrowUpIcon,
  LinkIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: {
    url: string;
    filename: string;
    size?: number;
    mimeType?: string;
  }) => void;
}

type UploadMode = 'url' | 'file';

export function FileUploadModal({ isOpen, onClose, onFileSelect }: FileUploadModalProps) {
  const [mode, setMode] = useState<UploadMode>('url');
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, []);

  const handleFile = (file: File) => {
    // Max file size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleUrlSubmit = () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    const filename = url.split('/').pop() || 'file';
    onFileSelect({
      url: url.trim(),
      filename,
    });
    handleClose();
  };

  const handleFileSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Convert file to data URL for now
      // In production, this would upload to S3/R2 and return a URL
      const dataUrl = await fileToDataUrl(selectedFile);

      onFileSelect({
        url: dataUrl,
        filename: selectedFile.name,
        size: selectedFile.size,
        mimeType: selectedFile.type,
      });
      handleClose();
    } catch (err) {
      setError('Failed to process file');
      console.error('File processing error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setSelectedFile(null);
    setError(null);
    setIsUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add File</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setMode('url')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              mode === 'url'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LinkIcon className="w-4 h-4 inline mr-2" />
            From URL
          </button>
          <button
            onClick={() => setMode('file')}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              mode === 'file'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CloudArrowUpIcon className="w-4 h-4 inline mr-2" />
            Upload File
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/file.pdf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <DocumentIcon className="w-12 h-12 text-purple-500 mb-2" />
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Drag and drop a file here, or click to select
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Max file size: 10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={mode === 'url' ? handleUrlSubmit : handleFileSubmit}
            disabled={isUploading || (mode === 'url' && !url) || (mode === 'file' && !selectedFile)}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Add File'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
