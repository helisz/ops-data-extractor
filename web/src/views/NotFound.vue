<script setup lang="ts">
import { useRouter } from 'vue-router';
import { AppButton } from '@/components/ui';

const router = useRouter();
</script>

<template>
  <div class="not-found container">
    <div class="not-found__content">
      <p class="label not-found__code">404</p>
      <h1 class="serif-headline not-found__title">Page Not Found</h1>
      <p class="not-found__desc">
        The page you are looking for does not exist or has been moved.
      </p>
      <AppButton variant="primary" @click="router.push('/')">
        Back to Home
      </AppButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.not-found {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;

  &__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  &__code {
    font-size: var(--text-2xl);
    color: var(--color-muted-foreground);
  }

  &__title {
    font-size: var(--text-5xl);
  }

  &__desc {
    font-size: var(--text-base);
    line-height: 1.625;
    color: var(--color-muted-foreground);
    max-width: 28rem;
  }
}
</style>
