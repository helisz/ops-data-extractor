<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const EXPAND_KEY = 'home.datacard.expanded';

function readExpanded(): boolean {
  try {
    return localStorage.getItem(EXPAND_KEY) === '1';
  } catch {
    return false;
  }
}

const expanded = ref(readExpanded());

watch(expanded, (v) => {
  try {
    localStorage.setItem(EXPAND_KEY, v ? '1' : '0');
  } catch {
    // storage unavailable — keep in-memory state
  }
});

const modes = [
  {
    title: 'Data Management',
    description:
      'Create projects, upload Excel files, manage versions and explore your data with sorting, filtering and key-value queries.',
    route: '/manage',
  },
  {
    title: 'Data Query',
    description:
      'Open a project to browse its data or ask natural-language questions answered by an LLM that generates and executes SQL.',
    route: '/query',
  },
];

function go(event: MouseEvent, route: string) {  // 保留新标签页/中键/修饰键等浏览器默认行为
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  // SPA 导航；失败时兜底为整页跳转（覆盖 history API 受限等异常环境）
  router.push(route).catch(() => {
    window.location.assign(route);
  });
}
</script>

<template>
  <div class="home texture-noise">
    <section class="container hero">
      <div class="hero__content">
        <p class="label hero__kicker">Faster and More Accurate</p>
        <h1 class="hero__headline">Agents<br />for OPS</h1>
        <div class="hero__rule" aria-hidden="true">
          <span class="hero__square"></span>
        </div>
        <p class="hero__lede">
          A disciplined workspace for structured data — project-based Excel storage,
          versioned datasets, and a conversational query engine, rendered in pure
          black and white.
        </p>
      </div>

      <nav class="hero__links" aria-label="Sections">
        <div class="hero__group">
          <button
            class="hero__toggle"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            <span class="label hero__toggle-index">01</span>
            <span class="serif-headline hero__toggle-title">DataCard Management</span>
            <span
              class="hero__toggle-arrow"
              :class="{ 'hero__toggle-arrow--open': expanded }"
              aria-hidden="true"
              >→</span
            >
          </button>

          <div
            class="hero__subcards-wrap"
            :class="{ 'hero__subcards-wrap--open': expanded }"
          >
            <div class="hero__subcards">
              <a
                v-for="(mode, i) in modes"
                :key="mode.title"
                class="mode-card"
                :href="mode.route"
                @click="go($event, mode.route)"
              >
                <span class="label mode-card__index">{{ i + 1 }}</span>
                <span class="serif-headline mode-card__title">{{ mode.title }}</span>
                <span class="mode-card__desc">{{ mode.description }}</span>
                <span class="mode-card__cta">Open <span class="arrow" aria-hidden="true">→</span></span>
              </a>
            </div>
          </div>
        </div>

        <a class="hero__config-btn" href="/config" @click="go($event, '/config')">
          Configuration <span class="arrow" aria-hidden="true">→</span>
        </a>
      </nav>
    </section>

    <footer class="container home-footer">
      <hr class="rule-thick" />
      <p class="meta home-footer__text">APD Chris Production</p>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.hero {
  flex: 1;
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 4rem;
  align-items: center;
  padding-top: 4rem;
  padding-bottom: 4rem;

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

  &__links {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  &__group {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1.25rem;
  }

  &__toggle {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    padding: 3rem 1rem;
    background: none;
    border: none;
    border-top: var(--border-medium);
    border-bottom: var(--border-medium);
    cursor: pointer;
    text-align: left;
    color: var(--color-foreground);
    transition:
      background-color 0.25s ease,
      color 0.25s ease;

    &-index {
      color: var(--color-muted-foreground);
      transition: color 0.25s ease;
    }

    &-title {
      font-size: var(--text-3xl);
    }

    &-arrow {
      font-size: var(--text-2xl);
      transition: transform 0.25s ease;

      &--open {
        transform: rotate(90deg);
      }
    }

    &:hover,
    &:focus-visible {
      background: var(--color-foreground);
      color: var(--color-accent-foreground);

      .hero__toggle-index {
        color: var(--color-background);
        opacity: 0.7;
      }
    }

    &:focus-visible {
      outline: var(--focus-outline);
      outline-offset: 3px;
    }
  }

  &__subcards-wrap {
    display: grid;
    grid-template-rows: 0fr;
    width: 85%;
    margin-left: auto;
    transition: grid-template-rows 0.45s cubic-bezier(0.4, 0, 0.2, 1);

    &--open {
      grid-template-rows: 1fr;
    }
  }

  &__subcards {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    overflow: hidden;
    opacity: 0;
    transform: translateY(-8px);
    visibility: hidden;
    transition:
      opacity 0.3s ease,
      transform 0.3s ease,
      visibility 0s linear 0.3s;

    .hero__subcards-wrap--open & {
      overflow: visible;
      opacity: 1;
      transform: none;
      visibility: visible;
      transition:
        opacity 0.3s ease,
        transform 0.3s ease;
    }
  }
}

.mode-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--color-background);
  color: var(--color-card-foreground);
  border: var(--border-thin);
  text-decoration: none;
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease;

  &__index {
    color: var(--color-muted-foreground);
    transition: color 0.25s ease;
  }

  &__title {
    font-size: var(--text-xl);
  }

  &__desc {
    font-size: var(--text-sm);
    line-height: 1.625;
    opacity: 0.85;
  }

  &__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
  }

  .arrow {
    display: inline-block;
    transition: transform 0.25s ease;
  }

  &:hover,
  &:focus-visible {
    background: var(--color-card);
    color: var(--color-card-foreground);
    border-color: var(--color-foreground);
    transform: translateY(-3px);

    .mode-card__index {
      color: var(--color-muted-foreground);
      opacity: 0.7;
    }

    .mode-card__desc {
      opacity: 0.85;
    }

    .arrow {
      transform: translateX(6px);
    }
  }

  &:focus-visible {
    outline: var(--focus-outline);
    outline-offset: 3px;
  }
}

.hero__config-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 44px;
  padding: 0.625rem 1.5rem;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  line-height: 1;
  text-decoration: none;
  color: var(--color-foreground);
  background: transparent;
  border: 2px solid var(--color-foreground);
  border-radius: var(--radius);
  transition:
    background-color 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;

  .arrow {
    display: inline-block;
    transition: transform 0.25s ease;
  }

  &:hover,
  &:focus-visible {
    background: var(--color-foreground);
    color: var(--color-accent-foreground);
    transform: translateY(-3px);

    .arrow {
      transform: translateX(6px);
    }
  }

  &:focus-visible {
    outline: var(--focus-outline);
    outline-offset: 3px;
  }
}

.home-footer {
  padding-top: 1.5rem;
  padding-bottom: 2.5rem;

  &__text {
    padding-top: 1.25rem;
    font-style: italic;
  }
}

@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 2.5rem;
    padding-top: 2.5rem;
  }
}

@media (max-width: 640px) {
  .hero {
    &__headline {
      font-size: var(--text-5xl);
    }
  }
}
</style>
