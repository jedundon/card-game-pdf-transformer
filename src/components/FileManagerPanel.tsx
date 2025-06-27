import React, { useState } from 'react';
import { FileIcon, ImageIcon, XIcon, ClockIcon, FolderIcon } from 'lucide-react';
import { formatFileSize, formatImportTimestamp } from '../utils/localStorageUtils';

interface FileManagerPanelProps {
  /** Multi-file import hook instance */
  multiFileImport: any;
  /** Whether the panel is expanded */
  expanded?: boolean;
  /** Called when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Whether to show compact view */
  compact?: boolean;
}

export const FileManagerPanel: React.FC<FileManagerPanelProps> = ({
  multiFileImport,
  expanded = false,
  onExpandedChange,
  compact = false
}) => {
  const [localExpanded, setLocalExpanded] = useState(expanded);
  
  const isExpanded = onExpandedChange ? expanded : localExpanded;
  const setExpanded = onExpandedChange || setLocalExpanded;

  const files = multiFileImport.getFileList();
  
  if (files.length === 0) {
    return null;
  }

  const handleRemoveFile = (fileName: string) => {
    if (confirm(`Remove "${fileName}" and all its pages from the project?`)) {
      multiFileImport.removeFile(fileName);
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return <FileIcon size={16} className="text-red-500" />;
      case 'image':
        return <ImageIcon size={16} className="text-green-500" />;
      default:
        return <FileIcon size={16} className="text-gray-500" />;
    }
  };

  const getFileTypeLabel = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return 'PDF';
      case 'image':
        return 'Image';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg ${compact ? 'bg-gray-50' : 'bg-white'}`}>
      {/* Header */}
      <div 
        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 ${isExpanded ? 'border-b border-gray-200' : ''}`}
        onClick={() => setExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <FolderIcon size={16} className="text-gray-600 mr-2" />
          <h3 className="text-sm font-medium text-gray-800">
            Imported Files ({files.length})
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {multiFileImport.multiFileState.pages.length} pages total
          </span>
          <button
            className="text-gray-400 hover:text-gray-600 transition-transform"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* File List */}
      {isExpanded && (
        <div className="p-3 space-y-2">
          {files.map((file: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
              <div className="flex items-center flex-1 min-w-0">
                <div className="flex-shrink-0 mr-2">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      file.type === 'pdf' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {getFileTypeLabel(file.type)}
                    </span>
                  </div>
                  <div className="flex items-center mt-1 text-xs text-gray-500 space-x-3">
                    <span>{file.originalPageCount} {file.originalPageCount === 1 ? 'page' : 'pages'}</span>
                    <span>{formatFileSize(file.size)}</span>
                    <span className="flex items-center">
                      <ClockIcon size={10} className="mr-1" />
                      {formatImportTimestamp(file.importTimestamp)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-1 ml-2">
                {/* Future: Add rotate/replace buttons here */}
                <button
                  onClick={() => handleRemoveFile(file.name)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Remove file"
                >
                  <XIcon size={14} />
                </button>
              </div>
            </div>
          ))}
          
          {/* Summary */}
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Total Files: {files.length}</span>
              <span>Total Pages: {multiFileImport.multiFileState.pages.length}</span>
              <span>
                Total Size: {formatFileSize(
                  files.reduce((total: number, file: any) => total + (file.size || 0), 0)
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};