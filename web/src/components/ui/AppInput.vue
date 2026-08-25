<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string;
    label?: string;
    type?: string;
    placeholder?: string;
    textarea?: boolean;
    rows?: number;
    autocomplete?: string;
  }>(),
  {
    modelValue: '',
    label: '',
    type: 'text',
    placeholder: '',
    textarea: false,
    rows: 3,
    autocomplete: 'off',
  },
);

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div class="app-input">
    <label v-if="label" class="app-input__label label" :for="`input-${label}`">{{ label }}</label>
    <textarea
      v-if="textarea"
      :id="`input-${label || 'field'}`"
      class="app-input__field"
      :rows="rows"
      :placeholder="placeholder"
      :value="modelValue"
      @input="onInput"
    ></textarea>
    <input
      v-else
      :id="`input-${label || 'field'}`"
      class="app-input__field"
      :type="type"
      :placeholder="placeholder"
      :value="modelValue"
      :autocomplete="autocomplete"
      @input="onInput"
    />
  </div>
</template>

<style scoped lang="scss">
.app-input {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;

  &__label {
    color: var(--color-foreground);
  }

  &__field {
    width: 100%;
    background: var(--color-background);
    color: var(--color-foreground);
    border: var(--border-medium);
    border-radius: var(--radius);
    padding: 0.625rem 0.75rem;
    font-family: var(--font-body);
    font-size: var(--text-base);
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

    &:disabled {
      opacity: 0.5;
    }
  }
}
</style>
