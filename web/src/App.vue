<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div class="site-frame">
    <header class="site-header">
      <div class="container site-header-inner">
        <router-link to="/" class="brand" aria-label="Data Management home">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">Data&nbsp;Management</span>
        </router-link>
        <nav class="site-nav" aria-label="Primary">
          <router-link to="/manage" class="nav-link">Manage</router-link>
          <router-link to="/query" class="nav-link">Query</router-link>
          <router-link to="/config" class="nav-link">Config</router-link>
        </nav>
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
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-foreground);
  background: var(--color-background);
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
    font-size: var(--text-xs);
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
</style>
