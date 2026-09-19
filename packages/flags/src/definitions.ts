export const FlagKinds = {
  Boolean: "boolean",
  Variant: "variant",
} as const;

const MAX_FLAG_KEY_LENGTH = 200;

export interface BooleanFlag {
  readonly kind: typeof FlagKinds.Boolean;
  readonly key: string;
  readonly description: string;
  readonly defaultValue: boolean;
  readonly clientVisible: boolean;
}

export interface VariantFlag<T extends string = string> {
  readonly kind: typeof FlagKinds.Variant;
  readonly key: string;
  readonly description: string;
  readonly defaultValue: T;
  readonly variants: readonly T[];
  readonly clientVisible: boolean;
}

export type FlagDefinition = BooleanFlag | VariantFlag;
export type FlagValue<F extends FlagDefinition> = F["defaultValue"];
export type FlagCatalog = Readonly<Record<string, FlagDefinition>>;

interface DefinitionOptions {
  key: string;
  description: string;
  clientVisible?: boolean;
}

export function booleanFlag(
  options: DefinitionOptions & { defaultValue: boolean },
): BooleanFlag {
  const flag = {
    ...options,
    kind: FlagKinds.Boolean,
    clientVisible: options.clientVisible ?? false,
  };
  validateDefinition(flag);
  return Object.freeze(flag);
}

export function variantFlag<const V extends readonly [string, ...string[]]>(
  options: DefinitionOptions & {
    variants: V;
    defaultValue: NoInfer<V[number]>;
  },
): VariantFlag<V[number]> {
  const flag = {
    ...options,
    kind: FlagKinds.Variant,
    clientVisible: options.clientVisible ?? false,
    variants: Object.freeze([...options.variants]),
  };
  validateDefinition(flag);
  return Object.freeze(flag);
}

export function defineFlags<const C extends FlagCatalog>(
  catalog: C,
): Readonly<C> {
  const keys = new Set<string>();
  for (const flag of Object.values(catalog)) {
    validateDefinition(flag);
    if (keys.has(flag.key)) throw new Error(`Duplicate flag key: ${flag.key}`);
    keys.add(flag.key);
  }
  return Object.freeze({ ...catalog });
}

export function isFlagValue<F extends FlagDefinition>(
  flag: F,
  value: unknown,
): value is FlagValue<F> {
  if (flag.kind === FlagKinds.Boolean) {
    return typeof value === "boolean";
  }
  return typeof value === "string" && flag.variants.includes(value);
}

function validateDefinition(flag: FlagDefinition): void {
  const key = flag.key;
  if (
    typeof flag.key !== "string" ||
    !flag.key.trim() ||
    flag.key.length > MAX_FLAG_KEY_LENGTH
  ) {
    throw new Error(
      `Flag keys must contain 1–${MAX_FLAG_KEY_LENGTH} characters`,
    );
  }
  if (typeof flag.description !== "string" || !flag.description.trim()) {
    throw new Error(`Missing flag description: ${flag.key}`);
  }
  if (typeof flag.clientVisible !== "boolean")
    throw new Error(`Invalid visibility: ${flag.key}`);
  if (
    flag.kind === FlagKinds.Variant &&
    (!Array.isArray(flag.variants) ||
      flag.variants.length === 0 ||
      flag.variants.some(
        (value) => typeof value !== "string" || !value.trim(),
      ) ||
      new Set(flag.variants).size !== flag.variants.length)
  )
    throw new Error(`Invalid variants: ${flag.key}`);
  if (
    (flag.kind !== FlagKinds.Boolean && flag.kind !== FlagKinds.Variant) ||
    !isFlagValue(flag, flag.defaultValue)
  ) {
    throw new Error(`Invalid default: ${key}`);
  }
}
