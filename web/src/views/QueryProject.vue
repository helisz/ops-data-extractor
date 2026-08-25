<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getProject,
  createChatSession,
  getChatSessions,
  getChatSessionMessages,
  deleteChatSession,
  errMessage,
} from '@/api';
import type { ProjectDetail, ChatMessage, ChatSession } from '@/api/types';
import { AppButton, AppSpinner, AppAlert, AppModal } from '@/components/ui';
import DataTable from '@/components/DataTable.vue';
import ChatPanel from '@/components/ChatPanel.vue';
import {
  ChatBubbleLeftRightIcon,
  RectangleStackIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
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
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null);

// New Chat is disabled while the current session has no messages.
const canNewChat = computed(() => (chatPanelRef.value?.messageCount ?? 0) > 0);

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

// Delete a session from history; if it is the active one, fall back.
const deletingSession = ref<number | null>(null);
async function removeSession(session: ChatSession) {
  if (deletingSession.value != null) return;
  deletingSession.value = session.id;
  try {
    await deleteChatSession(projectId.value, session.id);
    sessions.value = sessions.value.filter((s) => s.id !== session.id);
    if (selectedSession.value?.id === session.id) {
      backToSessions();
    }
    if (activeSessionId.value === session.id) {
      activeSessionId.value = null;
      await ensureSession();
      chatKey.value += 1;
    }
  } catch (err) {
    historyError.value = errMessage(err, 'Failed to delete session.');
  } finally {
    deletingSession.value = null;
  }
}

function formatDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString();
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}

// Fold overly long assistant replies in history; click to expand.
const expandedHistory = ref<Set<number>>(new Set());
const LONG_CONTENT = 320;

function isLongContent(content: string): boolean {
  return content.length > LONG_CONTENT;
}

function toggleHistoryContent(id: number) {
  const next = new Set(expandedHistory.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedHistory.value = next;
}

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

// Measure the site topbar so the page height is exactly the remaining viewport.
function updateTopbarVar() {
  const header = document.querySelector('.site-header');
  const h = header ? `${header.getBoundingClientRect().height}px` : '78px';
  document.documentElement.style.setProperty('--topbar-h', h);
}

onMounted(() => {
  load();
  updateTopbarVar();
  window.addEventListener('resize', updateTopbarVar);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateTopbarVar);
});
</script>

