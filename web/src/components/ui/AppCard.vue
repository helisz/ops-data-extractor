<script setup lang="ts">
withDefaults(
  defineProps<{
    inverted?: boolean;
    borderless?: boolean;
    hover?: boolean;
  }>(),
  {
    inverted: false,
    borderless: false,
    hover: false,
  },
);
</script>

<template>
  <div
    class="app-card"
    :class="{
      'app-card--inverted': inverted,
      'app-card--borderless': borderless,
      'app-card--hover': hover,
    }"
  >
    <slot />
  </div>
</template>

<style scoped lang="scss">
.app-card {
  background: var(--color-card);
  color: var(--color-card-foreground);
  border: var(--border-thin);
  border-radius: var(--radius);
  padding: 1.5rem;

  &--borderless {
    border: none;
    padding: 0;
  }

  &--inverted {
    background: var(--color-foreground);
    color: var(--color-accent-foreground);
    border-color: var(--color-foreground);
  }

  &--hover {
    cursor: pointer;
    transition:
      background-color var(--duration-fast) var(--ease-instant),
      color var(--duration-fast) var(--ease-instant),
      border-color var(--duration-fast) var(--ease-instant);

    &:hover {
      background: var(--color-foreground);
      color: var(--color-accent-foreground);
      border-color: var(--color-foreground);
    }
  }
}
</style>
