/**
 * UFS Promotion Generation Utilities
 * Shared logic for parsing mechanics and projecting blueprint data.
 */

export const formatNumericDisplay = (value, decimals = 0) => (
  typeof value === 'number' && !Number.isNaN(value)
    ? value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : '-'
);

export const formatDisplayDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB') : '-');

export const parseNumericToken = (value) => {
  const normalizedValue = String(value || '').replace(/,/g, '');
  const match = normalizedValue.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

export const formatMechanicReward = (value, promoType) => (
  formatNumericDisplay(value, promoType === 'DISC' ? 2 : 0)
);

export const deriveMechanicsProfile = (mechanics) => {
  const segments = String(mechanics || '')
    .split(',')
    .map(segment => segment.trim())
    .filter(Boolean);
  const [firstBuyToken = '', firstRewardToken = ''] = (segments[0] || '').split('+').map(token => token.trim());

  return {
    segments,
    promoType: firstRewardToken ? (/rm/i.test(firstRewardToken) ? 'DISC' : 'FOC') : null,
    uom: firstBuyToken ? (/pcs?/i.test(firstBuyToken) ? 'PC' : 'CS') : null
  };
};

export const parseMechanicsToSlabs = (mechanics, promoType, pcsPerCase, defaultPurchaseLimit = 9999999999999) => {
  const segments = String(mechanics || '')
    .split(',')
    .map(segment => segment.trim())
    .filter(Boolean);

  const parsedSegments = segments.map((segment) => {
    const [buyToken = '', rewardToken = ''] = segment.split('+').map(token => token.trim());
    const quantityFrom = parseNumericToken(buyToken);
    const rewardQty = parseNumericToken(rewardToken);
    const rewardHasRm = /rm/i.test(rewardToken);
    const rewardIsPc = /pcs?/i.test(rewardToken);
    const isDiscPromo = promoType === 'DISC';
    const isFocPromo = promoType === 'FOC';
    const needsCaseConversion = isFocPromo && !rewardIsPc;

    if (quantityFrom === null || rewardQty === null) {
      return { raw: segment, valid: false };
    }

    if (isDiscPromo && !rewardHasRm) {
      return { raw: segment, valid: false, missingRmToken: true };
    }

    if (isFocPromo && rewardHasRm) {
      return { raw: segment, valid: false, invalidRmToken: true };
    }

    const normalizedPcsPerCase = Number(pcsPerCase);
    if (needsCaseConversion && (isNaN(normalizedPcsPerCase) || normalizedPcsPerCase <= 0)) {
      return { raw: segment, valid: false, missingPcsPerCase: true };
    }

    const discountQty = isDiscPromo
      ? rewardQty
      : needsCaseConversion
        ? rewardQty * normalizedPcsPerCase
        : rewardQty;

    return {
      raw: segment,
      valid: true,
      quantityFrom,
      discountQty,
      discountDisplay: formatMechanicReward(discountQty, promoType)
    };
  });

  const invalidSegments = parsedSegments
    .filter(segment => !segment.valid)
    .map(segment => segment.raw);
  const requiresPcsPerCase = parsedSegments.some(segment => segment.missingPcsPerCase);
  const requiresRmToken = parsedSegments.some(segment => segment.missingRmToken);
  const containsInvalidRmToken = parsedSegments.some(segment => segment.invalidRmToken);

  const sortedSegments = parsedSegments
    .filter(segment => segment.valid)
    .sort((left, right) => left.quantityFrom - right.quantityFrom);

  const slabs = sortedSegments.map((segment, index) => {
    const nextSegment = sortedSegments[index + 1];
    const quantityTo = nextSegment && nextSegment.quantityFrom > segment.quantityFrom
      ? nextSegment.quantityFrom - 1
      : 99999;

    return {
      serialNo: index + 1,
      raw: segment.raw,
      quantityFrom: segment.quantityFrom,
      quantityTo,
      discountQty: segment.discountQty,
      discountDisplay: segment.discountDisplay,
      forEvery: segment.quantityFrom,
      purchaseLimit: defaultPurchaseLimit
    };
  });

  return {
    totalSegments: segments.length,
    invalidSegments,
    requiresPcsPerCase,
    requiresRmToken,
    containsInvalidRmToken,
    slabs
  };
};

export const compareAlphaNumeric = (leftValue, rightValue) => (
  String(leftValue || '').localeCompare(String(rightValue || ''), undefined, { numeric: true, sensitivity: 'base' })
);
