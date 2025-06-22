// TypeScript interfaces for the Card Game PDF Transformer application

import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// PDF-related types
export type PdfData = PDFDocumentProxy;
export type PdfPage = PDFPageProxy;

// Page settings for PDF processing
export interface PageSettings {
  skip?: boolean;
  type?: 'front' | 'back';
}

// PDF mode configuration
export interface PdfMode {
  type: 'simplex' | 'duplex' | 'gutter-fold';
  orientation?: 'vertical' | 'horizontal';
  flipEdge?: 'short' | 'long';
}

// Grid configuration for card extraction
export interface GridSettings {
  rows: number;
  columns: number;
}

// Crop settings (in pixels at 300 DPI)
export interface CropSettings {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Card-specific crop settings
export interface CardCropSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Image rotation settings
export interface ImageRotationSettings {
  front: number;
  back: number;
}

// Complete extraction settings
export interface ExtractionSettings {
  grid: GridSettings;
  crop: CropSettings;
  gutterWidth?: number;
  cardCrop?: CardCropSettings;
  imageRotation?: ImageRotationSettings;
}

// Color transformation settings
export interface ColorTransformation {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  gamma: number;
  vibrance: number;
  highlightRecovery: number;
  shadowRecovery: number;
}

// Color transformation settings per card type
export interface ColorTransformationSettings {
  front: ColorTransformation;
  back: ColorTransformation;
}

// Card size configuration
export interface CardSizeSettings {
  widthInches: number;
  heightInches: number;
}

// Page size configuration  
export interface PageSizeSettings {
  width: number;
  height: number;
}

// Card spacing configuration
export interface CardSpacingSettings {
  horizontal: number;
  vertical: number;
}

// Layout rotation settings
export interface LayoutRotationSettings {
  front: number;
  back: number;
}

// Complete output settings
export interface OutputSettings {
  pageSize: PageSizeSettings;
  cardSize: CardSizeSettings;
  cardScalePercent: number;
  bleedMarginInches: number;
  spacing: CardSpacingSettings;
  rotation: LayoutRotationSettings;
  cardSizingMode: 'actual-size' | 'fit-to-card' | 'fill-card';
  cardAlignment: 'top-left' | 'center';
  includeColorCalibration: boolean;
  printerCalibration?: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
  };
}

// Card information
export interface CardInfo {
  type: string;
  id: number;
}

// Last imported file information
export interface LastImportedFileInfo {
  fileName: string;
  size: number;
  timestamp: number;
}

// Settings for import/export
export interface AppSettings {
  pdfMode: PdfMode;
  pageSettings: PageSettings[];
  extractionSettings: ExtractionSettings;
  outputSettings: OutputSettings;
  colorTransformationSettings?: ColorTransformationSettings;
}

// Card dimensions
export interface CardDimensions {
  widthPx: number;
  heightPx: number;
  widthInches: number;
  heightInches: number;
  originalWidthPx?: number;
  originalHeightPx?: number;
  rotation?: number;
  cardType?: string;
}

// React component props types
export interface StepComponentProps {
  onPrevious: () => void;
  onNext: () => void;
}

// Error boundary props
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

// Event handler types
export type FileSelectHandler = (data: PdfData, fileName: string, file?: File) => void;
export type ModeSelectHandler = (mode: PdfMode) => void;
export type PageSettingsChangeHandler = (settings: PageSettings[]) => void;
export type ExtractionSettingsChangeHandler = (settings: ExtractionSettings) => void;
export type OutputSettingsChangeHandler = (settings: OutputSettings) => void;
export type ColorTransformationChangeHandler = (settings: ColorTransformationSettings) => void;
export type CardDimensionsChangeHandler = (dimensions: CardDimensions | null) => void;