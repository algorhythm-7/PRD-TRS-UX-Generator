import type { GenerationRequest } from "./contract";

/** Pure request validation for IFACE-VALIDATE (COMP-VALIDATE). */
export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: FieldError[];
}

export function validate(request: GenerationRequest): ValidationResult {
  const errors: FieldError[] = [];
  if (!request.productTitle || request.productTitle.trim().length === 0) {
    errors.push({ field: "productTitle", message: "Product Title is required." });
  }
  if (!request.productDetails || request.productDetails.trim().length === 0) {
    errors.push({ field: "productDetails", message: "Product Details are required." });
  }
  if (!request.selectedTypes || request.selectedTypes.length === 0) {
    errors.push({
      field: "selectedTypes",
      message: "Select at least one document type.",
    });
  }
  return { ok: errors.length === 0, errors };
}
