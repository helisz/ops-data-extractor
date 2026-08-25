<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  getProjects,
  getProject,
  createProject,
  deleteProject,
  uploadVersion,
  activateVersion,
  deleteVersion,
  errMessage,
} from '@/api';
import type { Project, ProjectDetail, Version } from '@/api/types';
import {
  AppButton,
  AppInput,
  AppModal,
  AppTag,
  AppAlert,
  AppSpinner,
} from '@/components/ui';
import DataTable from '@/components/DataTable.vue';

const projects = ref<Project[]>([]);
const selectedId = ref<number | null>(null);
const selected = ref<ProjectDetail | null>(null);
const loadingProjects = ref(false);
const loadingDetail = ref(false);
const error = ref<string | null>(null);
const tableRefreshKey = ref(0);

// Create project
const createOpen = ref(false);
const createName = ref('');
const createDesc = ref('');
const creating = ref(false);

// Upload
const uploadInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const uploadSuccess = ref<string | null>(null);
const activationPrompt = ref<{
  newVersion: Version;
  activeVersion: number | null;
} | null>(null);
const activating = ref(false);

// Delete version
const deleteTarget = ref<Version | null>(null);
const deleting = ref(false);
const deleteError = ref<string | null>(null);

const sortedProjects = computed(() =>
  [...projects.value].sort((a, b) => b.id - a.id),
);

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

async function refreshDetail() {
  if (selectedId.value == null) return;
  loadingDetail.value = true;
  try {
    selected.value = await getProject(selectedId.value);
  } catch (err) {
    error.value = errMessage(err, 'Failed to load project detail.');
  } finally {
    loadingDetail.value = false;
  }
}

async function selectProject(id: number) {
  selectedId.value = id;
  selected.value = null;
  uploadError.value = null;
  uploadSuccess.value = null;
  tableRefreshKey.value += 1;
  await refreshDetail();
}

async function openCreate() {
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
    await refreshProjects();
    await selectProject(created.id);
  } catch (err) {
    error.value = errMessage(err, 'Failed to create project.');
  } finally {
    creating.value = false;
  }
}

async function confirmDeleteProject() {
  if (selectedId.value == null) return;
  const id = selectedId.value;
  try {
    await deleteProject(id);
    if (selectedId.value === id) {
      selectedId.value = null;
      selected.value = null;
    }
    await refreshProjects();
  } catch (err) {
    error.value = errMessage(err, 'Failed to delete project.');
  }
}

function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) uploadFile(file);
  input.value = '';
}

async function uploadFile(file: File) {
  if (selectedId.value == null) return;
  uploading.value = true;
  uploadError.value = null;
  uploadSuccess.value = null;
  try {
    const res = await uploadVersion(selectedId.value, file);
    uploadSuccess.value = `Version ${res.version.version_number} uploaded successfully.`;
    if (res.requiresActivation && res.activeVersion != null) {
      activationPrompt.value = {
        newVersion: res.version,
        activeVersion: res.activeVersion,
      };
    }
    tableRefreshKey.value += 1;
    await refreshDetail();
    await refreshProjects();
  } catch (err) {
    uploadError.value = errMessage(err, 'Upload failed.');
  } finally {
    uploading.value = false;
  }
}
async function confirmActivation() {
  if (selectedId.value == null || !activationPrompt.value) return;
  const newVersionNumber = activationPrompt.value.newVersion.version_number;
  activating.value = true;
  try {
    await activateVersion(selectedId.value, activationPrompt.value.newVersion.id);
    activationPrompt.value = null;
    uploadSuccess.value = `Version ${newVersionNumber} activated.`;
    tableRefreshKey.value += 1;
    await refreshDetail();
    await refreshProjects();
  } catch (err) {
    uploadError.value = errMessage(err, 'Activation failed.');
  } finally {
    activating.value = false;
  }
}

const activationModalOpen = computed({
  get: () => activationPrompt.value !== null,
  set: (v: boolean) => {
    if (!v) activationPrompt.value = null;
  },
});

const deleteModalOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v: boolean) => {
    if (!v) deleteTarget.value = null;
  },
});

function askDeleteVersion(version: Version) {
  deleteTarget.value = version;
  deleteError.value = null;
}

