<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
  }>(),
  {
    modelValue: '',
    label: '',
    options: () => [],
    placeholder: 'Select…',
  },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div class="app-select">
    <label v-if="label" class="app-select__label label" :for="`select-${label}`">{{ label }}</label>
    <div class="app-select__wrap">
      <select
        :id="`select-${label || 'field'}`"
        class="app-select__field"
        :value="modelValue"
        @change="onChange"
      >
        <option value="" disabled>{{ placeholder }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <span class="app-select__chevron" aria-hidden="true">▾</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-select {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;

  &__label {
    color: var(--color-foreground);
  }

  &__wrap {
    position: relative;
  }

  &__field {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    background: var(--color-background);
    color: var(--color-foreground);
    border: var(--border-medium);
    border-radius: var(--radius);
    padding: 0.625rem 2.25rem 0.625rem 0.75rem;
    font-family: var(--font-body);
    font-size: var(--text-base);
    cursor: pointer;
    transition: border-width var(--duration-fast) var(--ease-instant);

    &:focus {
      border-width: 4px;
      outline: none;
    }
  }

  &__chevron {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--color-foreground);
    font-size: var(--text-xs);
  }
}
</style>
