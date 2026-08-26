<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getProjects, createProject, deleteProject, errMessage } from '@/api';
import type { Project } from '@/api/types';
import { AppButton, AppInput, AppModal, AppAlert, AppSpinner } from '@/components/ui';

const router = useRouter();

const projects = ref<Project[]>([]);
const loadingProjects = ref(false);
const error = ref<string | null>(null);

// Create project
const createOpen = ref(false);
const createName = ref('');
const createDesc = ref('');
const creating = ref(false);

// Delete project
const deleteTarget = ref<Project | null>(null);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

// Newest projects first
const sortedProjects = computed(() => [...projects.value].sort((a, b) => b.id - a.id));

async function refreshProjects() {
  loadingProjects.value = true;
  try {
    projects.value = await getProjects();
  } catch (err) {
    error.value = errMessage(err, 'Failed to load projects.');
  } finally {
    loadingProjects.value = false;
  }
}

function openCreate() {
  createName.value = '';
  createDesc.value = '';
  createOpen.value = true;
}

async function submitCreate() {
  creating.value = true;
  error.value = null;
  try {
    const created = await createProject({
      name: createName.value,
      description: createDesc.value,
    });
    createOpen.value = false;
    // Enter the new project directly
    router.push(`/manage/${created.id}`);
  } catch (err) {
    error.value = errMessage(err, 'Failed to create project.');
  } finally {
    creating.value = false;
  }
}

function askDeleteProject(project: Project) {
  deleteTarget.value = project;
  deleteError.value = null;
}

const deleteModalOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v: boolean) => {
    if (!v) deleteTarget.value = null;
  },
});

async function confirmDeleteProject() {
  if (!deleteTarget.value) return;
  const id = deleteTarget.value.id;
  deleting.value = true;
  deleteError.value = null;
  try {
    await deleteProject(id);
    deleteTarget.value = null;
    await refreshProjects();
  } catch (err) {
    deleteError.value = errMessage(err, 'Failed to delete project.');
  } finally {
    deleting.value = false;
  }
}

function openProject(id: number) {
  router.push(`/manage/${id}`);
}

function formatDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString();
}

onMounted(refreshProjects);
</script>

<template>
  <div class="manage">
    <header class="manage__header container">
      <div class="page-head">
        <button class="page-back" aria-label="Back to home" @click="router.push('/')">←</button>
        <h1 class="serif-headline manage__title">Manage</h1>
      </div>
      <hr class="rule-thick" />
    </header>

    <div class="manage__body container">
      <div class="manage__list-head">
        <span class="label">Projects</span>
        <AppButton variant="outline" @click="openCreate">New Project</AppButton>
      </div>

      <AppAlert v-if="error" variant="error" class="manage__error">{{ error }}</AppAlert>

      <div v-if="loadingProjects" class="manage__loading">
        <AppSpinner label="Loading projects…" />
      </div>

      <ul v-else class="project-cards">
        <li v-for="(p, i) in sortedProjects" :key="p.id">
          <div class="project-card">
            <button class="project-card__main" @click="openProject(p.id)">
              <span class="label project-card__index">{{ String(i + 1).padStart(2, '0') }}</span>
              <span class="serif-headline project-card__title">{{ p.name }}</span>
              <span class="project-card__desc">{{ p.description || 'No description' }}</span>
              <span class="project-card__meta meta">
                {{ p.activeVersion ? `version${p.activeVersion}` : 'no data' }} ·
                {{ formatDate(p.created_at) }}
              </span>
              <span class="project-card__cta">Open <span class="arrow" aria-hidden="true">→</span></span>
            </button>
            <AppButton variant="ghost" class="project-card__delete" @click="askDeleteProject(p)">
              Delete
            </AppButton>
          </div>
        </li>
      </ul>

      <p v-if="!loadingProjects && sortedProjects.length === 0" class="meta manage__empty-list">
        No projects yet. Create one to get started.
      </p>
    </div>

    <!-- Create project modal -->
    <AppModal v-model:open="createOpen" title="New Project">
      <form class="create-form" @submit.prevent="submitCreate">
        <AppInput v-model="createName" label="Project Name" placeholder="e.g. Q3 Sales" />
        <AppInput
          v-model="createDesc"
          label="Description"
          placeholder="Optional description"
          textarea
        />
        <AppAlert v-if="error" variant="error">{{ error }}</AppAlert>
        <div class="create-form__actions">
          <AppButton variant="ghost" @click="createOpen = false">Cancel</AppButton>
          <AppButton type="submit" :loading="creating">Create</AppButton>
        </div>
      </form>
    </AppModal>

    <!-- Delete project modal -->
    <AppModal v-model:open="deleteModalOpen" title="Delete Project">
      <p class="activation-text">
        Delete project <strong>{{ deleteTarget?.name }}</strong>? This permanently removes its
        data tables and cannot be undone.
      </p>
      <AppAlert v-if="deleteError" variant="error">{{ deleteError }}</AppAlert>
      <template #footer>
        <AppButton variant="ghost" @click="deleteTarget = null">Cancel</AppButton>
        <AppButton :loading="deleting" @click="confirmDeleteProject">Delete</AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped lang="scss">
.manage {
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

  &__empty-list {
    padding: 1.5rem 0;
  }
}

.manage__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: var(--border-thin);
}

.project-cards {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 2rem;
  padding-top: 1rem;
}

.project-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-background);
  border: var(--border-thin);
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease;

  &__main {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    flex: 1;
    min-height: 0;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 1.5rem;
    cursor: pointer;
    color: inherit;
    overflow: hidden;
  }

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
  &:focus-within {
    background: var(--color-card);
    color: var(--color-card-foreground);
    border-color: var(--color-foreground);
    transform: translateY(-3px);

    .project-card__index {
      color: var(--color-muted-foreground);
      opacity: 0.7;
    }

    .arrow {
      transform: translateX(6px);
    }

    .project-card__delete {
      opacity: 1;
    }
  }

  &__delete {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
}

.activation-text {
  line-height: 1.625;
}
</style>
