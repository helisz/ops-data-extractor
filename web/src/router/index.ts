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
      path: '/data',
      redirect: '/data/manage',
      children: [
        {
          path: 'manage',
          name: 'manage',
          component: () => import('@/views/Manage.vue'),
          meta: { title: 'Data Management' },
        },
        {
          path: 'manage/:id',
          name: 'project-detail',
          component: () => import('@/views/ProjectDetail.vue'),
          meta: { title: 'Project Detail' },
        },
        {
          path: 'query',
          name: 'query',
          component: () => import('@/views/Query.vue'),
          meta: { title: 'Data Query' },
        },
        {
          path: 'query/:id',
          name: 'query-project',
          component: () => import('@/views/QueryProject.vue'),
          meta: { title: 'Project Query' },
        },
        {
          path: 'query/:id/ask',
          name: 'query-project-ask',
          component: () => import('@/views/QueryProject.vue'),
          meta: { title: 'Project Ask' },
        },
      ],
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('@/views/Config.vue'),
      meta: { title: 'Configuration' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFound.vue'),
      meta: { title: '404 Not Found' },
    },
  ],
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : '';
  document.title = title ? `${title} · Data Management` : 'Data Management';
});

export default router;
