// Standard Schema V1 — vendored, as the spec asks, so verax stays dependency-free:
// a structurally compatible subset of @standard-schema/spec 1.1.0 (StandardSchemaV1
// only), not a verbatim copy. https://standardschema.dev

export type StandardSchemaV1<Input = unknown, Output = Input> = Readonly<{
  '~standard': StandardSchemaV1.Props<Input, Output>;
}>;

export declare namespace StandardSchemaV1 {
  export type Props<Input = unknown, Output = Input> = Readonly<{
    types?: Types<Input, Output> | undefined;
    validate: (value: unknown, options?: Options) => Result<Output> | Promise<Result<Output>>;
    vendor: string;
    version: 1;
  }>;
  export type Options = Readonly<{
    libraryOptions?: Record<string, unknown> | undefined;
  }>;
  export type Result<Output> = FailureResult | SuccessResult<Output>;
  export type SuccessResult<Output> = Readonly<{
    issues?: undefined;
    value: Output;
  }>;
  export type FailureResult = Readonly<{
    issues: readonly Issue[];
  }>;
  export type Issue = Readonly<{
    message: string;
    path?: readonly (PathSegment | PropertyKey)[] | undefined;
  }>;
  export type PathSegment = Readonly<{
    key: PropertyKey;
  }>;
  export type Types<Input = unknown, Output = Input> = Readonly<{
    input: Input;
    output: Output;
  }>;
  export type InferInput<TSchema extends StandardSchemaV1> = NonNullable<
    TSchema['~standard']['types']
  >['input'];
  export type InferOutput<TSchema extends StandardSchemaV1> = NonNullable<
    TSchema['~standard']['types']
  >['output'];
}
