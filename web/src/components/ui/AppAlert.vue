<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'info' | 'success' | 'error';
    title?: string;
  }>(),
  {
    variant: 'info',
    title: '',
  },
);
</script>

<template>
  <div class="app-alert" :class="`app-alert--${variant}`" role="alert">
    <span class="app-alert__label label">{{ title || variant }}</span>
    <div class="app-alert__message"><slot /></div>
  </div>
</template>

<style scoped lang="scss">
.app-alert {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 1rem 1.25rem;
  border: var(--border-thin);
  border-radius: var(--radius);
  background: var(--color-background);

  &__label {
    color: var(--color-muted-foreground);
  }

  &__message {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    color: var(--color-foreground);
    word-break: break-word;
  }

  // Monochrome treatments — emphasis via inversion, never color
  &--error {
    border: var(--border-medium);
    background: var(--color-foreground);
    border-color: var(--color-foreground);

    .app-alert__label {
      color: var(--color-background);
    }

    .app-alert__message {
      color: var(--color-background);
    }
  }

  &--success {
    border: var(--border-medium);
  }
}
</style>
