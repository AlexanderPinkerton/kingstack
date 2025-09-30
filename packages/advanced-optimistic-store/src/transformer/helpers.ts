// Helper functions for data transformation

import type { Entity, DataTransformer } from "../core/types";
import { createDefaultTransformer } from "./defaultTransformer";

/**
 * Creates the appropriate transformer based on config
 */
export function createTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
>(
  transformer: DataTransformer<TApiData, TUiData> | false | undefined,
): DataTransformer<TApiData, TUiData> | undefined {
  if (transformer === false) {
    // No transformation needed - data is already in UI shape
    return undefined;
  } else if (transformer) {
    // Custom transformer provided
    return transformer;
  } else {
    // No transformer specified - use default transformer
    return createDefaultTransformer<TApiData, TUiData>();
  }
}
