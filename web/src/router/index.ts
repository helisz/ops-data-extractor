import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/Home.vue'),
      meta: { title: 'Home' },
    },
    {
      path: '/manage',
      name: 'manage',
      component: () => import('@/views/Manage.vue'),
      meta: { title: 'Data Management' },
    },
    {
      path: '/manage/:id',
      name: 'project-detail',
      component: () => import('@/views/ProjectDetail.vue'),
      meta: { title: 'Project Detail' },
    },
    {
      path: '/query',
      name: 'query',
      component: () => import('@/views/Query.vue'),
      meta: { title: 'Data Query' },
    },
    {
      path: '/query/:id',
      name: 'query-project',
      component: () => import('@/views/QueryProject.vue'),
      meta: { title: 'Project Query' },
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('@/views/Config.vue'),
      meta: { title: 'Configuration' },
    },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : '';
  document.title = title ? `${title} · Data Management` : 'Data Management';
});

export default router;
