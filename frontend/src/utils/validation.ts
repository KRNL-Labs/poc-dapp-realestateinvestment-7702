export interface ValidationErrors {
  propertyAddress: string;
  cityStateZip: string;
  usdcAmount: string;
}

export const validateInputs = (
  propertyAddress: string,
  cityStateZip: string,
  usdcAmount: string,
  usdcBalance?: string,
  scenarioType?: 'A' | 'B'
): { isValid: boolean; errors: ValidationErrors } => {
  const errors: ValidationErrors = {
    propertyAddress: '',
    cityStateZip: '',
    usdcAmount: ''
  };

  let isValid = true;

  // Validate property address
  if (!propertyAddress.trim()) {
    errors.propertyAddress = 'Property address is required';
    isValid = false;
  } else if (propertyAddress.trim().length < 3) {
    errors.propertyAddress = 'Property address must be at least 3 characters';
    isValid = false;
  }

  // Validate city, state, zip
  if (!cityStateZip.trim()) {
    errors.cityStateZip = 'City and state are required';
    isValid = false;
  } else if (!cityStateZip.includes(',')) {
    errors.cityStateZip = 'Please use format: City,ST (e.g., Austin,TX)';
    isValid = false;
  }

  // Validate USDC amount (only for scenario B)
  if (scenarioType === 'B' || usdcAmount) {
    const amount = parseFloat(usdcAmount);
    if (isNaN(amount) || amount <= 0) {
      errors.usdcAmount = 'USDC amount must be a positive number';
      isValid = false;
    } else if (amount < 1000) {
      errors.usdcAmount = 'USDC amount must be at least 1000 USDC';
      isValid = false;
    } else if (amount > 10000) {
      errors.usdcAmount = 'USDC amount must be less than 10,000';
      isValid = false;
    } else if (scenarioType === 'B') {
      const balance = parseFloat(usdcBalance || '0');
      if (amount > balance) {
        errors.usdcAmount = `Insufficient USDC balance. You have ${balance} USDC`;
        isValid = false;
      }
    }
  }

  return { isValid, errors };
};