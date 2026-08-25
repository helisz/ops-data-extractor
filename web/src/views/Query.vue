<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getProjects, errMessage } from '@/api';
import type { Project } from '@/api/types';
import { AppButton, AppSpinner, AppAlert } from '@/components/ui';
import DataTable from '@/components/DataTable.vue';
import ChatPanel from '@/components/ChatPanel.vue';

type Mode = 'browse' | 'ask';

const projects = ref<Project[]>([]);
const selectedId = ref<number | null>(null);
const selectedProject = ref<Project | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const mode = ref<Mode>('browse');

const sortedProjects = computed(() => [...projects.value].sort((a, b) => b.id - a.id));
const activeProject = computed(
  () => selectedProject.value ?? projects.value.find((p) => p.id === selectedId.value) ?? null,
);

async function refreshProjects() {
  loading.value = true;
  error.value = null;
  try {
    projects.value = await getProjects();
    if (selectedId.value == null && projects.value.length > 0) {
      selectedId.value = projects.value[0].id;
      selectedProject.value = projects.value[0];
    } else if (selectedId.value != null) {
      selectedProject.value =
        projects.value.find((p) => p.id === selectedId.value) ?? null;
    }
  } catch (err) {
    error.value = errMessage(err, 'Failed to load projects.');
  } finally {
    loading.value = false;
  }
}

function selectProject(id: number) {
  selectedId.value = id;
  selectedProject.value = projects.value.find((p) => p.id === id) ?? null;
}

onMounted(refreshProjects);
</script>

<template>
  <div class="query">
    <header class="query__header container">
      <p class="label query__kicker">Data Query</p>
      <h1 class="serif-headline query__title">Query</h1>
      <hr class="rule-thick" />
    </header>

    <div class="query__layout container">
      <aside class="query__list">
        <span class="label">Projects</span>
        <AppAlert v-if="error" variant="error" class="query__error">{{ error }}</AppAlert>
        <div v-if="loading" class="query__loading">
          <AppSpinner label="Loading projects…" />
        </div>
        <ul v-else class="query__project-list">
          <li v-for="p in sortedProjects" :key="p.id">
            <button
              class="query__project-item"
              :class="{ 'query__project-item--active': selectedId === p.id }"
              @click="selectProject(p.id)"
            >
              <span class="serif-headline">{{ p.name }}</span>
              <span class="meta">
                {{ p.activeVersion ? `v${p.activeVersion}` : 'no data' }}
              </span>
            </button>
          </li>
        </ul>
        <p v-if="!loading && sortedProjects.length === 0" class="meta query__empty">
          No projects yet. Create one in Data Management.
        </p>
      </aside>

      <section class="query__panel">
        <div v-if="!activeProject" class="query__placeholder">
          <p class="serif-headline">Select a project</p>
          <p class="meta">Choose a project from the list to browse or ask about its data.</p>
        </div>

        <template v-else>
          <div class="query__panel-head">
            <div>
              <h2 class="serif-headline query__panel-title">{{ activeProject.name }}</h2>
              <p class="meta query__panel-meta">
                {{ activeProject.activeVersion ? `Active version v${activeProject.activeVersion}` : 'No data uploaded yet' }}
              </p>
            </div>
            <div class="query__mode-switch" role="tablist" aria-label="Query mode">
              <AppButton
                variant="ghost"
                class="query__mode-btn"
                :class="{ 'query__mode-btn--active': mode === 'browse' }"
                @click="mode = 'browse'"
              >
                Browse
              </AppButton>
              <AppButton
                variant="ghost"
                class="query__mode-btn"
                :class="{ 'query__mode-btn--active': mode === 'ask' }"
                @click="mode = 'ask'"
              >
                Ask
              </AppButton>
            </div>
          </div>

          <div v-if="mode === 'browse'" class="query__browse">
            <DataTable :project-id="activeProject.id" />
          </div>

          <div v-else class="query__ask">
            <ChatPanel :project-id="activeProject.id" :project-name="activeProject.name" />
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.query {
  &__header {
    padding-top: 2.5rem;
    padding-bottom: 1.5rem;
  }

  &__kicker {
    color: var(--color-muted-foreground);
    margin-bottom: 0.75rem;
  }

  &__title {
    font-size: var(--text-5xl);
    margin-bottom: 1.25rem;
  }

  &__layout {
    display: grid;
    grid-template-columns: 20rem 1fr;
    gap: 2.5rem;
    padding-bottom: 4rem;
    align-items: start;
  }

  &__error {
    margin-top: 0.75rem;
  }

  &__loading {
    padding: 1.5rem 0;
  }

  &__empty {
    padding: 1.5rem 0;
  }

  &__placeholder {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 3rem 0;

    p.serif-headline {
      font-size: var(--text-2xl);
    }
  }
}

.query__list {
  border-right: var(--border-thin);
  padding-right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  > .label {
    padding-bottom: 0.75rem;
    border-bottom: var(--border-thin);
  }
}

.query__project-list {
  list-style: none;
  display: flex;
  flex-direction: column;

  li {
    border-bottom: var(--border-hairline);
  }
}

.query__project-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 0.875rem 0.5rem;
  cursor: pointer;
  min-height: 44px;
  transition: background-color var(--duration-fast), color var(--duration-fast);

  .serif-headline {
    font-size: var(--text-lg);
  }

  .meta {
    font-style: italic;
  }

  &:hover {
    background: var(--color-muted);
  }

  &--active {
    background: var(--color-foreground);

    .serif-headline {
      color: var(--color-accent-foreground);
    }

    .meta {
      color: var(--color-background);
      opacity: 0.75;
    }
  }

  &:focus-visible {
    outline: var(--focus-outline);
    outline-offset: -3px;
  }
}

.query__panel {
  min-width: 0;
}

.query__panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.query__panel-title {
  font-size: var(--text-3xl);
  margin-bottom: 0.25rem;
}

.query__panel-meta {
  font-style: italic;
}

.query__mode-switch {
  display: inline-flex;
  border: var(--border-thin);
}

.query__mode-btn {
  border: none;
  border-radius: 0;

  & + & {
    border-left: var(--border-thin);
  }

  &--active {
    background: var(--color-foreground);
    color: var(--color-accent-foreground);
  }
}

.query__browse,
.query__ask {
  min-width: 0;
}

@media (max-width: 768px) {
  .query__layout {
    grid-template-columns: 1fr;
  }

  .query__list {
    border-right: none;
    border-bottom: var(--border-thin);
    padding-right: 0;
    padding-bottom: 1rem;
  }
}
</style>
