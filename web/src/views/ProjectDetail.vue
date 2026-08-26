<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getProject,
  updateProject,
  uploadVersion,
  activateVersion,
  deleteVersion,
  errMessage,
} from '@/api';
import type { ProjectDetail, Version, HeaderMapping } from '@/api/types';
import {
  AppButton,
  AppInput,
  AppModal,
  AppTag,
  AppAlert,
  AppSpinner,
} from '@/components/ui';
import DataTable from '@/components/DataTable.vue';
import { TrashIcon } from '@heroicons/vue/24/outline';

const route = useRoute();
const router = useRouter();

const projectId = computed(() => Number(route.params.id));
const project = ref<ProjectDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const tableRefreshKey = ref(0);

// Newest versions first
const sortedVersions = computed(() => {
  if (!project.value) return [];
  return [...project.value.versions].sort((a, b) => b.version_number - a.version_number);
});

// Edit name / description
const editing = ref(false);
const editName = ref('');
const editDesc = ref('');
const saving = ref(false);
const saveAlert = ref<{ variant: 'success' | 'error'; message: string } | null>(null);
const dirty = computed(
  () =>
    project.value != null &&
    (editName.value !== project.value.name || editDesc.value !== project.value.description),
);

function startEdit() {
  if (!project.value) return;
  editName.value = project.value.name;
  editDesc.value = project.value.description;
  saveAlert.value = null;
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  saveAlert.value = null;
}

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

async function load() {
  loading.value = true;
  error.value = null;
  try {
    project.value = await getProject(projectId.value);
    editName.value = project.value.name;
    editDesc.value = project.value.description;
  } catch (err) {
    error.value = errMessage(err, 'Failed to load project detail.');
  } finally {
    loading.value = false;
  }
}

async function saveProject() {
  if (!dirty.value) return;
  saving.value = true;
  saveAlert.value = null;
  try {
    const updated = await updateProject(projectId.value, {
      name: editName.value.trim(),
      description: editDesc.value.trim(),
    });
    if (project.value) {
      project.value = {
        ...project.value,
        name: updated.name,
        description: updated.description,
      };
    }
    editName.value = updated.name;
    editDesc.value = updated.description;
    editing.value = false;
    saveAlert.value = { variant: 'success', message: 'Project saved.' };
  } catch (err) {
    saveAlert.value = { variant: 'error', message: errMessage(err, 'Failed to save project.') };
  } finally {
    saving.value = false;
  }
}

function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) uploadFile(file);
  input.value = '';
}

async function uploadFile(file: File) {
  uploading.value = true;
  uploadError.value = null;
  uploadSuccess.value = null;
  try {
    const res = await uploadVersion(projectId.value, file);
    uploadSuccess.value = `Version ${res.version.version_number} uploaded successfully.`;
    if (res.requiresActivation && res.activeVersion != null) {
      activationPrompt.value = {
        newVersion: res.version,
        activeVersion: res.activeVersion,
      };
    }
    tableRefreshKey.value += 1;
    await load();
  } catch (err) {
    uploadError.value = errMessage(err, 'Upload failed.');
  } finally {
    uploading.value = false;
  }
}

async function confirmActivation() {
  if (!activationPrompt.value) return;
  const newVersionNumber = activationPrompt.value.newVersion.version_number;
  activating.value = true;
  try {
    await activateVersion(projectId.value, activationPrompt.value.newVersion.id);
    activationPrompt.value = null;
    uploadSuccess.value = `Version ${newVersionNumber} activated.`;
    tableRefreshKey.value += 1;
    await load();
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
  if (!deleteTarget.value) return;
  deleting.value = true;
  deleteError.value = null;
  try {
    await deleteVersion(projectId.value, deleteTarget.value.id);
    deleteTarget.value = null;
    tableRefreshKey.value += 1;
    await load();
  } catch (err) {
    deleteError.value = errMessage(err, 'Failed to delete version.');
  } finally {
    deleting.value = false;
  }
}

function typeLabel(type: HeaderMapping['type']): string {
  switch (type) {
    case 'TEXT':
      return 'Text';
    case 'INTEGER':
      return 'Integer';
    case 'REAL':
      return 'Number';
    case 'DATETIME':
      return 'DateTime';
    default:
      return type;
  }
}

function formatDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString();
}

watch(projectId, () => {
  project.value = null;
  saveAlert.value = null;
  uploadError.value = null;
  uploadSuccess.value = null;
  load();
});

onMounted(load);
</script>

