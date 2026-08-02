'use strict';
function normalizePagination(input = {}, defaults = {}) {
  const page = Math.max(Number(input.page) || defaults.page || 1, 1);
  const limit = Math.min(
    Math.max(Number(input.limit || input.pageSize) || defaults.limit || 20, 1),
    defaults.maximum || 100
  );
  return { page, limit, offset: (page - 1) * limit };
}
function paginationMeta({ page, limit, totalItems }) {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
module.exports = { normalizePagination, paginationMeta };
