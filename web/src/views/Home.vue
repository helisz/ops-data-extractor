<script setup lang="ts">
import { useRouter } from 'vue-router';
import { AppButton, AppCard } from '@/components/ui';

const router = useRouter();

const modes = [
  {
    title: 'Data Management',
    description:
      'Create projects, upload Excel files, manage versions and explore your data with sorting, filtering and key-value queries.',
    route: '/manage',
    cta: 'Open',
  },
  {
    title: 'Data Query',
    description:
      'Open a project to browse its data or ask natural-language questions answered by an LLM that generates and executes SQL.',
    route: '/query',
    cta: 'Open',
  },
];
</script>

<template>
  <div class="home texture-noise">
    <section class="container hero">
      <p class="label hero__kicker">Data Management System</p>
      <h1 class="hero__headline">Data<br />Management</h1>
      <div class="hero__rule" aria-hidden="true">
        <span class="hero__square"></span>
      </div>
      <p class="hero__lede">
        A disciplined workspace for structured data — project-based Excel storage,
        versioned datasets, and a conversational query engine, rendered in pure
        black and white.
      </p>
    </section>

    <section class="container modes">
      <AppCard
        v-for="mode in modes"
        :key="mode.title"
        class="mode-card"
        hover
        @click="router.push(mode.route)"
      >
        <div class="mode-card__body">
          <p class="label mode-card__index">{{ modes.indexOf(mode) + 1 }}</p>
          <h2 class="serif-headline mode-card__title">{{ mode.title }}</h2>
          <p class="mode-card__desc">{{ mode.description }}</p>
          <AppButton variant="ghost" class="mode-card__cta">{{ mode.cta }} →</AppButton>
        </div>
      </AppCard>
    </section>

    <section class="container config-links">
      <hr class="rule-thick" />
      <div class="config-links__row">
        <p class="meta">System configuration — LLM endpoint, key and model</p>
        <AppButton variant="ghost" @click="router.push('/config')">Configuration →</AppButton>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.home {
  flex: 1;
}

.hero {
  padding-top: 4rem;
  padding-bottom: 3rem;

  &__kicker {
    color: var(--color-muted-foreground);
    margin-bottom: 1.5rem;
  }

  &__headline {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-8xl);
    line-height: 0.9;
    letter-spacing: var(--tracking-tighter);
  }

  &__rule {
    margin-top: 2.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__square {
    width: 16px;
    height: 16px;
    border: 3px solid var(--color-foreground);
    flex-shrink: 0;
  }

  &__rule::after {
    content: '';
    flex: 1;
    height: 4px;
    background: var(--color-foreground);
  }

  &__lede {
    margin-top: 1.5rem;
    max-width: 36rem;
    font-size: var(--text-xl);
    line-height: 1.625;
  }
}

.modes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  padding-bottom: 4rem;
}

.mode-card {
  display: flex;
  flex-direction: column;

  :deep(.mode-card__body) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  &__index {
    color: var(--color-muted-foreground);
  }

  &__title {
    font-size: var(--text-3xl);
  }

  &__desc {
    font-size: var(--text-base);
    line-height: 1.625;
    opacity: 0.85;
  }

  &__cta {
    margin-top: auto;
    align-self: flex-start;
  }
}

.config-links {
  padding-bottom: 4rem;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 1.25rem;
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .hero {
    padding-top: 2.5rem;

    &__headline {
      font-size: var(--text-5xl);
    }
  }

  .modes {
    grid-template-columns: 1fr;
  }
}
</style>
