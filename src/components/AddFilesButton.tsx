import React, { useRef } from 'react';
import { PlusIcon } from 'lucide-react';
import { MultiFileImportHook } from '../types';

interface AddFilesButtonProps {
  /** Multi-file import hook instance */
  multiFileImport: MultiFileImportHook;
  /** Called when files are successfully added */
  onFilesAdded?: (files: File[]) => void;
  /** Whether the button should be disabled */
  disabled?: boolean;
  /** Button variant style */
  variant?: 'primary' | 'secondary' | 'subtle';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show as icon only */
  iconOnly?: boolean;
}

export const AddFilesButton: React.FC<AddFilesButtonProps> = ({
  multiFileImport,
  onFilesAdded,
  disabled = false,
  variant = 'secondary',
  size = 'md',
  iconOnly = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      // Add files to existing import (append instead of replace)
      const result = await multiFileImport.addFiles(files);
      
      // Clear the input so the same files can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Log results for debugging
      if (result.success) {
        console.log(`Successfully added ${result.addedFiles.length} files with ${result.addedPages.length} pages`);
      }
      
      if (Object.keys(result.errors).length > 0) {
        console.warn('Some files had errors:', result.errors);
      }
      
      // Notify parent component
      onFilesAdded?.(files);
    } catch (error) {
      console.error('Error adding files:', error);
    }
  };

  // Style variants
  const baseClasses = "inline-flex items-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300",
    subtle: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"
  };

  const sizeClasses = {
    sm: iconOnly ? "p-1" : "px-2 py-1 text-xs",
    md: iconOnly ? "p-2" : "px-3 py-2 text-sm", 
    lg: iconOnly ? "p-3" : "px-4 py-2 text-base"
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18
  };

  return (
    <>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
        disabled={disabled}
      />
      
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${iconOnly ? 'rounded-full' : 'rounded-md'}`}
        title="Add more PDF or image files"
        aria-label="Add more files"
      >
        <PlusIcon size={iconSizes[size]} className={iconOnly ? '' : 'mr-1'} />
        {!iconOnly && 'Add Files'}
      </button>
    </>
  );
};