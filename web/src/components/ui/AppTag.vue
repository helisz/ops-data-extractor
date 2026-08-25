<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'default' | 'muted' | 'inverted' }>(), {
  variant: 'default',
});
</script>

<template>
  <span class="app-tag" :class="`app-tag--${variant}`">
    <slot />
  </span>
</template>

<style scoped lang="scss">
.app-tag {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0.125rem 0.5rem;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  line-height: 1;
  border-radius: var(--radius);
  white-space: nowrap;

  &--default {
    border: var(--border-thin);
    color: var(--color-foreground);
    background: var(--color-background);
  }

  &--muted {
    border: var(--border-thin);
    color: var(--color-muted-foreground);
    background: var(--color-muted);
  }

  &--inverted {
    border: 2px solid var(--color-foreground);
    color: var(--color-accent-foreground);
    background: var(--color-foreground);
  }
}
</style>
