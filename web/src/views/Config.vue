<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { AppButton, AppInput, AppCard, AppAlert, AppSpinner } from '@/components/ui';
import {
  verifyConfigPassword,
  getConfig,
  updateConfig,
  errMessage,
} from '@/api';

const router = useRouter();

const locked = ref(true);
const password = ref('');
const unlocking = ref(false);

const baseUrl = ref('');
const apiKey = ref('');
const model = ref('');
const hasApiKey = ref(false);
const loading = ref(false);
const saving = ref(false);
const alert = ref<{ variant: 'success' | 'error'; message: string } | null>(null);

async function unlock() {
  unlocking.value = true;
  alert.value = null;
  try {
    const { token } = await verifyConfigPassword(password.value);
    sessionStorage.setItem('configToken', token);
    locked.value = false;
    await loadConfig();
  } catch (err) {
    alert.value = { variant: 'error', message: errMessage(err, 'Unable to unlock configuration.') };
  } finally {
    unlocking.value = false;
  }
}

async function loadConfig() {
  loading.value = true;
  try {
    const cfg = await getConfig();
    baseUrl.value = cfg.baseUrl;
    model.value = cfg.model;
    hasApiKey.value = cfg.hasApiKey;
  } catch (err) {
    alert.value = { variant: 'error', message: errMessage(err, 'Failed to load configuration.') };
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  alert.value = null;
  try {
    await updateConfig({
      baseUrl: baseUrl.value,
      apiKey: apiKey.value,
      model: model.value,
    });
    apiKey.value = '';
    const cfg = await getConfig();
    hasApiKey.value = cfg.hasApiKey;
    alert.value = { variant: 'success', message: 'Settings saved successfully.' };
  } catch (err) {
    alert.value = { variant: 'error', message: errMessage(err, 'Failed to save settings.') };
  } finally {
    saving.value = false;
  }
}

function lock() {
  sessionStorage.removeItem('configToken');
  locked.value = true;
  password.value = '';
  alert.value = null;
}

onMounted(() => {
  if (sessionStorage.getItem('configToken')) {
    locked.value = false;
    loadConfig();
  }
});
</script>

<template>
  <div class="config container">
    <header class="config__header">
      <div class="page-head">
        <button class="page-back" aria-label="Back to home" @click="router.push('/')">←</button>
        <h1 class="serif-headline config__title">Configuration</h1>
      </div>
      <hr class="rule-thick" />
    </header>

    <div v-if="locked" class="config__gate">
      <AppCard class="config__gate-card">
        <p class="label config__gate-label">Protected Area</p>
        <p class="config__gate-desc">
          This page controls the LLM settings used by Ask mode. Enter the
          configuration password to continue.
        </p>
        <form @submit.prevent="unlock">
          <AppInput
            v-model="password"
            label="Password"
            type="password"
            placeholder="Enter configuration password"
            autocomplete="current-password"
          />
          <AppButton type="submit" :loading="unlocking" class="config__unlock">Unlock</AppButton>
        </form>
        <AppAlert v-if="alert" :variant="alert.variant">{{ alert.message }}</AppAlert>
      </AppCard>
    </div>

    <div v-else class="config__settings">
      <AppCard class="config__settings-card">
        <template v-if="loading">
          <AppSpinner label="Loading settings…" />
        </template>
        <template v-else>
          <div class="config__settings-head">
            <h2 class="serif-headline config__settings-title">LLM Settings</h2>
            <AppButton variant="ghost" @click="lock">Lock</AppButton>
          </div>
          <form class="config__form" @submit.prevent="save">
            <AppInput
              v-model="baseUrl"
              label="Base URL"
              placeholder="https://api.openai.com/v1"
            />
            <AppInput
              v-model="apiKey"
              label="API Key"
              type="password"
              :placeholder="hasApiKey ? '••• saved — leave blank to keep' : 'Paste your API key'"
              autocomplete="new-password"
            />
            <AppInput v-model="model" label="Model" placeholder="gpt-4o-mini" />
            <div class="config__actions">
              <AppButton type="submit" :loading="saving">Save</AppButton>
              <p class="meta config__hint">
                {{ hasApiKey ? 'API key is set.' : 'No API key stored yet.' }}
              </p>
            </div>
          </form>
          <AppAlert v-if="alert" :variant="alert.variant">{{ alert.message }}</AppAlert>
        </template>
      </AppCard>
    </div>
  </div>
</template>

<style scoped lang="scss">
.config {
  padding-top: 3rem;
  padding-bottom: 4rem;

  &__header {
    margin-bottom: 2.5rem;
  }

  &__title {
    font-size: var(--text-5xl);
  }

  &__gate {
    max-width: 34rem;
  }

  &__gate-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__gate-label {
    color: var(--color-muted-foreground);
  }

  &__gate-desc {
    line-height: 1.625;
  }

  &__unlock {
    margin-top: 1.25rem;
  }

  &__settings-card {
    max-width: 40rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__settings-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__settings-title {
    font-size: var(--text-2xl);
  }

  &__form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  &__hint {
    font-style: italic;
  }
}
</style>
