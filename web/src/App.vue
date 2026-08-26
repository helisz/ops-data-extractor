<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { SunIcon, MoonIcon } from '@heroicons/vue/24/outline';

const route = useRoute();
const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const isDark = ref(false);

const isDataRoute = computed(
  () => route.path.startsWith('/manage') || route.path.startsWith('/query'),
);

function applyTheme(dark: boolean) {
  isDark.value = dark;
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  applyTheme(!isDark.value);
}

function onDocClick(event: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    menuOpen.value = false;
  }
}

onMounted(() => {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(stored ? stored === 'dark' : prefersDark);
  document.addEventListener('click', onDocClick);
});
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div class="site-frame">
    <header class="site-header">
      <div class="container site-header-inner">
        <router-link to="/" class="brand" aria-label="Agents for OPS home">
          <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect
              x="1.5"
              y="1.5"
              width="29"
              height="29"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            />
            <line x1="8" y1="24" x2="24" y2="8" stroke="currentColor" stroke-width="2.5" />
            <circle cx="24" cy="8" r="3.5" fill="currentColor" />
          </svg>
          <span class="brand-name">Agents&nbsp;for&nbsp;OPS</span>
        </router-link>
        <div class="site-header-right">
          <nav class="site-nav" aria-label="Primary">
            <div ref="menuRef" class="site-nav__menu">
              <button
                class="site-nav__trigger"
                :class="{ 'site-nav__trigger--active': isDataRoute }"
                :aria-expanded="menuOpen"
                @click="menuOpen = !menuOpen"
              >
                Data Card
                <span
                  class="site-nav__caret"
                  :class="{ 'site-nav__caret--open': menuOpen }"
                  aria-hidden="true"
                  >▾</span
                >
              </button>
              <transition name="menu">
                <div v-if="menuOpen" class="site-nav__dropdown">
                  <router-link to="/manage" class="nav-link" @click="menuOpen = false">
                    Manage
                  </router-link>
                  <router-link to="/query" class="nav-link" @click="menuOpen = false">
                    Query
                  </router-link>
                </div>
              </transition>
            </div>
            <router-link to="/config" class="nav-link">Config</router-link>
          </nav>
          <button
            class="theme-toggle"
            :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="toggleTheme"
          >
            <SunIcon v-if="isDark" class="theme-toggle__icon" aria-hidden="true" />
            <MoonIcon v-else class="theme-toggle__icon" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
    <main id="main-content" class="site-main">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped lang="scss">
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: 0.75rem 1.5rem;
  background: var(--color-foreground);
  color: var(--color-background);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  text-decoration: none;

  &:focus-visible {
    left: 0;
    outline: 3px solid var(--color-foreground);
    outline-offset: 3px;
  }
}

.site-frame {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-header {
  border-bottom: var(--border-medium);
  background: var(--color-background);
  position: sticky;
  top: 0;
  z-index: 50;
}

.site-header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.site-header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: var(--color-foreground);

  &:focus-visible {
    outline: 3px solid var(--color-foreground);
    outline-offset: 3px;
  }
}

.brand-mark {
  width: 22px;
  height: 22px;
  color: var(--color-foreground);
  flex-shrink: 0;
}

.brand-name {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
}

.site-nav {
  display: flex;
  gap: 0.25rem;

  .nav-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.5rem 0.875rem;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-muted-foreground);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    transition: color var(--duration-fast), border-color var(--duration-fast);

    &:hover {
      color: var(--color-foreground);
      border-bottom-color: var(--color-foreground);
    }

    &:focus-visible {
      outline: 3px solid var(--color-foreground);
      outline-offset: 3px;
    }

    &.router-link-active {
      color: var(--color-foreground);
      border-bottom-color: var(--color-foreground);
      font-weight: 500;
    }
  }

  &__menu {
    position: relative;
    display: inline-flex;
  }

  &__trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.5rem 0.875rem;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-muted-foreground);
    background: none;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color var(--duration-fast), border-color var(--duration-fast);

    &:hover {
      color: var(--color-foreground);
    }

    &--active {
      color: var(--color-foreground);
      border-bottom-color: var(--color-foreground);
      font-weight: 500;
    }

    &:focus-visible {
      outline: 3px solid var(--color-foreground);
      outline-offset: 3px;
    }
  }

  &__caret {
    font-size: 0.75em;
    transition: transform var(--duration-fast);

    &--open {
      transform: rotate(180deg);
    }
  }

  &__dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    min-width: 11rem;
    padding: 0.25rem 0;
    background: var(--color-background);
    border: var(--border-thin);

    .nav-link {
      min-height: 40px;
      padding: 0.5rem 1rem;
      border-bottom: none;

      &.router-link-active {
        background: var(--color-muted);
        border-bottom: none;
      }
    }
  }
}

.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.site-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.page-enter-active,
.page-leave-active {
  transition: opacity var(--duration-fast);
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .brand-name {
    font-size: var(--text-base);
  }

  .site-nav {
    gap: 0;
  }

  .nav-link {
    padding: 0.5rem 0.5rem;
  }
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: none;
  border: 2px solid transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color var(--duration-fast),
    border-color var(--duration-fast);

  &:hover {
    color: var(--color-foreground);
    border-color: var(--color-foreground);
  }

  &:focus-visible {
    outline: var(--focus-outline);
    outline-offset: 3px;
  }

  &__icon {
    width: 1.25rem;
    height: 1.25rem;
  }
}
</style>
