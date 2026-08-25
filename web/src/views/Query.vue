<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getProjects, errMessage } from '@/api';
import type { Project } from '@/api/types';
import { AppSpinner, AppAlert } from '@/components/ui';

const router = useRouter();

const projects = ref<Project[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// Newest projects first
const sortedProjects = computed(() => [...projects.value].sort((a, b) => b.id - a.id));

async function refreshProjects() {
  loading.value = true;
  error.value = null;
  try {
    projects.value = await getProjects();
  } catch (err) {
    error.value = errMessage(err, 'Failed to load projects.');
  } finally {
    loading.value = false;
  }
}

function openProject(id: number) {
  router.push(`/query/${id}`);
}

function formatDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString();
}

onMounted(refreshProjects);
</script>

<template>
  <div class="query">
    <header class="query__header container">
      <div class="page-head">
        <button class="page-back" aria-label="Back to home" @click="router.push('/')">←</button>
        <h1 class="serif-headline query__title">Query</h1>
      </div>
      <hr class="rule-thick" />
    </header>

    <div class="query__body container">
      <div class="query__list-head">
        <span class="label">Projects</span>
      </div>

      <AppAlert v-if="error" variant="error" class="query__error">{{ error }}</AppAlert>

      <div v-if="loading" class="query__loading">
        <AppSpinner label="Loading projects…" />
      </div>

      <ul v-else class="query-cards">
        <li v-for="(p, i) in sortedProjects" :key="p.id">
          <button class="query-card" @click="openProject(p.id)">
            <span class="label query-card__index">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="serif-headline query-card__title">{{ p.name }}</span>
            <span class="query-card__desc">{{ p.description || 'No description' }}</span>
            <span class="query-card__meta meta">
              {{ p.activeVersion ? `version${p.activeVersion}` : 'no data' }} ·
              {{ formatDate(p.created_at) }}
            </span>
            <span class="query-card__cta">Open <span class="arrow" aria-hidden="true">→</span></span>
          </button>
        </li>
      </ul>

      <p v-if="!loading && sortedProjects.length === 0" class="meta query__empty">
        No projects yet. Create one in Data Management.
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.query {
  &__header {
    padding-top: 2.5rem;
    padding-bottom: 1.5rem;
  }

  &__title {
    font-size: var(--text-5xl);
  }

  &__body {
    padding-bottom: 4rem;
  }

  &__error {
    margin-top: 1rem;
  }

  &__loading {
    padding: 2rem 0;
  }

  &__empty {
    padding: 1.5rem 0;
  }
}

.query__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: var(--border-thin);
}

.query-cards {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 2rem;
  padding-top: 1rem;
}

.query-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  background: var(--color-card);
  border: var(--border-thin);
  padding: 1.5rem;
  cursor: pointer;
  color: var(--color-card-foreground);
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease;

  &__index {
    color: var(--color-muted-foreground);
    transition: color 0.25s ease;
  }

  &__title {
    font-size: var(--text-3xl);
  }

  &__desc {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 3.25em;
    font-size: var(--text-base);
    line-height: 1.625;
    opacity: 0.85;
  }

  &__meta {
    font-style: italic;
  }

  &__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
  }

  .arrow {
    display: inline-block;
    transition: transform 0.25s ease;
  }

  &:hover,
  &:focus-visible {
    background: var(--color-foreground);
    color: var(--color-accent-foreground);
    border-color: var(--color-foreground);
    transform: translateY(-3px);

    .query-card__index {
      color: var(--color-background);
      opacity: 0.7;
    }

    .arrow {
      transform: translateX(6px);
    }
  }

  &:focus-visible {
    outline: var(--focus-outline);
    outline-offset: 3px;
  }
}
</style>
