// Standard Schema V1 — vendored, as the spec asks, so verax stays dependency-free:
// a structurally compatible subset of @standard-schema/spec 1.1.0 (StandardSchemaV1
// only), not a verbatim copy. https://standardschema.dev

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly types?: Types<Input, Output> | undefined;
    readonly validate: (
      value: unknown,
      options?: Options,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly vendor: string;
    readonly version: 1;
  }
  export interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  export type Result<Output> = FailureResult | SuccessResult<Output>;
  export interface SuccessResult<Output> {
    readonly issues?: undefined;
    readonly value: Output;
  }
  export interface FailureResult {
    readonly issues: readonly Issue[];
  }
  export interface Issue {
    readonly message: string;
    readonly path?: readonly (PathSegment | PropertyKey)[] | undefined;
  }
  export interface PathSegment {
    readonly key: PropertyKey;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  export type InferInput<TSchema extends StandardSchemaV1> = NonNullable<
    TSchema['~standard']['types']
  >['input'];
  export type InferOutput<TSchema extends StandardSchemaV1> = NonNullable<
    TSchema['~standard']['types']
  >['output'];
}
