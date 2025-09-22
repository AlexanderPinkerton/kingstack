// Transform Helpers - Common transformation utilities

import { DataTransformer, Entity } from "./optimistic-store-pattern";

// ---------- Common Field Transformers ----------

export class FieldTransformers {
  // Date transformations
  static dateField = {
    toUi: (isoString: string): Date => new Date(isoString),
    toApi: (date: Date): string => date.toISOString(),
  };

  static nullableDateField = {
    toUi: (isoString: string | null): Date | null => 
      isoString ? new Date(isoString) : null,
    toApi: (date: Date | null): string | null => 
      date ? date.toISOString() : null,
  };

  // Number transformations
  static stringToNumber = {
    toUi: (str: string): number => parseFloat(str),
    toApi: (num: number): string => num.toString(),
  };

  // Boolean transformations
  static stringToBoolean = {
    toUi: (str: "true" | "false"): boolean => str === "true",
    toApi: (bool: boolean): "true" | "false" => bool ? "true" : "false",
  };

  // Array transformations
  static csvToArray = {
    toUi: (csv: string): string[] => csv ? csv.split(',').map(s => s.trim()) : [],
    toApi: (arr: string[]): string => arr.join(','),
  };

  // JSON transformations
  static jsonField = <T>() => ({
    toUi: (jsonString: string): T => JSON.parse(jsonString),
    toApi: (obj: T): string => JSON.stringify(obj),
  });
}

// ---------- Builder Pattern for Easy Transformers ----------

export class TransformerBuilder<TApi extends Entity, TUi extends Entity> {
  private transformations: {
    [K in keyof TApi]?: {
      toUi: (apiValue: TApi[K]) => any;
      toApi: (uiValue: any) => TApi[K];
    };
  } = {};

  // Add a field transformation
  transformField<K extends keyof TApi>(
    fieldName: K,
    transformer: {
      toUi: (apiValue: TApi[K]) => any;
      toApi: (uiValue: any) => TApi[K];
    }
  ): this {
    this.transformations[fieldName] = transformer;
    return this;
  }

  // Convenience methods for common transformations
  dateField<K extends keyof TApi>(fieldName: K): this {
    return this.transformField(fieldName, FieldTransformers.dateField as any);
  }

  nullableDateField<K extends keyof TApi>(fieldName: K): this {
    return this.transformField(fieldName, FieldTransformers.nullableDateField as any);
  }

  stringToNumber<K extends keyof TApi>(fieldName: K): this {
    return this.transformField(fieldName, FieldTransformers.stringToNumber as any);
  }

  csvToArray<K extends keyof TApi>(fieldName: K): this {
    return this.transformField(fieldName, FieldTransformers.csvToArray as any);
  }

  jsonField<K extends keyof TApi, T>(fieldName: K): this {
    return this.transformField(fieldName, FieldTransformers.jsonField<T>() as any);
  }

  // Build the final transformer
  build(): DataTransformer<TApi, TUi> {
    const transformations = this.transformations;

    return {
      toUi: (apiData: TApi): TUi => {
        const result = { ...apiData } as any;

        for (const [fieldName, transformer] of Object.entries(transformations)) {
          if (transformer && apiData[fieldName as keyof TApi] !== undefined) {
            result[fieldName] = transformer.toUi(apiData[fieldName as keyof TApi]);
          }
        }

        return result as TUi;
      },

      toApi: (uiData: TUi): TApi => {
        const result = { ...uiData } as any;

        for (const [fieldName, transformer] of Object.entries(transformations)) {
          if (transformer && uiData[fieldName as keyof TUi] !== undefined) {
            result[fieldName] = transformer.toApi(uiData[fieldName as keyof TUi]);
          }
        }

        return result as TApi;
      },

      toApiUpdate: (uiData: Partial<TUi>): Partial<TApi> => {
        const result: any = {};

        for (const [fieldName, value] of Object.entries(uiData)) {
          const transformer = transformations[fieldName as keyof TApi];
          if (transformer && value !== undefined) {
            result[fieldName] = transformer.toApi(value);
          } else if (value !== undefined) {
            result[fieldName] = value;
          }
        }

        return result as Partial<TApi>;
      },
    };
  }
}

