<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getProject,
  createChatSession,
  getChatSessions,
  getChatSessionMessages,
  errMessage,
} from '@/api';
import type { ProjectDetail, ChatMessage, ChatSession } from '@/api/types';
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

// Active chat session for the current conversation.
const activeSessionId = ref<number | null>(null);
const chatKey = ref(0);

// Reuse the newest session if one exists, otherwise start a fresh one.
async function ensureSession() {
  try {
    const sessions = await getChatSessions(projectId.value);
    if (sessions.length > 0) {
      activeSessionId.value = sessions[0].id;
    } else {
      const s = await createChatSession(projectId.value);
      activeSessionId.value = s.id;
    }
  } catch {
    activeSessionId.value = null;
  }
}

// New chat: persist the current conversation and start a new session.
async function newChat() {
  try {
    const s = await createChatSession(projectId.value);
    activeSessionId.value = s.id;
    chatKey.value += 1;
  } catch (err) {
    error.value = errMessage(err, 'Failed to start a new chat.');
  }
}

// Chat history: session list (by time) -> session detail (input / SQL).
const historyOpen = ref(false);
const sessions = ref<ChatSession[]>([]);
const historyLoading = ref(false);
const historyError = ref<string | null>(null);
const selectedSession = ref<ChatSession | null>(null);
const sessionMessages = ref<ChatMessage[]>([]);
const sessionLoading = ref(false);
const sessionError = ref<string | null>(null);

async function openHistory() {
  historyOpen.value = true;
  selectedSession.value = null;
  sessionMessages.value = [];
  historyLoading.value = true;
  historyError.value = null;
  try {
    sessions.value = await getChatSessions(projectId.value);
  } catch (err) {
    historyError.value = errMessage(err, 'Failed to load chat history.');
  } finally {
    historyLoading.value = false;
  }
}

async function openSession(session: ChatSession) {
  selectedSession.value = session;
  sessionMessages.value = [];
  sessionLoading.value = true;
  sessionError.value = null;
  try {
    sessionMessages.value = await getChatSessionMessages(projectId.value, session.id);
  } catch (err) {
    sessionError.value = errMessage(err, 'Failed to load session messages.');
  } finally {
    sessionLoading.value = false;
  }
}

function backToSessions() {
  selectedSession.value = null;
  sessionMessages.value = [];
}

function formatDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString();
}

// Session detail split into user inputs (left) and executed SQL (right).
const sessionUserMessages = computed(() =>
  sessionMessages.value.filter((m) => m.role === 'user'),
);
const sessionSqlMessages = computed(
  () => sessionMessages.value.filter((m) => m.role === 'assistant' && m.sql),
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    project.value = await getProject(projectId.value);
    await ensureSession();
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
        <div class="qdetail__header-actions">
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
            <AppButton variant="outline" @click="newChat">New Chat</AppButton>
            <AppButton variant="outline" @click="openHistory">History</AppButton>
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
            <ChatPanel
              :key="chatKey"
              :project-id="projectId"
              :project-name="project.name"
              :session-id="activeSessionId"
            />
          </div>
        </div>
      </template>
    </div>

    <AppModal v-model:open="helpOpen" title="Ask Mode">
      <p class="qdetail__help-text">
        Ask a natural-language question; the LLM converts it to SQL, executes it
        against the active version, and shows the result. <br><br>Press Enter to send;
        Ctrl/Alt+Enter inserts a new line.
      </p>
    </AppModal>

    <AppModal v-model:open="historyOpen" title="History" wide>
      <template #title>
        History <span class="qdetail__history-title-suffix">(sessions)</span>
      </template>

      <div v-if="historyLoading" class="qdetail__history-loading">
        <AppSpinner label="Loading history…" />
      </div>
      <AppAlert v-else-if="historyError" variant="error">{{ historyError }}</AppAlert>

      <template v-else-if="!selectedSession">
        <div v-if="sessions.length" class="qdetail__history-sessions">
          <button
            v-for="s in sessions"
            :key="s.id"
            class="qdetail__history-session"
            @click="openSession(s)"
          >
            <span class="serif-headline qdetail__history-session-time">
              {{ formatDate(s.created_at) }}
            </span>
            <span class="meta">{{ s.message_count }} messages</span>
            <span class="qdetail__history-session-arrow" aria-hidden="true">→</span>
          </button>
        </div>
        <p v-else class="meta qdetail__history-empty">No chat sessions yet.</p>
      </template>

      <template v-else>
        <div class="qdetail__history-detail-head">
          <AppButton variant="ghost" @click="backToSessions">← All Sessions</AppButton>
          <p class="meta">{{ formatDate(selectedSession.created_at) }}</p>
        </div>

        <div v-if="sessionLoading" class="qdetail__history-loading">
          <AppSpinner label="Loading session…" />
        </div>
        <AppAlert v-else-if="sessionError" variant="error">{{ sessionError }}</AppAlert>

        <div v-else class="qdetail__history">
          <div class="qdetail__history-col">
            <p class="label qdetail__history-col-title">Your Input</p>
            <div v-for="m in sessionUserMessages" :key="m.id" class="qdetail__history-item">
              <p class="qdetail__history-text">{{ m.content }}</p>
              <span class="meta qdetail__history-time">{{ formatDate(m.created_at) }}</span>
            </div>
          </div>
          <div class="qdetail__history-col">
            <p class="label qdetail__history-col-title">Executed SQL</p>
            <div v-for="m in sessionSqlMessages" :key="m.id" class="qdetail__history-item">
              <pre class="qdetail__history-sql">{{ m.sql }}</pre>
              <span class="meta qdetail__history-time">{{ formatDate(m.created_at) }}</span>
            </div>
          </div>
        </div>
      </template>
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

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
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

  &__history {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    max-height: 60vh;
    overflow: auto;
    border-top: var(--border-thin);
  }

  &__history-title-suffix {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    margin-left: 0.5rem;
  }

  &__history-loading {
    display: flex;
    justify-content: center;
    padding: 2rem 0;
  }

  &__history-sessions {
    display: flex;
    flex-direction: column;
    border-top: var(--border-thin);
  }

  &__history-session {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 1rem;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-bottom: var(--border-hairline);
    padding: 0.875rem 0.5rem;
    cursor: pointer;
    color: var(--color-foreground);
    transition: background-color 0.25s ease, color 0.25s ease;

    &:hover {
      background: var(--color-foreground);
      color: var(--color-accent-foreground);

      .qdetail__history-session-time {
        color: inherit;
      }

      .meta {
        color: var(--color-background);
        opacity: 0.7;
      }
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: -3px;
    }
  }

  &__history-session-time {
    font-size: var(--text-lg);
  }

  &__history-session-arrow {
    font-size: var(--text-lg);
  }

  &__history-detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: var(--border-thin);
  }

  &__history-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
    padding-top: 0.75rem;
  }

  &__history-col-title {
    color: var(--color-muted-foreground);
  }

  &__history-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 0.875rem 0.25rem;
    border-bottom: var(--border-hairline);
  }

  &__history-time {
    font-style: italic;
  }

  &__history-text {
    font-size: var(--text-base);
    line-height: 1.625;
    opacity: 0.9;
  }

  &__history-sql {
    margin: 0;
    padding: 0.75rem;
    overflow-x: auto;
    background: var(--color-muted);
    border-left: var(--border-thin);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.625;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__history-empty {
    padding: 2rem 0;
    text-align: center;
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
