const PAGE_TIMEOUT_MS = 15_000;

interface GraphQLPage<T> {
  data?: Record<string, T[] | undefined>;
  errors?: Array<{ message: string }>;
}

interface PaginateOptions {
  url: string;
  /** Root collection field, e.g. `activities`. */
  collection: string;
  /** GraphQL type of the entity id: `Bytes` or `String`, as the subgraph schema declares it. */
  idType: 'Bytes' | 'String';
  /** Fields to select; must include `id`. */
  selection: string;
  /** Extra filter body, e.g. `active: true`. */
  where?: string;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 1000;

function pageQuery({ collection, idType, selection, where }: PaginateOptions, cursored: boolean) {
  const filter = [where, cursored ? 'id_gt: $lastId' : null].filter(Boolean).join(', ');
  const variables = cursored ? `$first: Int!, $lastId: ${idType}!` : '$first: Int!';
  return `query Page(${variables}) { ${collection}(first: $first, orderBy: id, orderDirection: asc${
    filter ? `, where: { ${filter} }` : ''
  }) { ${selection} } }`;
}

/**
 * Reads a whole collection by id cursor. `skip` is not used: the indexer caps it at 5000 and
 * slows down as it grows. Order is by id, so sort afterwards if order matters.
 * Rejects on any failed page rather than returning a partial list.
 */
export async function paginate<T extends { id: string }>(options: PaginateOptions): Promise<T[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const rows: T[] = [];
  let lastId: string | null = null;

  while (true) {
    const response: Response = await fetch(options.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: pageQuery(options, lastId !== null),
        variables: lastId === null ? { first: pageSize } : { first: pageSize, lastId },
      }),
      // A stalled indexer must end in an error the screen can show, not an endless spinner.
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Subgraph request failed: ${response.status}`);

    const body = (await response.json()) as GraphQLPage<T>;
    if (body.errors?.length) throw new Error(`Subgraph query error: ${body.errors[0]?.message}`);

    const page = body.data?.[options.collection] ?? [];
    rows.push(...page);
    const last = page[page.length - 1];
    if (page.length < pageSize || !last) return rows;
    lastId = last.id;
  }
}
