<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { getDataMeta, getData, downloadData, errMessage } from '@/api';
import type { DataMeta } from '@/api/types';
import { AppButton, AppInput, AppSelect, AppTag, AppCard, AppAlert, AppSpinner } from '@/components/ui';

const props = withDefaults(
  defineProps<{
    projectId: number;
    showDownload?: boolean;
    refreshKey?: number;
    /** CSS top value for the sticky header. Empty = measure the site topbar. */
    stickyHeaderTop?: string;
    /** Which scroller drives chunked loading. 'parent' = nearest wrapper ancestor. */
    scrollContainer?: 'window' | 'parent';
  }>(),
  {
    showDownload: true,
    refreshKey: 0,
    stickyHeaderTop: '',
    scrollContainer: 'window',
  },
);

const CHUNK_SIZE = 500;

const meta = ref<DataMeta | null>(null);
const rows = ref<Record<string, unknown>[]>([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const loadedChunk = ref(false);

const sortColumn = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');
const filters = ref<Record<string, string>>({});
const filterOpen = ref(false);
const kvOpen = ref(false);
const kvKey = ref('');
const kvValue = ref('');

let fetchSeq = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const wrapRef = ref<HTMLElement | null>(null);

const activeFilterTags = computed(() =>
  Object.entries(filters.value).map(([column, value]) => {
    const mapping = meta.value?.headers.find((h) => h.column === column);
    return { column, label: mapping?.header ?? column, value };
  }),
);

const kvOptions = computed(() =>
  (meta.value?.headers ?? []).map((h) => ({ value: h.column, label: h.header })),
);

function visibleColumns() {
  return meta.value?.headers ?? [];
}

async function loadChunk(offset: number, append: boolean) {
  if (!meta.value) return;
  const seq = fetchSeq;
  const res = await getData(props.projectId, {
    sort: sortColumn.value || undefined,
    order: sortOrder.value,
    filters: filters.value,
    offset,
    limit: CHUNK_SIZE,
  });
  if (seq !== fetchSeq) return; // stale response
  total.value = res.total;
  if (append) {
    rows.value = [...rows.value, ...res.rows];
  } else {
    rows.value = res.rows;
  }
}

/** Full (re)load honoring the chunk policy. */
async function reload() {
  if (!meta.value) return;
  fetchSeq += 1;
  error.value = null;
  rows.value = [];
  const needsChunking = meta.value.total > 100;
  loading.value = true;
  loadingMore.value = false;
  loadedChunk.value = false;
  try {
    await loadChunk(0, false);
    if (needsChunking && rows.value.length < total.value) {
      loadedChunk.value = true;
    }
  } catch (err) {
    error.value = errMessage(err, 'Failed to load data.');
  } finally {
    loading.value = false;
  }
}

/** Load the next chunk (append). */
async function loadNextChunk() {
  if (loading.value || loadingMore.value || !loadedChunk.value) return;
  loadingMore.value = true;
  try {
    await loadChunk(rows.value.length, true);
    if (rows.value.length >= total.value) {
      loadedChunk.value = false;
    }
  } catch (err) {
    error.value = errMessage(err, 'Failed to load more rows.');
  } finally {
    loadingMore.value = false;
  }
}

async function init() {
  error.value = null;
  meta.value = null;
  rows.value = [];
  total.value = 0;
  sortColumn.value = '';
  sortOrder.value = 'asc';
  filters.value = {};
  try {
    meta.value = await getDataMeta(props.projectId);
    await reload();
  } catch (err) {
    error.value = errMessage(err, 'Failed to load table metadata.');
  }
}

function toggleSort(column: string) {
  if (sortColumn.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortOrder.value = 'asc';
  }
  reload();
}

function onColumnFilter(column: string, value: string) {
  const next = { ...filters.value };
  if (value.trim() === '') {
    delete next[column];
  } else {
    next[column] = value.trim();
  }
  filters.value = next;
  scheduleFilterApply();
}

function onColumnFilterValue(column: string, v: unknown) {
  onColumnFilter(column, String(v ?? ''));
}

function scheduleFilterApply() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    reload();
  }, 300);
}

