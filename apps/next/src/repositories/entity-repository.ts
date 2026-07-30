export interface EntityRepository<
  TEntity extends { id: string },
  TCreateInput,
  TUpdateInput,
  TContext,
> {
  list(context: TContext): Promise<TEntity[]>;
  create(data: TCreateInput, context: TContext): Promise<TEntity>;
  update(
    params: { id: string; data: TUpdateInput },
    context: TContext,
  ): Promise<TEntity>;
  remove(id: string, context: TContext): Promise<{ id: string } | void>;
}