async function confirmDeleteVersion() {
  if (selectedId.value == null || !deleteTarget.value) return;
  deleting.value = true;
  deleteError.value = null;
  try {
    await deleteVersion(selectedId.value, deleteTarget.value.id);
    deleteTarget.value = null;
    tableRefreshKey.value += 1;
    await refreshDetail();
    await refreshProjects();
  } catch (err) {
    deleteError.value = errMessage(err, 'Failed to delete version.');
  } finally {
    deleting.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString();
}

onMounted(async () => {
  await refreshProjects();
  if (projects.value.length > 0) {
    await selectProject(projects.value[0].id);
  }
});
</script>

<template>
  <div class="manage">
    <header class="manage__header container">
      <p class="label manage__kicker">Data Management</p>
      <h1 class="serif-headline manage__title">Manage</h1>
      <hr class="rule-thick" />
    </header>

    <div class="manage__layout container">
      <aside class="manage__list">
        <div class="manage__list-head">
          <span class="label">Projects</span>
          <AppButton variant="outline" @click="openCreate">New Project</AppButton>
        </div>
        <AppAlert v-if="error" variant="error" class="manage__error">{{ error }}</AppAlert>
        <div v-if="loadingProjects" class="manage__loading">
          <AppSpinner label="Loading projects…" />
        </div>
        <ul v-else class="project-list">
          <li v-for="p in sortedProjects" :key="p.id">
            <button
              class="project-item"
              :class="{ 'project-item--active': selectedId === p.id }"
              @click="selectProject(p.id)"
            >
              <span class="project-item__title serif-headline">{{ p.name }}</span>
              <span class="project-item__meta meta">
                {{ p.activeVersion ? `v${p.activeVersion}` : 'no data' }} ·
                {{ formatDate(p.created_at) }}
              </span>
            </button>
          </li>
        </ul>
        <p v-if="!loadingProjects && sortedProjects.length === 0" class="meta manage__empty-list">
          No projects yet. Create one to get started.
        </p>
      </aside>

      <section class="manage__detail">
        <div v-if="!selected" class="manage__placeholder">
          <p class="serif-headline">Select a project</p>
          <p class="meta">Choose a project from the list to manage its data and versions.</p>
        </div>

        <div v-else-if="loadingDetail" class="manage__loading">
          <AppSpinner label="Loading project…" />
        </div>

        <template v-else-if="selected">
          <div class="project-head">
            <div class="project-head__text">
              <h2 class="serif-headline project-head__title">{{ selected.name }}</h2>
              <p v-if="selected.description" class="project-head__desc">{{ selected.description }}</p>
              <p class="meta project-head__meta">Created {{ formatDate(selected.created_at) }}</p>
            </div>
            <div class="project-head__actions">
              <AppButton variant="ghost" @click="confirmDeleteProject">Delete Project</AppButton>
            </div>
          </div>

          <div v-if="selected.headers.length" class="headers-block">
            <p class="label headers-block__label">Headers</p>
            <div class="headers-block__tags">
              <AppTag v-for="h in selected.headers" :key="h.column" variant="muted">
                {{ h.header }} · {{ h.type }}
              </AppTag>
            </div>
          </div>

          <section class="versions-block">
            <div class="versions-block__head">
              <p class="label">Versions</p>
              <AppButton
                :loading="uploading"
                variant="outline"
                @click="uploadInput?.click()"
              >
                Upload New Version
              </AppButton>
              <input
                ref="uploadInput"
                type="file"
                accept=".xls,.xlsx"
                class="visually-hidden"
                @change="onFileChosen"
              />
            </div>

            <AppAlert v-if="uploadError" variant="error">{{ uploadError }}</AppAlert>
            <AppAlert v-if="uploadSuccess" variant="success">{{ uploadSuccess }}</AppAlert>

            <div v-if="selected.versions.length" class="version-list">
              <div
                v-for="v in selected.versions"
                :key="v.id"
                class="version-row"
                :class="{ 'version-row--active': selected.activeVersion === v.version_number }"
              >
                <span class="version-row__num serif-headline">v{{ v.version_number }}</span>
                <span class="version-row__meta meta">{{ formatDate(v.created_at) }}</span>
                <AppTag v-if="selected.activeVersion === v.version_number" variant="inverted">
                  Active
                </AppTag>
                <span v-else class="version-row__spacer"></span>
                <div class="version-row__actions">
                  <AppButton
                    v-if="selected.activeVersion !== v.version_number"
                    variant="ghost"
                    @click="activateVersion(selected.id, v.id).then(() => { tableRefreshKey += 1; refreshDetail(); refreshProjects(); })"
                  >
                    Activate
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    @click="askDeleteVersion(v)"
                  >
                    Delete
                  </AppButton>
                </div>
              </div>
            </div>

            <div v-else class="upload-empty">
              <p class="serif-headline">No data yet</p>
              <p class="meta">
                Upload an Excel file (.xls / .xlsx). Its headers define this
                project's structure and initialize the data.
              </p>
              <AppButton :loading="uploading" @click="uploadInput?.click()">
                Upload Excel
              </AppButton>
            </div>
          </section>

          <section v-if="selected.headers.length" class="data-block">
            <hr class="rule-thick" />
            <p class="label data-block__label">Data</p>
            <DataTable :project-id="selected.id" :refresh-key="tableRefreshKey" />
          </section>
        </template>
      </section>
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

    <!-- Activation prompt modal -->
    <AppModal v-model:open="activationModalOpen" title="Activate Version?">
      <p class="activation-text">
        Version <strong>v{{ activationPrompt?.newVersion.version_number }}</strong> was created.
        The current active version is
        <strong>v{{ activationPrompt?.activeVersion }}</strong>. Activate the new version now?
      </p>
      <template #footer>
        <AppButton variant="ghost" @click="activationPrompt = null">Not Now</AppButton>
        <AppButton :loading="activating" @click="confirmActivation">Activate Now</AppButton>
      </template>
    </AppModal>

    <!-- Delete version modal -->
    <AppModal v-model:open="deleteModalOpen" title="Delete Version">
      <p class="activation-text">
        Delete version <strong>v{{ deleteTarget?.version_number }}</strong>? This action
        permanently removes its data table and cannot be undone.
      </p>
      <AppAlert v-if="deleteError" variant="error">{{ deleteError }}</AppAlert>
      <template #footer>
        <AppButton variant="ghost" @click="deleteTarget = null">Cancel</AppButton>
        <AppButton :loading="deleting" @click="confirmDeleteVersion">Delete</AppButton>
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
    margin-top: 1rem;
  }

  &__loading {
    padding: 2rem 0;
  }

  &__empty-list {
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

.manage__list {
  border-right: var(--border-thin);
  padding-right: 1.5rem;
}

.manage__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: var(--border-thin);
}