function addKvFilter() {
  const key = kvKey.value;
  const value = kvValue.value.trim();
  if (!key || !value) return;
  filters.value = { ...filters.value, [key]: value };
  kvValue.value = '';
  reload();
}

function removeFilter(column: string) {
  const next = { ...filters.value };
  delete next[column];
  filters.value = next;
  reload();
}

function clearFilters() {
  filters.value = {};
  reload();
}

function onDownload() {
  downloadData(props.projectId).catch((err) => {
    error.value = errMessage(err, 'Download failed.');
  });
}

// Auto-load more when the scroll target is near its bottom.
function onScroll() {
  const el = scrollTarget();
  if (el instanceof HTMLElement) {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      loadNextChunk();
    }
  } else {
    const doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 80) {
      loadNextChunk();
    }
  }
}

function scrollTarget(): EventTarget | Window {
  if (props.scrollContainer === 'parent') {
    return wrapRef.value?.parentElement ?? window;
  }
  return window;
}

// Keep the sticky table header just below the site topbar (or at the given offset).
function updateStickyTop() {
  let top = props.stickyHeaderTop;
  if (!top) {
    const header = document.querySelector('.site-header');
    top = header ? `${header.getBoundingClientRect().height}px` : '0px';
  }
  if (wrapRef.value) {
    wrapRef.value.style.setProperty('--sticky-table-top', top);
  }
}

watch(
  () => props.projectId,
  () => init(),
);

watch(
  () => props.refreshKey,
  () => {
    if (props.projectId) init();
  },
);

onMounted(() => {
  if (props.projectId) init();
  updateStickyTop();
  window.addEventListener('resize', updateStickyTop);
  scrollTarget().addEventListener('scroll', onScroll, { passive: true });
});

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  window.removeEventListener('resize', updateStickyTop);
  scrollTarget().removeEventListener('scroll', onScroll);
});
</script>

