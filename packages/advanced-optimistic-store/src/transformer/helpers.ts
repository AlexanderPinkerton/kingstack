// Helper functions for data transformation

import type { Entity, DataTransformer } from "../core/types.js";

/**
 * Normalizes the optional transformer configuration.
 *
 * No transformer means API and UI data have the same runtime shape.
 */
export function createTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
>(
  transformer: DataTransformer<TApiData, TUiData> | false | undefined,
): DataTransformer<TApiData, TUiData> | undefined {
  if (transformer) {
    return transformer;
  }

  return undefined;
}
