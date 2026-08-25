<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { postChatMessage, getChatHistory, errMessage } from '@/api';
import type { ChatMessage } from '@/api/types';
import { AppButton, AppInput, AppCard, AppAlert, AppSpinner } from '@/components/ui';

const props = defineProps<{ projectId: number; projectName: string }>();

const messages = ref<ChatMessage[]>([]);
const input = ref('');
const sending = ref(false);
const error = ref<string | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const expandedSql = ref<Set<number>>(new Set());
const copiedId = ref<number | null>(null);

async function scrollToBottom() {
  await nextTick();
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

async function loadHistory() {
  error.value = null;
  try {
    messages.value = await getChatHistory(props.projectId);
    await scrollToBottom();
  } catch (err) {
    error.value = errMessage(err, 'Failed to load chat history.');
  }
}

async function send() {
  const text = input.value.trim();
  if (!text || sending.value) return;
  sending.value = true;
  error.value = null;

  const userMsg: ChatMessage = {
    id: Date.now(),
    role: 'user',
    content: text,
    sql: null,
    execution: null,
    created_at: new Date().toISOString(),
  };
  messages.value = [...messages.value, userMsg];
  input.value = '';
  await scrollToBottom();

  try {
    const res = await postChatMessage(props.projectId, text);
    const assistantMsg: ChatMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: res.assistantText || (res.execution.error ? null : ''),
      sql: res.sql,
      execution: res.execution,
      result: res.result,
      created_at: new Date().toISOString(),
    };
    messages.value = [...messages.value, assistantMsg];
    await scrollToBottom();
  } catch (err) {
    error.value = errMessage(err, 'Failed to get a response.');
    messages.value = messages.value.filter((m) => m.id !== userMsg.id);
  } finally {
    sending.value = false;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString();
}

function toggleSql(id: number) {
  const next = new Set(expandedSql.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedSql.value = next;
}

async function copySql(sql: string, id: number) {
  try {
    await navigator.clipboard.writeText(sql);
    copiedId.value = id;
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = null;
    }, 1500);
  } catch {
    /* clipboard unavailable */
  }
}

function copyMsgSql(msg: ChatMessage) {
  if (msg.sql) copySql(msg.sql, msg.id);
}

onMounted(loadHistory);
</script>

