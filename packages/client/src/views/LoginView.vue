<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { setApiKey, hasApiKey } from "@/api/client";
import { fetchAuthStatus, loginWithPassword } from "@/api/auth";

const { t } = useI18n();
const router = useRouter();

const username = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");
const showLockResetHint = ref(false);

// If already has a key, try to go to main page
if (hasApiKey()) {
  router.replace("/hermes/chat");
}

onMounted(async () => {
  try {
    await fetchAuthStatus();
  } catch {
    // Login remains available; the submit request will surface connection errors.
  }
});

async function handleLogin() {
  await handlePasswordLogin();
}

async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = t("login.credentialsRequired");
    return;
  }

  loading.value = true;
  errorMsg.value = "";
  showLockResetHint.value = false;

  try {
    const sessionToken = await loginWithPassword(username.value.trim(), password.value);
    setApiKey(sessionToken);
    router.replace("/hermes/chat");
  } catch (err: any) {
    if (err.status === 429 || err.status === 503) {
      errorMsg.value = t("login.tooManyAttempts");
      showLockResetHint.value = true;
    } else {
      errorMsg.value = err.message || t("login.invalidCredentials");
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-view">
    <div class="ambient">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>
    <div class="login-card">
      <div class="login-logo">
        <img src="/logo.png" alt="Hermes" width="80" height="80" />
      </div>
      <h1 class="login-title">{{ t("login.title") }}</h1>
      <p class="login-desc">{{ t("login.description") }}</p>
      <p class="login-default-hint">{{ t("login.defaultCredentialsHint") }}</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <input
          v-model="username"
          type="text"
          class="login-input"
          :placeholder="t('login.usernamePlaceholder')"
          autofocus
        />
        <input
          v-model="password"
          type="password"
          class="login-input"
          :placeholder="t('login.passwordPlaceholder')"
          @keyup.enter="handleLogin"
        />

        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
        <div v-if="showLockResetHint" class="login-lock-hint">
          <span>{{ t("login.lockResetHint") }}</span>
          <code>hermes-web-ui clear-login-locks --restart</code>
          <span>{{ t("login.defaultLoginResetHint") }}</span>
          <code>hermes-web-ui reset-default-login</code>
        </div>
        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? "..." : t("login.submit") }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.login-view {
  height: calc(100 * var(--vh));
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  position: relative;
  overflow: hidden;
}

.login-card {
  width: 480px;
  max-width: calc(100vw - 32px);
  padding: 56px;
  border: 1px solid rgba(var(--border-color-rgb, 224, 224, 224), 0.2);
  border-radius: $radius-lg;
  background: rgba(var(--bg-card-rgb, 255, 255, 255), 0.7);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.24);
  text-align: center;
  position: relative;
  z-index: 1;

  .dark & {
    background: rgba(var(--bg-card-rgb, 60, 60, 60), 0.65);
    box-shadow: 0 18px 52px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  @media (max-width: $breakpoint-mobile) {
    padding: 32px 24px;
  }
}

.login-logo {
  margin-bottom: 24px;
}

.login-title {
  font-size: 26px;
  font-weight: 600;
  color: $text-primary;
  margin: 0 0 10px;
}

.login-desc {
  font-size: 14px;
  color: $text-muted;
  margin: 0 0 12px;
  line-height: 1.6;
}

.login-default-hint {
  margin: 0 0 28px;
  font-family: $font-code;
  font-size: 13px;
  color: $text-secondary;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(var(--border-color-rgb, 224, 224, 224), 0.3);
  border-radius: $radius-sm;
  font-size: 15px;
  color: $text-primary;
  background: rgba(var(--bg-input-rgb, 255, 255, 255), 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  outline: none;
  transition: border-color $transition-fast, box-shadow $transition-fast;
  box-sizing: border-box;
  font-family: $font-code;

  &::placeholder {
    color: $text-muted;
  }

  &:focus {
    border-color: rgba(var(--accent-primary-rgb), 0.5);
    box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.1);
  }
}

.login-error {
  font-size: 13px;
  color: $error;
  text-align: left;
}

.login-lock-hint {
  padding: 10px 12px;
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: $radius-sm;
  background: rgba(var(--warning-rgb), 0.08);
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;

  code {
    display: block;
    margin-top: 4px;
    color: $text-primary;
    font-family: $font-code;
    word-break: break-all;
  }
}

.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: $radius-sm;
  background: rgba(var(--accent-primary-rgb, 51, 51, 51), 0.85);
  color: var(--text-on-accent);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;

  &:hover:not(:disabled) {
    background: rgba(var(--accent-primary-rgb, 51, 51, 51), 0.95);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(var(--accent-primary-rgb, 51, 51, 51), 0.25);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* Ambient blobs */
.ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: lg-float 20s ease-in-out infinite;
}

.blob-1 {
  width: 300px;
  height: 300px;
  background: var(--accent-info, #6ba3d6);
  top: -80px;
  right: -60px;
}

.blob-2 {
  width: 250px;
  height: 250px;
  background: var(--success, #66bb6a);
  bottom: -40px;
  left: -60px;
  animation-delay: -7s;
}

.blob-3 {
  width: 200px;
  height: 200px;
  background: var(--accent-primary, #e0e0e0);
  top: 50%;
  left: 60%;
  animation-delay: -14s;
}

@keyframes lg-float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 15px) scale(0.95); }
}
</style>
