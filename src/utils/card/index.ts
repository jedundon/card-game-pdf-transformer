/**
 * @fileoverview Card utilities index
 * 
 * Re-exports all card utility functions from specialized modules.
 * This maintains the API compatibility with the original cardUtils.ts file.
 */

// Card validation functions
export {
  getActivePages,
  isCardSkipped,
  getSkippedCardsForPage
} from './cardValidation';

// Mathematical calculation functions
export {
  getEffectiveCardCount,
  calculateTotalCards,
  calculateCardDimensions,
  calculatePreviewScale,
  getDpiScaleFactor,
  calculateCardImageDimensions
} from './cardCalculations';

// Card identification and info functions
export {
  getCardInfo,
  getActualPageNumber,
  getAvailableCardIds,
  getRotationForCardType,
  countCardsByType
} from './cardIdentification';

// Image extraction functions
export {
  extractCardImage,
  extractCardImageFromCanvas
} from './cardExtraction';

// Skip and pairing management functions
export {
  toggleCardSkip,
  skipAllInRow,
  skipAllInColumn,
  clearAllSkips,
  findPairedCard,
  toggleCardSkipWithPairing,
  skipAllInRowWithPairing,
  skipAllInColumnWithPairing
} from './cardSkipping';

// Rendering and thumbnail functions
export {
  renderPageThumbnail,
  renderImageThumbnail,
  renderUniversalThumbnail
} from './cardRendering';

// Multi-file workflow functions
export {
  calculateCardNumbersForReorderedPages,
  getActivePagesWithSource,
  calculateTotalCardsForMixedContent
} from './cardMultiFile';

// Card type override functions
export {
  toggleCardTypeOverride,
  setCardTypeOverride,
  removeCardTypeOverride,
  getCardTypeOverride,
  clearAllCardTypeOverrides,
  getCardTypeOverrideStatus
} from './cardOverrides';