<template>
  <div class="chat-panel">
    <header class="chat-panel__header">
      <p class="label chat-panel__kicker">Ask Mode — {{ projectName }}</p>
      <p class="meta chat-panel__hint">
        Ask a natural-language question; the LLM converts it to SQL, executes it against
        the active version, and shows the result. Press Enter to send; Ctrl/Alt+Enter
        inserts a new line.
      </p>
    </header>

    <AppAlert v-if="error" variant="error">{{ error }}</AppAlert>

    <div ref="scrollEl" class="chat-panel__scroll">
      <div v-if="messages.length === 0" class="chat-panel__empty">
        <p class="serif-headline">Ask anything</p>
        <p class="meta">
          e.g. “How many rows have status ‘Done’?” or “Average of Amount per Region”.
        </p>
      </div>

      <div
        v-for="msg in messages"
        :key="msg.id"
        class="chat-message"
        :class="`chat-message--${msg.role}`"
      >
        <div class="chat-message__bubble">
          <template v-if="msg.role === 'user'">
            <p class="chat-message__text">{{ msg.content }}</p>
          </template>
          <template v-else>
            <p v-if="msg.content" class="chat-message__text chat-message__text--serif">
              {{ msg.content }}
            </p>
            <div v-if="msg.sql" class="chat-message__sql">
              <div class="chat-message__sql-head">
                <span class="label">Generated SQL</span>
                <AppButton variant="ghost" @click="toggleSql(msg.id)">
                  {{ expandedSql.has(msg.id) ? 'Hide' : 'Show' }}
                </AppButton>
              </div>
              <AppCard v-if="expandedSql.has(msg.id)" class="chat-message__sql-card">
                <pre class="chat-message__sql-pre">{{ msg.sql }}</pre>
                <div class="chat-message__sql-actions">
                  <AppButton variant="ghost" @click="copyMsgSql(msg)">
                    {{ copiedId === msg.id ? 'Copied ✓' : 'Copy' }}
                  </AppButton>
                </div>
              </AppCard>
            </div>

            <div v-if="msg.execution" class="chat-message__exec">
              <AppAlert v-if="msg.execution.status === 'error'" variant="error" title="Execution Failed">
                {{ msg.execution.error }}
              </AppAlert>
              <p v-else class="meta chat-message__exec-meta">
                status {{ msg.execution.status }} · {{ msg.execution.rowCount }} rows ·
                {{ msg.execution.durationMs }} ms
              </p>
            </div>

            <div v-if="msg.result && msg.result.rows.length" class="chat-message__result">
              <div class="chat-message__result-scroll">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th v-for="col in msg.result.columns" :key="col">{{ col }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, i) in msg.result.rows.slice(0, 100)" :key="i">
                      <td v-for="col in msg.result.columns" :key="col" class="chat-message__result-cell">
                        <span class="ellipsis" :title="String(row[col] ?? '')">
                          {{ row[col] ?? '' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="msg.result.rows.length > 100" class="meta chat-message__result-note">
                Showing 100 of {{ msg.result.rows.length }} rows
              </p>
            </div>
          </template>
        </div>
        <p class="chat-message__time meta">{{ formatDate(msg.created_at) }}</p>
      </div>

      <div v-if="sending" class="chat-message chat-message--assistant">
        <div class="chat-message__bubble">
          <AppSpinner label="Thinking & executing…" />
        </div>
      </div>
    </div>

    <form
      class="chat-panel__input"
      @submit.prevent="send"
      @keydown.enter.exact.prevent="send"
    >
      <AppInput
        v-model="input"
        textarea
        :rows="2"
        placeholder="Ask about the data…"
      />
      <AppButton type="submit" :loading="sending">Send</AppButton>
    </form>
  </div>
</template>

<style scoped lang="scss">
.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;

  &__header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-bottom: 0.75rem;
    border-bottom: var(--border-thin);
  }

  &__kicker {
    color: var(--color-muted-foreground);
  }

  &__hint {
    font-style: italic;
  }

  &__scroll {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 0.25rem;
    min-height: 20rem;
    max-height: 60vh;
    border-top: var(--border-hairline);
    border-bottom: var(--border-hairline);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem;

    p.serif-headline {
      font-size: var(--text-2xl);
    }
  }

  &__input {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.75rem;
    align-items: end;
  }
}

.chat-message {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  &--user {
    align-items: flex-end;

    .chat-message__bubble {
      background: var(--color-foreground);
      color: var(--color-accent-foreground);
      border: 2px solid var(--color-foreground);
      max-width: 75%;
    }
  }

  &--assistant {
    align-items: flex-start;

    .chat-message__bubble {
      background: var(--color-background);
      color: var(--color-foreground);
      border: var(--border-thin);
      max-width: 92%;
    }
  }

  &__bubble {
    padding: 0.875rem 1.125rem;
    border-radius: var(--radius);
  }

  &__text {
    font-size: var(--text-base);
    line-height: 1.625;
    white-space: pre-wrap;
    word-break: break-word;

    &--serif {
      font-family: var(--font-body);
    }
  }

  &__time {
    font-style: italic;
    padding-inline: 0.25rem;
  }

  &__sql {
    margin-top: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__sql-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;

    .label {
      color: var(--color-muted-foreground);
    }
  }

  &__sql-card {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  &__sql-pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
  }

  &__sql-actions {
    display: flex;
    justify-content: flex-end;
  }

  &__exec {
    margin-top: 0.875rem;
  }

  &__exec-meta {
    font-style: italic;
  }

  &__result {
    margin-top: 0.875rem;
  }

  &__result-scroll {
    overflow-x: auto;
    max-height: 22rem;
    overflow-y: auto;
  }

  &__result-cell {
    max-width: 16rem;
    font-size: var(--text-xs);
  }

  &__result-note {
    margin-top: 0.5rem;
    font-style: italic;
  }
}

@media (max-width: 640px) {
  .chat-panel__input {
    grid-template-columns: 1fr;
  }

  .chat-message--user .chat-message__bubble {
    max-width: 100%;
  }

  .chat-message--assistant .chat-message__bubble {
    max-width: 100%;
  }
}
</style>
