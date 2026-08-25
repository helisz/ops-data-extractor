<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' });
</script>

<template>
  <div class="app-spinner" role="status" :aria-label="label">
    <span class="app-spinner__ring" aria-hidden="true"></span>
    <span v-if="label" class="app-spinner__label meta">{{ label }}</span>
  </div>
</template>

<style scoped lang="scss">
.app-spinner {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;

  &__ring {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-foreground);
    border-top-color: transparent;
    border-radius: 50%;
    animation: app-spinner-rotate 0.8s linear infinite;
    flex-shrink: 0;
  }

  &__label {
    color: var(--color-muted-foreground);
  }
}

@keyframes app-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>