<template>
  <div class="detail">
    <header class="detail__header container">
      <div class="page-head">
        <button class="page-back" aria-label="Back to home" @click="router.push('/')">←</button>
        <h1 class="serif-headline detail__title">Project Detail</h1>
      </div>
      <hr class="rule-thick" />
    </header>

    <div class="detail__layout container">
      <aside class="detail__side">
        <AppButton variant="ghost" class="detail__back" @click="router.push('/data/manage')">
          ← Projects
        </AppButton>

        <AppAlert v-if="error" variant="error">{{ error }}</AppAlert>

        <div v-if="loading" class="detail__loading">
          <AppSpinner label="Loading project…" />
        </div>

        <template v-else-if="project">
          <section class="detail__info">
            <div class="detail__info-label-row">
              <p class="label detail__info-label">Project</p>
              <AppButton variant="ghost" class="detail__edit-btn" @click="startEdit">
                Edit
              </AppButton>
            </div>

            <template v-if="editing">
              <AppInput v-model="editName" label="Name" placeholder="Project name" />
              <AppInput
                v-model="editDesc"
                label="Description"
                placeholder="Optional description"
                textarea
              />
              <div class="detail__info-actions">
                <AppButton variant="ghost" @click="cancelEdit">Cancel</AppButton>
                <AppButton :loading="saving" :disabled="!dirty" @click="saveProject">Save</AppButton>
              </div>
            </template>
            <template v-else>
              <h2 class="serif-headline detail__info-name">{{ project.name }}</h2>
              <p v-if="project.description" class="detail__info-desc">{{ project.description }}</p>
              <p v-else class="meta detail__info-desc-muted">No description</p>
            </template>

            <AppAlert v-if="saveAlert" :variant="saveAlert.variant">
              {{ saveAlert.message }}
            </AppAlert>
            <p class="meta detail__info-meta">Created {{ formatDate(project.created_at) }}</p>
          </section>

          <section v-if="project.headers.length" class="detail__block">
            <p class="label detail__block-label">Headers</p>
            <div class="headers-table">
              <div
                v-for="h in project.headers"
                :key="h.column"
                class="headers-table__row"
              >
                <span class="headers-table__name">{{ h.header }}</span>
                <span class="headers-table__type">{{ typeLabel(h.type) }}</span>
              </div>
            </div>
          </section>

          <section class="detail__block">
              <p class="label detail__block-label">Versions</p>
            <div class="detail__block-head">
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

            <div v-if="sortedVersions.length" class="version-list">
              <div
                v-for="v in sortedVersions"
                :key="v.id"
                class="version-row"
                :class="{ 'version-row--active': project.activeVersion === v.version_number }"
              >
                <div class="version-row__main">
                  <span class="version-row__num serif-headline">version{{ v.version_number }}</span>
                  <span class="version-row__meta meta">{{ formatDate(v.created_at) }}</span>
                </div>
                <AppTag v-if="project.activeVersion === v.version_number" variant="inverted">
                  Active
                </AppTag>
                <span v-else class="version-row__spacer"></span>
                <div class="version-row__actions">
                  <AppButton
                    v-if="project.activeVersion !== v.version_number"
                    variant="ghost"
                    @click="activateVersion(projectId, v.id).then(() => { tableRefreshKey += 1; load(); })"
                  >
                    Activate
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    class="version-row__delete"
                    aria-label="Delete version"
                    @click="askDeleteVersion(v)"
                  >
                    <TrashIcon class="version-row__delete-icon" />
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
        </template>
      </aside>

      <section class="detail__data">
        <template v-if="project">
          <DataTable :project-id="projectId" :refresh-key="tableRefreshKey" />
        </template>
      </section>
    </div>

    <!-- Activation prompt modal -->
    <AppModal v-model:open="activationModalOpen" title="Activate Version?">
      <p class="activation-text">
        Version <strong>version{{ activationPrompt?.newVersion.version_number }}</strong> was created.
        The current active version is
        <strong>version{{ activationPrompt?.activeVersion }}</strong>. Activate the new version now?
      </p>
      <template #footer>
        <AppButton variant="ghost" @click="activationPrompt = null">Not Now</AppButton>
        <AppButton :loading="activating" @click="confirmActivation">Activate Now</AppButton>
      </template>
    </AppModal>

    <!-- Delete version modal -->
    <AppModal v-model:open="deleteModalOpen" title="Delete Version">
      <p class="activation-text">
        Delete version <strong>version{{ deleteTarget?.version_number }}</strong>? This action
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
.detail {
  &__header {
    padding-top: 2.5rem;
    padding-bottom: 1.5rem;
  }

  &__title {
    font-size: var(--text-5xl);
  }

  &__layout {
    display: grid;
    grid-template-columns: 20rem 1fr;
    gap: 2.5rem;
    padding-bottom: 4rem;
    align-items: start;
  }

  &__side {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  &__back {
    align-self: flex-start;
  }

  &__loading {
    padding: 2rem 0;
  }
}

.detail__info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border: var(--border-thin);

  &-label {
    color: var(--color-muted-foreground);
  }

  &-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  &-name {
    font-size: var(--text-3xl);
  }

  &-desc {
    font-size: var(--text-base);
    line-height: 1.625;
    opacity: 0.85;
  }

  &-desc-muted {
    font-style: italic;
  }

  &-actions {
    display: flex;
    justify-content: flex-end;
  }

  &-meta {
    font-style: italic;
  }
}

.detail__edit-btn {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.detail__block {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__label {
    color: var(--color-muted-foreground);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
}

.headers-table {
  border-top: var(--border-thin);

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 0.25rem;
    border-bottom: var(--border-hairline);
  }

  &__name {
    font-size: var(--text-base);
  }

  &__type {
    color: var(--color-muted-foreground);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-align: right;
    flex-shrink: 0;
  }
}

.detail__data {
  min-width: 0;
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
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.25rem;
  border-bottom: var(--border-hairline);

  &__main {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  &__num {
    font-size: var(--text-xl);
  }

  &__meta {
    font-size: var(--text-xs);
    font-style: italic;
  }

  &__spacer {
    width: 1px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  &__delete-icon {
    width: 16px;
    height: 16px;
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

.activation-text {
  line-height: 1.625;
}

@media (max-width: 768px) {
  .detail__layout {
    grid-template-columns: 1fr;
  }

  .version-row {
    grid-template-columns: 1fr auto;
  }

  .version-row__actions {
    grid-column: 1 / -1;
  }
}
</style>
