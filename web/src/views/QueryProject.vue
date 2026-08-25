<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getProject, errMessage } from '@/api';
import type { ProjectDetail } from '@/api/types';
import { AppButton, AppSpinner, AppAlert } from '@/components/ui';
import DataTable from '@/components/DataTable.vue';
import ChatPanel from '@/components/ChatPanel.vue';
import { AppModal } from '@/components/ui';
import {
  ChatBubbleLeftRightIcon,
  RectangleStackIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/vue/24/outline';

type Mode = 'browse' | 'ask';

const route = useRoute();
const router = useRouter();

const projectId = computed(() => Number(route.params.id));
const project = ref<ProjectDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const mode = ref<Mode>('ask');
const helpOpen = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    project.value = await getProject(projectId.value);
  } catch (err) {
    error.value = errMessage(err, 'Failed to load project.');
  } finally {
    loading.value = false;
  }
}

watch(projectId, () => {
  project.value = null;
  mode.value = 'ask';
  load();
});

onMounted(load);
</script>

<template>
  <div class="qdetail">
    <header class="qdetail__header container">
      <div class="page-head">
        <button class="page-back" aria-label="Back to home" @click="router.push('/')">←</button>
        <h1 class="serif-headline qdetail__title">Query</h1>
      </div>
      <hr class="rule-thick" />
    </header>

    <div class="qdetail__body container">
      <AppAlert v-if="error" variant="error">{{ error }}</AppAlert>

      <div v-if="loading" class="qdetail__loading">
        <AppSpinner label="Loading project…" />
      </div>

      <template v-else-if="project">
        <div class="qdetail__head">
          <AppButton variant="ghost" class="qdetail__back" @click="router.push('/query')">
            ← Projects
          </AppButton>
          <div class="qdetail__head-text">
            <div class="qdetail__head-title">
              <h2 class="serif-headline qdetail__title-sub">{{ project.name }}</h2>
              <p class="meta qdetail__meta">
                {{
                  project.activeVersion
                    ? `Active version ${project.activeVersion}`
                    : 'No data uploaded yet'
                }}
              </p>
            </div>
            <p class="qdetail__head-desc">{{ project.description || 'No description' }}</p>
          </div>
          <div class="qdetail__head-actions">
            <button
              v-if="mode === 'ask'"
              class="qdetail__help"
              aria-label="About Ask Mode"
              @click="helpOpen = true"
            >
              <QuestionMarkCircleIcon class="qdetail__help-icon" />
            </button>
            <div class="qdetail__mode-switch" role="tablist" aria-label="Query mode">
              <AppButton
                variant="ghost"
                class="qdetail__mode-btn"
                :class="{ 'qdetail__mode-btn--active': mode === 'ask' }"
                @click="mode = 'ask'"
              >
                <ChatBubbleLeftRightIcon class="qdetail__mode-icon" />
                Ask Mode
              </AppButton>
              <AppButton
                variant="ghost"
                class="qdetail__mode-btn"
                :class="{ 'qdetail__mode-btn--active': mode === 'browse' }"
                @click="mode = 'browse'"
              >
                <RectangleStackIcon class="qdetail__mode-icon" />
                Browse Data
              </AppButton>
            </div>
          </div>
        </div>

        <div class="qdetail__content">
          <div v-if="mode === 'browse'" class="qdetail__browse">
            <DataTable
              :project-id="projectId"
              sticky-header-top="0px"
              scroll-container="parent"
            />
          </div>

          <div v-else class="qdetail__ask">
            <ChatPanel :project-id="projectId" :project-name="project.name" />
          </div>
        </div>
      </template>
    </div>

    <AppModal v-model:open="helpOpen" title="Ask Mode">
      <p class="qdetail__help-text">
        Ask a natural-language question; the LLM converts it to SQL, executes it
        against the active version, and shows the result. Press Enter to send;
        Ctrl/Alt+Enter inserts a new line.
      </p>
    </AppModal>
  </div>
</template>

<style scoped lang="scss">
.qdetail {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  &__header {
    padding-top: 2.5rem;
    padding-bottom: 1.5rem;
    flex-shrink: 0;
  }

  &__title {
    font-size: var(--text-5xl);
  }

  &__body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 1.5rem;
    overflow: hidden;
  }

  &__loading {
    padding: 2rem 0;
  }

  &__content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  &__back {
    align-self: center;
  }

  &__head-text {
    min-width: 0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  &__head-title {
    min-width: 0;
  }

  &__title-sub {
    font-size: var(--text-3xl);
    margin-bottom: 0.25rem;
  }

  &__meta {
    font-style: italic;
  }

  &__head-desc {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    max-width: 28rem;
    font-size: var(--text-base);
    line-height: 1.625;
    opacity: 0.85;
  }

  &__head-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    align-self: center;
  }

  &__help {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-muted-foreground);
    transition:
      color 0.25s ease,
      background-color 0.25s ease;

    &:hover {
      color: var(--color-foreground);
      background: var(--color-muted);
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: 3px;
    }
  }

  &__help-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  &__help-text {
    line-height: 1.625;
  }

  &__mode-switch {
    display: inline-flex;
    align-self: center;
    border: var(--border-thin);
  }

  &__mode-btn {
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

  &__mode-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  &__browse,
  &__ask {
    min-width: 0;
    height: 100%;
  }
}
</style>
