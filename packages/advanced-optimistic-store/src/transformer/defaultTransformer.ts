// Default transformer for common data type conversions

import type { Entity } from "../core/types";
import type { DataTransformer } from "../core/types";

// Default transformer for common data type conversions
export function createDefaultTransformer<
  TApiData extends Entity,
  TUiData extends Entity,
>(): DataTransformer<TApiData, TUiData> {
  return {
    toUi(apiData: TApiData): TUiData {
      const baseTransform = {
        // Convert common API patterns to UI patterns
        id: (apiData as any).id || (apiData as any)._id || (apiData as any).ID,
        // Apply smart type conversions while keeping original field names
        ...Object.keys(apiData).reduce((acc, key) => {
          const value = (apiData as any)[key];

          // Smart type conversions
          if (typeof value === "string") {
            // Convert ISO date strings to Date objects
            if (
              (key.includes("date") ||
                key.includes("time") ||
                key.includes("at") ||
                ((key.includes("created") || key.includes("updated")) &&
                  key.includes("_"))) &&
              !key.includes("negative") &&
              !key.includes("count") &&
              !key.includes("priority")
            ) {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                acc[key] = date;
                return acc;
              }
            }

            // Convert boolean strings to boolean values
            if (value === "true" || value === "false") {
              acc[key] = value === "true";
              return acc;
            }

            // Convert number strings to numbers (but preserve ID fields as strings)
            if (
              !isNaN(Number(value)) &&
              value !== "" &&
              key !== "id" &&
              key !== "_id" &&
              key !== "ID"
            ) {
              acc[key] = Number(value);
              return acc;
            }

            // Handle special number values
            if (value === "Infinity") {
              acc[key] = Infinity;
              return acc;
            }
            if (value === "-Infinity") {
              acc[key] = -Infinity;
              return acc;
            }
            if (value === "NaN") {
              acc[key] = NaN;
              return acc;
            }

            // Convert CSV strings to arrays
            if (value.includes(",") && !value.includes(" ")) {
              acc[key] = value.split(",").map((item) => item.trim());
              return acc;
            }
          }

          // Default: keep the original key and value
          acc[key] = value;
          return acc;
        }, {} as any),
      };
      return baseTransform as TUiData;
    },

    toApi(uiData: TUiData): TApiData {
      // Handle reverse conversions while keeping original field names
      const apiData = Object.keys(uiData).reduce((acc, key) => {
        const value = (uiData as any)[key];

        // Reverse conversions for API
        if (value instanceof Date) {
          // Convert Date objects back to ISO strings
          acc[key] = value.toISOString();
        } else if (Array.isArray(value)) {
          // Convert arrays back to CSV strings
          acc[key] = value.join(",");
        } else if (typeof value === "boolean") {
          // Convert booleans back to strings
          acc[key] = value.toString();
        } else if (typeof value === "number") {
          // Keep numbers as numbers (or convert to string if API expects strings)
          acc[key] = value;
        } else {
          // Default: keep the value as is
          acc[key] = value;
        }

        return acc;
      }, {} as any);
      return apiData as TApiData;
    },
  };
}
