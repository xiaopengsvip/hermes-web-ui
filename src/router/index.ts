import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () => import('@/views/JobsView.vue'),
    },
    {
      path: '/materials',
      name: 'materials',
      component: () => import('@/views/MaterialsView.vue'),
    },
    {
      path: '/project-center',
      name: 'projectCenter',
      component: () => import('@/views/ProjectCenterView.vue'),
    },
    {
      path: '/config-center',
      name: 'configCenter',
      component: () => import('@/views/ConfigCenterView.vue'),
    },
    {
      path: '/skills',
      name: 'skills',
      component: () => import('@/views/SkillsView.vue'),
    },
    {
      path: '/memory',
      name: 'memory',
      component: () => import('@/views/MemoryView.vue'),
    },
    {
      path: '/insights',
      name: 'insights',
      component: () => import('@/views/InsightsView.vue'),
    },
    {
      path: '/audit',
      redirect: { name: 'insights', query: { tab: 'audit' } },
    },
    {
      path: '/reports',
      redirect: { name: 'insights', query: { tab: 'reports' } },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/views/LogsView.vue'),
    },
    {
      path: '/github',
      name: 'github',
      component: () => import('@/views/GitHubView.vue'),
    },
    {
      path: '/vercel',
      name: 'vercel',
      component: () => import('@/views/VercelView.vue'),
    },
    {
      path: '/cloudflare',
      name: 'cloudflare',
      component: () => import('@/views/CloudflareView.vue'),
    },
    {
      path: '/terminal',
      redirect: { name: 'chat', query: { panel: 'terminal' } },
    },
    {
      path: '/services',
      name: 'services',
      component: () => import('@/views/ServicesView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    {
      path: '/version',
      name: 'version',
      component: () => import('@/views/VersionView.vue'),
    },
  ],
})

export default router
