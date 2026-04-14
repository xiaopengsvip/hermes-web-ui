import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface TerminalCommand {
  id: string
  command: string
  output: string
  exitCode: number | null
  timestamp: number
  duration: number // ms
  status: 'running' | 'done' | 'error'
}

export interface TerminalSession {
  id: string
  title: string
  commands: TerminalCommand[]
  createdAt: number
  updatedAt: number
  workingDir: string
  env?: Record<string, string>
  type: 'terminal' // 标识为终端会话
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const useTerminalStore = defineStore('terminal', () => {
  const sessions = ref<TerminalSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const isLoading = ref(false)

  const activeSession = computed(() =>
    sessions.value.find(s => s.id === activeSessionId.value) || null
  )

  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => b.createdAt - a.createdAt)
  )

  // 按日期分组
  const groupedSessions = computed(() => {
    const groups: Record<string, TerminalSession[]> = {}
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const yesterday = today - 86400000
    const weekAgo = today - 7 * 86400000

    for (const session of sortedSessions.value) {
      const sessionDate = new Date(session.createdAt)
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate()).getTime()

      let groupKey: string
      if (sessionDay >= today) {
        groupKey = 'today'
      } else if (sessionDay >= yesterday) {
        groupKey = 'yesterday'
      } else if (sessionDay >= weekAgo) {
        groupKey = 'thisWeek'
      } else {
        groupKey = sessionDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
      }

      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(session)
    }

    return groups
  })

  function createSession(title?: string): TerminalSession {
    const session: TerminalSession = {
      id: 'term_' + uid(),
      title: title || `Terminal ${sessions.value.length + 1}`,
      commands: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workingDir: '/home/xiao2027',
      type: 'terminal',
    }
    sessions.value.unshift(session)
    activeSessionId.value = session.id
    return session
  }

  function switchSession(sessionId: string) {
    activeSessionId.value = sessionId
  }

  function deleteSession(sessionId: string) {
    sessions.value = sessions.value.filter(s => s.id !== sessionId)
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = sessions.value[0]?.id || null
    }
  }

  async function executeCommand(command: string): Promise<TerminalCommand> {
    if (!activeSession.value) {
      createSession()
    }

    const session = activeSession.value!
    const cmd: TerminalCommand = {
      id: uid(),
      command,
      output: '',
      exitCode: null,
      timestamp: Date.now(),
      duration: 0,
      status: 'running',
    }

    session.commands.push(cmd)
    session.updatedAt = Date.now()

    // 更新会话标题（使用第一条命令）
    if (session.commands.length === 1) {
      session.title = command.slice(0, 30) + (command.length > 30 ? '...' : '')
    }

    const startTime = Date.now()

    try {
      const res = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          cwd: session.workingDir,
          env: session.env,
        }),
      })

      const data = await res.json()
      cmd.output = data.output || ''
      cmd.exitCode = data.exit_code ?? 0
      cmd.status = data.exit_code === 0 ? 'done' : 'error'

      // 更新工作目录（如果是 cd 命令）
      if (command.trim().startsWith('cd ') && data.new_cwd) {
        session.workingDir = data.new_cwd
      }
    } catch (err: any) {
      cmd.output = `Error: ${err.message}`
      cmd.exitCode = -1
      cmd.status = 'error'
    }

    cmd.duration = Date.now() - startTime
    session.updatedAt = Date.now()

    return cmd
  }

  function clearSession(sessionId?: string) {
    const session = sessionId
      ? sessions.value.find(s => s.id === sessionId)
      : activeSession.value
    if (session) {
      session.commands = []
      session.updatedAt = Date.now()
    }
  }

  function updateSessionTitle(sessionId: string, title: string) {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      session.title = title
      session.updatedAt = Date.now()
    }
  }

  // 从 localStorage 加载
  function loadSessions() {
    try {
      const saved = localStorage.getItem('terminal_sessions')
      if (saved) {
        const data = JSON.parse(saved)
        sessions.value = data.sessions || []
        activeSessionId.value = data.activeSessionId || null
      }
    } catch {
      // ignore
    }
  }

  // 保存到 localStorage
  function saveSessions() {
    try {
      localStorage.setItem('terminal_sessions', JSON.stringify({
        sessions: sessions.value,
        activeSessionId: activeSessionId.value,
      }))
    } catch {
      // ignore
    }
  }

  // 初始化
  loadSessions()
  if (sessions.value.length === 0) {
    createSession()
  }

  return {
    sessions,
    activeSessionId,
    activeSession,
    sortedSessions,
    groupedSessions,
    isLoading,
    createSession,
    switchSession,
    deleteSession,
    executeCommand,
    clearSession,
    updateSessionTitle,
    saveSessions,
  }
})