.project-list {
  list-style: none;
  display: flex;
  flex-direction: column;

  li {
    border-bottom: var(--border-hairline);
  }
}

.project-item {
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

  &__title {
    font-size: var(--text-lg);
  }

  &__meta {
    font-style: italic;
  }

  &:hover {
    background: var(--color-muted);
  }

  &--active {
    background: var(--color-foreground);

    .project-item__title {
      color: var(--color-accent-foreground);
    }

    .project-item__meta {
      color: var(--color-background);
      opacity: 0.75;
    }
  }

  &:focus-visible {
    outline: var(--focus-outline);
    outline-offset: -3px;
  }
}

.project-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;

  &__title {
    font-size: var(--text-4xl);
    margin-bottom: 0.5rem;
  }

  &__desc {
    font-size: var(--text-lg);
    margin-bottom: 0.5rem;
  }

  &__meta {
    font-style: italic;
  }
}

.headers-block {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1.25rem 0;

  &__label {
    color: var(--color-muted-foreground);
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}

.versions-block {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1.25rem 0;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.version-list {
  border-top: var(--border-thin);
}

.version-row {
  display: grid;
  grid-template-columns: 4rem 1fr auto auto;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.25rem;
  border-bottom: var(--border-hairline);

  &__num {
    font-size: var(--text-xl);
  }

  &__meta {
    font-style: italic;
  }

  &__spacer {
    width: 1px;
  }

  &__actions {
    display: flex;
    gap: 0.25rem;
  }
}

.upload-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 2rem 0;
  border-top: var(--border-thin);
  border-bottom: var(--border-thin);

  p.serif-headline {
    font-size: var(--text-2xl);
  }
}

.data-block {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-top: 1rem;

  &__label {
    color: var(--color-muted-foreground);
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

@media (max-width: 768px) {
  .manage__layout {
    grid-template-columns: 1fr;
  }

  .manage__list {
    border-right: none;
    border-bottom: var(--border-thin);
    padding-right: 0;
    padding-bottom: 1rem;
  }

  .version-row {
    grid-template-columns: 3.5rem 1fr;
  }

  .version-row__actions {
    grid-column: 1 / -1;
  }
}
</style>