<template>
  <div class="qdetail">
    <header class="qdetail__header container">
      <div class="page-head">
        <button class="page-back" aria-label="Back to home" @click="router.push('/')">←</button>
        <h1 class="serif-headline qdetail__title">Query</h1>
      </div>

      <div class="qdetail__tabs" role="tablist" aria-label="Query mode">
        <button
          class="qdetail__tab"
          :class="{ 'qdetail__tab--active': mode === 'ask' }"
          @click="mode = 'ask'"
        >
          <ChatBubbleLeftRightIcon class="qdetail__mode-icon" />
          Ask Mode
        </button>
        <button
          class="qdetail__tab"
          :class="{ 'qdetail__tab--active': mode === 'browse' }"
          @click="mode = 'browse'"
        >
          <RectangleStackIcon class="qdetail__mode-icon" />
          Browse Data
        </button>
      </div>

      <hr class="rule-thick" />
    </header>

    <AppAlert v-if="error" variant="error" class="qdetail__error container">{{ error }}</AppAlert>

    <template v-if="project">
      <div class="qdetail__head container">
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
        <div v-if="mode === 'ask'" class="qdetail__head-actions">
          <button
            class="qdetail__help"
            aria-label="About Ask Mode"
            @click="helpOpen = true"
          >
            <QuestionMarkCircleIcon class="qdetail__help-icon" />
          </button>
          <AppButton variant="outline" :disabled="!canNewChat" @click="newChat">
            New Chat
          </AppButton>
          <AppButton variant="outline" @click="openHistory">History</AppButton>
        </div>
      </div>

      <div
        class="qdetail__chat container"
        :class="{ 'qdetail__chat--browse': mode === 'browse' }"
      >
        <DataTable
          v-if="mode === 'browse'"
          :project-id="projectId"
          sticky-header-top="0px"
          scroll-container="parent"
        />
        <ChatPanel
          v-else
          ref="chatPanelRef"
          :key="chatKey"
          :project-id="projectId"
          :project-name="project.name"
          :session-id="activeSessionId"
        />
      </div>
    </template>

    <div v-else-if="loading" class="qdetail__loading container">
      <AppSpinner label="Loading project…" />
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
          <div v-for="s in sessions" :key="s.id" class="qdetail__history-session-row">
            <button
              class="qdetail__history-session"
              @click="openSession(s)"
            >
              <span class="serif-headline qdetail__history-session-time">
                {{ formatDate(s.created_at) }}
              </span>
              <span class="meta">{{ s.message_count }} messages</span>
              <span class="qdetail__history-session-arrow" aria-hidden="true">→</span>
            </button>
            <button
              class="qdetail__history-session-del"
              :aria-label="`Delete session ${formatDate(s.created_at)}`"
              :disabled="deletingSession === s.id"
              @click.stop="removeSession(s)"
            >
              <TrashIcon class="qdetail__history-session-del-icon" />
            </button>
          </div>
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

        <div v-else class="qdetail__history-detail">
          <div
            v-for="m in sessionMessages"
            :key="m.id"
            class="qdetail__history-msg"
            :class="m.role === 'user'
              ? 'qdetail__history-msg--user'
              : 'qdetail__history-msg--assistant'"
          >
            <div class="qdetail__history-bubble">
              <template v-if="m.role === 'user'">
                <p class="qdetail__history-text">{{ m.content }}</p>
              </template>
              <template v-else>
                <!-- <p
                  v-if="m.content"
                  class="qdetail__history-text"
                  :class="{
                    'qdetail__history-text--clamped':
                      isLongContent(m.content) && !expandedHistory.has(m.id),
                  }"
                >
                  {{ m.content }}
                </p> -->
                <button
                  v-if="m.content && isLongContent(m.content)"
                  class="qdetail__history-toggle"
                  @click="toggleHistoryContent(m.id)"
                >
                  {{ expandedHistory.has(m.id) ? 'Show less' : 'Show all' }}
                </button>
                <pre v-if="m.sql" class="qdetail__history-sql">{{ m.sql }}</pre>
                <p v-if="m.execution" class="meta qdetail__history-exec">
                  status {{ m.execution.status }} ·
                  {{ m.execution.rowCount ?? 0 }} rows ·
                  {{ formatSeconds(m.execution.durationMs ?? 0) }}
                </p>
                <div
                  v-if="m.result && m.result.rows.length"
                  class="qdetail__history-result"
                >
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th v-for="col in m.result.columns" :key="col">{{ col }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, i) in m.result.rows.slice(0, 100)" :key="i">
                        <td v-for="col in m.result.columns" :key="col">
                          <span class="ellipsis" :title="String(row[col] ?? '')">
                            {{ row[col] ?? '' }}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
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
  height: calc(100dvh - var(--topbar-h, 78px));
  max-height: calc(100dvh - var(--topbar-h, 78px));
  min-height: 0;
  overflow: hidden;

  // Query title row sits flush against the tabs (this page only).
  .page-head {
    margin-bottom: 0;
  }

  &__header {
    padding-top: 2.5rem;
    padding-bottom: 1.5rem;
    flex-shrink: 0;
  }

  &__title {
    font-size: var(--text-5xl);
  }

  &__tabs {
    display: flex;
    justify-content: flex-end;
    gap: 1.5rem;
    margin-top: 0.5rem;
  }

  &__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 40px;
    padding: 0.25rem 0.125rem;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-muted-foreground);
    cursor: pointer;
    transition:
      color var(--duration-fast),
      border-bottom-color var(--duration-fast);

    &:hover {
      color: var(--color-foreground);
    }

    &--active {
      color: var(--color-foreground);
      border-bottom-color: var(--color-foreground);
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: 2px;
    }
  }

  &__error {
    padding-top: 0.75rem;
  }

  &__loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 0;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    flex-shrink: 0;
    padding-bottom: 1.25rem;
  }

  &__chat {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-bottom: 1.5rem;

    &--browse {
      overflow: auto;
    }
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

  &__history-detail {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-height: 60vh;
    overflow: auto;
    padding-top: 1rem;
  }

  &__history-msg {
    display: flex;
    width: 100%;

    &--user {
      justify-content: flex-end;

      .qdetail__history-bubble {
        background: var(--color-foreground);
        color: var(--color-accent-foreground);
        border: 2px solid var(--color-foreground);
      }
    }

    &--assistant {
      justify-content: flex-start;

      .qdetail__history-bubble {
        background: var(--color-card);
        border: var(--border-thin);
      }
    }
  }

  &__history-bubble {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    max-width: 75%;
    min-width: 0;
    padding: 0.75rem 1rem;
  }

  &__history-exec {
    font-style: italic;
  }

  &__history-result {
    overflow-x: auto;
    border-top: var(--border-hairline);
    padding-top: 0.5rem;
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

  &__history-session-row {
    display: flex;
    align-items: stretch;
    border-bottom: var(--border-hairline);

    &:hover .qdetail__history-session-del {
      opacity: 1;
    }
  }

  &__history-session {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
    text-align: left;
    background: none;
    border: none;
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

  &__history-session-del {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-muted-foreground);
    opacity: 0;
    transition: opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease;

    &:hover {
      background: var(--color-foreground);
      color: var(--color-accent-foreground);
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: -3px;
      opacity: 1;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  }

  &__history-session-del-icon {
    width: 1rem;
    height: 1rem;
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

  &__history-text {
    font-size: var(--text-base);
    line-height: 1.625;
    opacity: 0.9;

    &--clamped {
      display: -webkit-box;
      -webkit-line-clamp: 6;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }

  &__history-toggle {
    align-self: flex-start;
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-muted-foreground);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;

    &:hover {
      color: var(--color-foreground);
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: 2px;
    }
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

  &__mode-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
}
</style>
