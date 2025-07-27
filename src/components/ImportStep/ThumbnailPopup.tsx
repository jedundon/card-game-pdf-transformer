import React from 'react';
import { XIcon } from 'lucide-react';

interface ThumbnailPopupProps {
  pageIndex: number | null;
  thumbnails: Record<number, string>;
  onClose: () => void;
  /** Optional page data for displaying file information */
  pageData?: {
    fileName: string;
    fileType?: 'pdf' | 'image';
    originalPageIndex?: number;
  } | null;
}

/**
 * Modal popup for displaying a full-size thumbnail preview
 * 
 * Shows an enlarged view of a page thumbnail with an overlay background
 * and close button. Handles click-outside-to-close functionality.
 */
export const ThumbnailPopup: React.FC<ThumbnailPopupProps> = ({
  pageIndex,
  thumbnails,
  onClose,
  pageData
}) => {
  if (pageIndex === null || !thumbnails[pageIndex]) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-[95vw] max-h-[95vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-800">
            Page {pageIndex + 1} Preview
            {pageData && (
              <span className="ml-2 text-gray-600 font-normal">
                ({pageData.fileName}
                {pageData.originalPageIndex !== undefined && 
                  ` - Page ${pageData.originalPageIndex + 1}`
                })
              </span>
            )}
          </h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>
        <img
          src={thumbnails[pageIndex]}
          alt={`Page ${pageIndex + 1} preview`}
          className="w-auto h-auto border border-gray-200 rounded"
          style={{
            maxWidth: 'min(600px, 90vw)',
            maxHeight: 'min(600px, 90vh)'
          }}
        />
      </div>
    </div>
  );
};