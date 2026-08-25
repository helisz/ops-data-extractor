<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import axios from 'axios';
import { postChatMessage, getChatHistory, getChatSessionMessages, errMessage } from '@/api';
import type { ChatMessage } from '@/api/types';
import { AppButton, AppAlert, AppSpinner } from '@/components/ui';

const props = withDefaults(
  defineProps<{ projectId: number; projectName: string; sessionId?: number | null }>(),
  { sessionId: null },
);

const messages = ref<ChatMessage[]>([]);
const input = ref('');
const sending = ref(false);
const error = ref<string | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const totalTimes = ref<Map<number, number>>(new Map());
let abortController: AbortController | null = null;

// Custom textarea resize: drag the top border upward (max 300px).
const MAX_INPUT_HEIGHT = 300;
const inputHeight = ref(0); // 0 = auto height from rows
let resizeDrag: { y: number; height: number } | null = null;

function currentInputHeight(): number {
  return inputHeight.value > 0 ? inputHeight.value : 60;
}

function startResize(event: MouseEvent) {
  resizeDrag = { y: event.clientY, height: currentInputHeight() };
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', endResize);
  event.preventDefault();
}

function onResizeMove(event: MouseEvent) {
  if (!resizeDrag) return;
  const delta = resizeDrag.y - event.clientY; // dragging up grows the box
  inputHeight.value = Math.min(
    MAX_INPUT_HEIGHT,
    Math.max(40, resizeDrag.height + delta),
  );
}

function endResize() {
  resizeDrag = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', endResize);
}

// Stop the in-flight LLM request.
function stop() {
  abortController?.abort();
}

function onSendClick(event: MouseEvent) {
  if (sending.value) {
    event.preventDefault();
    stop();
  }
}

async function scrollToBottom() {
  await nextTick();
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

async function loadHistory() {
  error.value = null;
  try {
    if (props.sessionId != null) {
      messages.value = await getChatSessionMessages(props.projectId, props.sessionId);
    } else {
      messages.value = await getChatHistory(props.projectId);
    }
    await scrollToBottom();
  } catch (err) {
    error.value = errMessage(err, 'Failed to load chat history.');
  }
}

watch(
  () => props.sessionId,
  () => {
    messages.value = [];
    loadHistory();
  },
);

async function send() {
  const text = input.value.trim();
  if (!text || sending.value) return;
  sending.value = true;
  error.value = null;
  abortController = new AbortController();
  const sentAt = Date.now();

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
    const res = await postChatMessage(
      props.projectId,
      text,
      props.sessionId,
      abortController.signal,
    );
    const assistantMsg: ChatMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: res.assistantText || (res.execution.error ? null : ''),
      sql: res.sql,
      execution: res.execution,
      result: res.result,
      created_at: new Date().toISOString(),
    };
    totalTimes.value.set(assistantMsg.id, Date.now() - sentAt);
    messages.value = [...messages.value, assistantMsg];
    await scrollToBottom();
  } catch (err) {
    if (axios.isCancel(err)) {
      error.value = 'Stopped.';
    } else {
      error.value = errMessage(err, 'Failed to get a response.');
      messages.value = messages.value.filter((m) => m.id !== userMsg.id);
    }
  } finally {
    abortController = null;
    sending.value = false;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString();
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(2)} s`;
}

// Split a message body into plain text and fenced code blocks.
function splitContent(
  content: string,
): Array<{ type: 'text' | 'code'; text: string }> {
  const parts: Array<{ type: 'text' | 'code'; text: string }> = [];
  const regex = /```(?:sql)?\s*([\s\S]*?)```/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', text: content.slice(last, m.index) });
    }
    parts.push({ type: 'code', text: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    parts.push({ type: 'text', text: content.slice(last) });
  }
  if (parts.length === 0) parts.push({ type: 'text', text: content });
  return parts;
}

onMounted(loadHistory);

defineExpose({ messageCount: computed(() => messages.value.length) });
</script>

<template>
  <div class="chat-panel">
    
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
            <template v-if="msg.content">
              <template v-for="(part, i) in splitContent(msg.content)" :key="i">
                <p
                  v-if="part.type === 'text'"
                  class="chat-message__text chat-message__text--serif"
                >
                  {{ part.text }}
                </p>
                <pre v-else class="chat-message__sql-pre">{{ part.text }}</pre>
              </template>
            </template>

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
        <p class="chat-message__time meta">
          {{ formatDate(msg.created_at) }}
          <template v-if="msg.role === 'assistant' && totalTimes.has(msg.id)">
            · total {{ formatSeconds(totalTimes.get(msg.id) ?? 0) }}
          </template>
        </p>
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
    >
      <div
        class="chat-panel__resize"
        title="Drag up to resize"
        @mousedown="startResize"
      ></div>
      <textarea
        v-model="input"
        class="chat-panel__textarea"
        :rows="2"
        :style="inputHeight > 0 ? { height: inputHeight + 'px' } : undefined"
        placeholder="Ask about the data…"
        @keydown.enter.exact.prevent="send"
      ></textarea>
      <AppButton type="submit" @click="onSendClick">
        {{ sending ? 'STOP' : 'Send' }}
      </AppButton>
    </form>
  </div>
</template>

<style scoped lang="scss">
.chat-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
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
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 0.25rem;
    border-top: var(--border-hairline);
    border-bottom: var(--border-hairline);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
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

  &__resize {
    grid-column: 1 / -1;
    height: 8px;
    cursor: ns-resize;
    border-top: var(--border-hairline);
    transition: border-color var(--duration-fast);

    &:hover {
      border-top-color: var(--color-foreground);
    }

    &:active {
      border-top-color: var(--color-foreground);
    }
  }

  &__textarea {
    resize: none;
    width: 100%;
    min-height: 44px;
    max-height: 300px;
    background: var(--color-background);
    color: var(--color-foreground);
    border: var(--border-medium);
    border-radius: var(--radius);
    padding: 0.625rem 0.75rem;
    font-family: var(--font-body);
    font-size: var(--text-base);
    line-height: 1.5;
    transition: border-width var(--duration-fast) var(--ease-instant);

    &::placeholder {
      color: var(--color-muted-foreground);
      font-style: italic;
      opacity: 1;
    }

    &:focus {
      border-width: 4px;
      outline: none;
    }
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

  &__sql-pre {
    margin: 0;
    padding: 0.75rem;
    background: var(--color-muted);
    border-left: var(--border-thin);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: auto;
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
