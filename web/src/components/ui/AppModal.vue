<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    wide?: boolean;
  }>(),
  { title: '', wide: false },
);

const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>();

const panelRef = ref<HTMLElement | null>(null);

function close() {
  emit('update:open', false);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) close();
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // focus the panel
      requestAnimationFrame(() => panelRef.value?.focus());
    } else {
      document.body.style.overflow = '';
    }
  },
);

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="app-modal">
      <div class="app-modal__scrim" @click="close"></div>
      <div
        ref="panelRef"
        class="app-modal__panel"
        :class="{ 'app-modal__panel--wide': wide }"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Dialog'"
        tabindex="-1"
      >
        <header class="app-modal__header">
          <h2 class="app-modal__title serif-headline">
            <slot name="title">{{ title }}</slot>
          </h2>
          <button class="app-modal__close" aria-label="Close dialog" @click="close">×</button>
        </header>
        <div class="app-modal__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="app-modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.app-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;

  &__scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
  }

  &__panel {
    position: relative;
    width: 100%;
    max-width: 34rem;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--color-card);
    border: var(--border-thin);
    border-radius: var(--radius);
    outline: none;

    &--wide {
      max-width: 68rem;
    }
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: var(--border-thin);
  }

  &__title {
    font-size: var(--text-2xl);
  }

  &__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    background: transparent;
    border: none;
    font-size: 1.75rem;
    line-height: 1;
    color: var(--color-foreground);
    cursor: pointer;
    transition: background-color var(--duration-fast), color var(--duration-fast);

    &:hover {
      background: var(--color-foreground);
      color: var(--color-background);
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: var(--focus-offset);
    }
  }

  &__body {
    padding: 1.5rem;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: var(--border-hairline);
  }
}
</style>
