export function parsePagination(query = {}, { allowedSorts = ['id'], defaultSort = 'id' } = {}) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const rawLimit = Number.parseInt(query.limit ?? '20', 10) || 20;
  const limit = Math.min(Math.max(1, rawLimit), 100);
  const offset = (page - 1) * limit;

  const rawSort = typeof query.sort === 'string' && query.sort.trim() ? query.sort.trim() : defaultSort;
  const desc = rawSort.startsWith('-');
  const sortField = desc ? rawSort.slice(1) : rawSort;
  const safeSortField = allowedSorts.includes(sortField) ? sortField : defaultSort.replace(/^-/, '');
  const direction = desc ? 'DESC' : 'ASC';

  return {
    page,
    limit,
    offset,
    sortColumn: safeSortField,
    sortDirection: direction
  };
}