<template>
  <div ref="wrapRef" class="data-table-wrap">
    <div class="data-table-toolbar">
      <div class="data-table-toolbar__meta">
        <span class="label">Data</span>
        <span v-if="meta" class="meta">
          {{ meta.total }} rows · version {{ meta.activeVersion ?? '—' }}
        </span>
      </div>
      <div class="data-table-toolbar__actions">
        <AppButton variant="outline" @click="filterOpen = !filterOpen">
          {{ filterOpen ? 'Hide Filters' : 'Column Filters' }}
        </AppButton>
        <AppButton variant="outline" @click="kvOpen = !kvOpen">
          {{ kvOpen ? 'Hide Key-Value' : 'Key-Value Filter' }}
        </AppButton>
        <AppButton v-if="showDownload" variant="ghost" @click="onDownload">Download xlsx ↓</AppButton>
      </div>
    </div>

    <AppAlert v-if="error" variant="error" class="data-table-error">{{ error }}</AppAlert>

    <AppCard v-if="kvOpen" class="kv-panel">
      <p class="label kv-panel__title">Key-Value Filter</p>
      <div class="kv-panel__row">
        <AppSelect v-model="kvKey" :options="kvOptions" placeholder="Select column" />
        <AppInput v-model="kvValue" placeholder="Filter value" @keyup.enter="addKvFilter" />
        <AppButton variant="outline" @click="addKvFilter">Add</AppButton>
      </div>
    </AppCard>

    <div v-if="activeFilterTags.length" class="filter-tags">
      <AppTag
        v-for="tag in activeFilterTags"
        :key="tag.column"
        variant="muted"
        class="filter-tag"
      >
        {{ tag.label }}: {{ tag.value }}
        <button
          class="filter-tag__remove"
          :aria-label="`Remove filter ${tag.label}`"
          @click="removeFilter(tag.column)"
        >
          ×
        </button>
      </AppTag>
      <AppButton variant="ghost" @click="clearFilters">Clear all</AppButton>
    </div>

    <div v-if="filterOpen && meta && meta.headers.length" class="column-filters">
      <p class="label column-filters__title">Filter Columns</p>
      <div class="column-filters__grid">
        <AppInput
          v-for="h in meta.headers"
          :key="h.column"
          :model-value="filters[h.column] ?? ''"
          :placeholder="`Filter ${h.header}…`"
          @update:model-value="(v) => onColumnFilterValue(h.column, v)"
        />
      </div>
    </div>

    <div v-if="loading" class="data-table-loading">
      <AppSpinner label="Loading data…" />
    </div>

    <div v-else-if="meta && meta.headers.length" class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="h in visibleColumns()"
              :key="h.column"
              class="data-table-th"
              :class="{ 'data-table-th--sorted': sortColumn === h.column }"
            >
              <button
                class="data-table-sort"
                :aria-label="`Sort by ${h.header}`"
                @click="toggleSort(h.column)"
              >
                {{ h.header }}
                <span class="data-table-sort__mark" aria-hidden="true">
                  {{ sortColumn === h.column ? (sortOrder === 'asc' ? '▲' : '▼') : '' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i">
            <td v-for="h in visibleColumns()" :key="h.column" class="data-table-cell">
              <span class="ellipsis" :title="String(row[h.header] ?? '')">
                {{ row[h.header] ?? '' }}
              </span>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="visibleColumns().length" class="data-table-empty">
              <p class="data-table-empty__msg">No rows match the current filters.</p>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="loadingMore" class="data-table-loading">
        <AppSpinner :label="`Loading more rows… ${rows.length} / ${total}`" />
      </div>
      <p v-else-if="loadedChunk && rows.length < total" class="meta data-table-more">
        Showing {{ rows.length }} of {{ total }} rows — scroll to load more
      </p>
    </div>

    <div v-else-if="meta && meta.headers.length === 0 && !loading" class="data-table-empty-state">
      <p class="serif-headline">No data yet</p>
      <p class="meta">Upload an Excel file to define the structure and initialize data.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.data-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.data-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  &__meta {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
}

.data-table-error {
  margin-top: 0.5rem;
}

.kv-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  &__title {
    color: var(--color-muted-foreground);
  }

  &__row {
    display: grid;
    grid-template-columns: 12rem 1fr auto;
    gap: 0.75rem;
    align-items: end;
  }
}

.filter-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;

  &__remove {
    background: none;
    border: none;
    color: inherit;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    padding: 0 0 0 0.25rem;

    &:hover {
      opacity: 0.6;
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: 2px;
    }
  }
}

.column-filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0;

  &__title {
    color: var(--color-muted-foreground);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0.75rem;
  }
}

.table-scroll {
  border-top: var(--border-thin);
}

.data-table {
  min-width: 100%;

  th.data-table-th {
    position: sticky;
    top: var(--sticky-table-top, 4.875rem);
    z-index: 10;
    background: var(--color-background);
    border-bottom: var(--border-thin);
  }
}

.data-table-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  padding: 0.125rem 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  font-weight: 500;
  color: var(--color-muted-foreground);
  cursor: pointer;
  min-height: 32px;

  &:hover {
    color: var(--color-foreground);
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  &:focus-visible {
    outline: var(--focus-outline);
    outline-offset: 2px;
  }

  &__mark {
    font-size: 0.625rem;
  }

  &--sorted & {
    color: var(--color-foreground);
  }
}

.data-table-cell {
  max-width: 18rem;
  font-size: var(--text-sm);
}

.data-table-empty {
  text-align: center;
  padding: 3rem 1rem;

  &__msg {
    font-family: var(--font-body);
    font-style: italic;
    color: var(--color-muted-foreground);
  }
}

.data-table-loading {
  display: flex;
  justify-content: center;
  padding: 1.5rem 0;
}

.data-table-more {
  text-align: center;
  padding: 0.75rem 0 1rem;
}

.data-table-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  border-top: var(--border-hairline);
  border-bottom: var(--border-hairline);
  text-align: center;

  p.serif-headline {
    font-size: var(--text-2xl);
  }
}

@media (max-width: 640px) {
  .kv-panel__row {
    grid-template-columns: 1fr;
  }

  .data-table-toolbar__actions {
    width: 100%;
  }
}
</style>