// ---------- Factory Functions ----------

export function createTransformer<TApi extends Entity, TUi extends Entity>(): TransformerBuilder<TApi, TUi> {
  return new TransformerBuilder<TApi, TUi>();
}

// Identity transformer (no transformation)
export function identityTransformer<T extends Entity>(): DataTransformer<T, T> {
  return {
    toUi: (data: T) => data,
    toApi: (data: T) => data,
    toApiUpdate: (data: Partial<T>) => data,
  };
}

// ---------- Usage Examples ----------

/*
// Simple date transformation
const postTransformer = createTransformer<PostApiData, PostUiData>()
  .dateField('createdAt')
  .dateField('updatedAt')
  .nullableDateField('publishedAt')
  .csvToArray('tags')
  .build();

// Complex transformation with custom logic
const userTransformer = createTransformer<UserApiData, UserUiData>()
  .dateField('createdAt')
  .dateField('lastLoginAt')
  .stringToNumber('age')
  .transformField('preferences', {
    toUi: (jsonString: string) => JSON.parse(jsonString) as UserPreferences,
    toApi: (prefs: UserPreferences) => JSON.stringify(prefs),
  })
  .transformField('fullName', {
    toUi: (apiName: string) => {
      const [first, ...rest] = apiName.split(' ');
      return { firstName: first, lastName: rest.join(' ') };
    },
    toApi: (nameObj: { firstName: string; lastName: string }) => 
      `${nameObj.firstName} ${nameObj.lastName}`,
  })
  .build();

// Use with controller
const useUsersController = createEntityController({
  queryKey: ['users'],
  api: userAPI,
  store: userStore,
  transformer: userTransformer,
});
*/

// ---------- Advanced Transformers ----------

// For nested object transformations
export class NestedTransformerBuilder<TApi extends Entity, TUi extends Entity> 
  extends TransformerBuilder<TApi, TUi> {
  
  // Transform nested objects
  nestedObject<K extends keyof TApi, TNestedApi, TNestedUi>(
    fieldName: K,
    nestedTransformer: DataTransformer<TNestedApi, TNestedUi>
  ): this {
    return this.transformField(fieldName, {
      toUi: (apiValue: any) => nestedTransformer.toUi(apiValue),
      toApi: (uiValue: any) => nestedTransformer.toApi(uiValue),
    });
  }

  // Transform arrays of objects
  arrayOfObjects<K extends keyof TApi, TNestedApi extends Entity, TNestedUi extends Entity>(
    fieldName: K,
    nestedTransformer: DataTransformer<TNestedApi, TNestedUi>
  ): this {
    return this.transformField(fieldName, {
      toUi: (apiArray: TNestedApi[]) => apiArray.map(nestedTransformer.toUi),
      toApi: (uiArray: TNestedUi[]) => uiArray.map(nestedTransformer.toApi),
    });
  }
}

export function createNestedTransformer<TApi extends Entity, TUi extends Entity>(): NestedTransformerBuilder<TApi, TUi> {
  return new NestedTransformerBuilder<TApi, TUi>();
}

// ---------- Computed Properties Helper ----------

export function withComputedProperties<TBase extends Entity, TComputed>(
  baseTransformer: DataTransformer<any, TBase>,
  computeProperties: (base: TBase) => TComputed
): DataTransformer<any, TBase & TComputed> {
  return {
    toUi: (apiData: any): TBase & TComputed => {
      const base = baseTransformer.toUi(apiData);
      const computed = computeProperties(base);
      return { ...base, ...computed };
    },
    toApi: (uiData: TBase & TComputed): any => {
      // Strip computed properties before sending to API
      const { ...baseData } = uiData;
      // Remove computed properties (this is a simplified version)
      return baseTransformer.toApi(baseData as TBase);
    },
    toApiUpdate: (uiData: Partial<TBase & TComputed>): any => {
      return baseTransformer.toApiUpdate(uiData as Partial<TBase>);
    },
  };
}
