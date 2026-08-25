<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'outline' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false,
    loading: false,
  },
);

const emit = defineEmits<{ (e: 'click', event: MouseEvent): void }>();

function onClick(event: MouseEvent) {
  emit('click', event);
}
</script>

<template>
  <button
    :type="type"
    class="app-button"
    :class="`app-button--${variant}`"
    :disabled="disabled || loading"
    @click="onClick"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true"></span>
    <slot />
  </button>
</template>

<style scoped lang="scss">
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 44px;
  padding: 0.625rem 1.5rem;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  border-radius: var(--radius);
  transition:
    background-color var(--duration-fast) var(--ease-instant),
    color var(--duration-fast) var(--ease-instant),
    border-color var(--duration-fast) var(--ease-instant);

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    animation: app-button-spin 0.8s linear infinite;
  }

  &--primary {
    background: var(--color-foreground);
    color: var(--color-accent-foreground);
    border: 2px solid var(--color-foreground);

    &:hover:not(:disabled) {
      background: var(--color-background);
      color: var(--color-foreground);
    }
  }

  &--outline {
    background: transparent;
    color: var(--color-foreground);
    border: 2px solid var(--color-foreground);

    &:hover:not(:disabled) {
      background: var(--color-foreground);
      color: var(--color-accent-foreground);
    }
  }

  &--ghost {
    background: transparent;
    color: var(--color-foreground);
    border: 2px solid transparent;
    padding-inline: 0.5rem;

    &:hover:not(:disabled) {
      text-decoration: underline;
      text-underline-offset: 4px;
    }
  }
}

@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
