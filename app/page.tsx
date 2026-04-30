'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'

interface Todo {
  id: string
  url: string
  title: string
  category: string
  done: boolean
  note: string
  date: string
}

interface DailyLog {
  id: string
  url: string
  notionUrl: string
  date: string
  content: string
  completionRate: number
}

function formatDate(date: Date) {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}

function toDateStr(date: Date) {
  return date.toISOString().split('T')[0]
}

const CATEGORY_COLORS: Record<string, string> = {
  '알고리즘': '#f9a8d4',
  '토익': '#fdba74',
  '글쓰기': '#86efac',
  '자소서/포폴': '#fca5a5',
  '기타': '#d1d5db',
}

export default function Home() {
  const [today] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [todos, setTodos] = useState<Todo[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [view, setView] = useState<'today' | 'history'>('today')
  const [historyLogs, setHistoryLogs] = useState<DailyLog[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [newCategory, setNewCategory] = useState('기타')
  const [addingTodo, setAddingTodo] = useState(false)
  const [editingLog, setEditingLog] = useState(false)
  const [logDraft, setLogDraft] = useState('')
  const [savingLog, setSavingLog] = useState(false)

  const fetchData = useCallback(async (date: Date) => {
    setLoading(true)
    try {
      const dateStr = toDateStr(date)
      const [todosRes, logRes] = await Promise.all([
        fetch(`/api/todos?date=${dateStr}`),
        fetch(`/api/daily-log?date=${dateStr}`)
      ])
      const todosData = await todosRes.json()
      const logData = await logRes.json()
      setTodos(todosData.todos || [])
      setDailyLog(logData.log || null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-log?all=true')
      const data = await res.json()
      setHistoryLogs(data.logs || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    fetchData(selectedDate)
  }, [selectedDate, fetchData])

  useEffect(() => {
    if (view === 'history') fetchHistory()
  }, [view, fetchHistory])

  const toggleTodo = async (todo: Todo) => {
    const optimistic = todos.map(t => t.id === todo.id ? { ...t, done: !t.done } : t)
    setTodos(optimistic)
    await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, done: !todo.done })
    })
  }

  const createTodo = async () => {
    if (!newTodo.trim()) return
    setAddingTodo(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, category: newCategory, date: toDateStr(selectedDate) })
      })
      const data = await res.json()
      if (data.todo) {
        setTodos(prev => [...prev, data.todo])
        setNewTodo('')
      }
    } finally {
      setAddingTodo(false)
    }
  }

  const saveLog = async () => {
    if (!dailyLog) return
    setSavingLog(true)
    try {
      await fetch('/api/daily-log', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dailyLog.id, content: logDraft })
      })
      setDailyLog(prev => prev ? { ...prev, content: logDraft } : prev)
      setEditingLog(false)
    } finally {
      setSavingLog(false)
    }
  }

  const completedCount = todos.filter(t => t.done).length
  const totalCount = todos.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Calendar
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return { firstDay, daysInMonth }
  }

  const { firstDay, daysInMonth } = getDaysInMonth(calendarMonth)
  const todayStr = toDateStr(today)
  const selectedStr = toDateStr(selectedDate)

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>✦</span>
          <span className={styles.logoText}>daily</span>
        </div>
        <div className={styles.headerNav}>
          <button className={view === 'today' ? styles.navActive : styles.navBtn} onClick={() => setView('today')}>오늘</button>
          <button className={view === 'history' ? styles.navActive : styles.navBtn} onClick={() => setView('history')}>기록</button>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.dateLabel}>{formatDate(today)}</span>
        </div>
      </header>

      {view === 'today' ? (
        <main className={styles.main}>
          {/* Left: Calendar */}
          <section className={styles.calendarSection}>
            <div className={styles.calendarHeader}>
              <button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))} className={styles.monthBtn}>‹</button>
              <span className={styles.monthLabel}>{calendarMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}</span>
              <button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))} className={styles.monthBtn}>›</button>
            </div>
            <div className={styles.calendarGrid}>
              {['일','월','화','수','목','금','토'].map(d => (
                <div key={d} className={styles.calendarDayLabel}>{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dateStr === todayStr
                const isSelected = dateStr === selectedStr
                return (
                  <button
                    key={day}
                    className={`${styles.calendarDay} ${isToday ? styles.calendarToday : ''} ${isSelected ? styles.calendarSelected : ''}`}
                    onClick={() => setSelectedDate(new Date(dateStr + 'T12:00:00'))}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Weekly completion */}
            <div className={styles.weeklyCard}>
              <div className={styles.weeklyTitle}>주간 달성도</div>
              <div className={styles.weeklyBar}>
                <div className={styles.weeklyFill} style={{ width: `${completionPct}%` }} />
              </div>
              <div className={styles.weeklyStats}>
                <span>{completedCount}/{totalCount} 완료</span>
                <span className={styles.weeklyPct}>{completionPct}%</span>
              </div>
            </div>
          </section>

          {/* Right: Todos + Daily Log */}
          <section className={styles.rightSection}>
            <div className={styles.sectionTitle}>
              <span className={styles.pin}>📌</span>
              {toDateStr(selectedDate) === todayStr ? '오늘의 할일' : `${selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 할일`}
            </div>

            <div className={styles.todoList}>
              {loading ? (
                <div className={styles.empty}>불러오는 중...</div>
              ) : todos.length === 0 ? (
                <div className={styles.empty}>할일이 없어요</div>
              ) : todos.map(todo => (
                <div key={todo.id} className={`${styles.todoItem} ${todo.done ? styles.todoDone : ''}`}>
                  <button className={styles.checkbox} onClick={() => toggleTodo(todo)}>
                    {todo.done ? '✓' : ''}
                  </button>
                  <span className={styles.categoryBadge} style={{ background: CATEGORY_COLORS[todo.category] || '#e5e7eb' }}>
                    {todo.category}
                  </span>
                  <span className={styles.todoTitle}>{todo.title}</span>
                  {todo.note && <span className={styles.todoNote}>{todo.note}</span>}
                </div>
              ))}
            </div>

            {/* Add todo */}
            <div className={styles.addTodoRow}>
              <select
                className={styles.categorySelect}
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                {Object.keys(CATEGORY_COLORS).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                className={styles.addTodoInput}
                placeholder="할일 추가..."
                value={newTodo}
                onChange={e => setNewTodo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTodo()}
              />
              <button className={styles.addTodoBtn} onClick={createTodo} disabled={addingTodo}>
                {addingTodo ? '...' : '+'}
              </button>
            </div>

            <div className={styles.divider} />

            <div className={styles.sectionTitle}>
              <span className={styles.pin}>📌</span>
              오늘의 기록
            </div>

            {dailyLog ? (
              <div className={styles.logCard}>
                {editingLog ? (
                  <>
                    <textarea
                      className={styles.logTextarea}
                      value={logDraft}
                      onChange={e => setLogDraft(e.target.value)}
                      placeholder="오늘 하루를 기록해보세요..."
                      autoFocus
                    />
                    <div className={styles.logFooter}>
                      <a href={`https://notion.so/${dailyLog.id.replace(/-/g, '')}`} target="_blank" rel="noopener noreferrer" className={styles.logLink}>노션에서 열기 →</a>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.logCancelBtn} onClick={() => setEditingLog(false)}>취소</button>
                        <button className={styles.logSaveBtn} onClick={saveLog} disabled={savingLog}>{savingLog ? '저장 중...' : '저장'}</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.logContent} onClick={() => { setLogDraft(dailyLog.content); setEditingLog(true) }}>
                      {dailyLog.content || '클릭해서 오늘 기록 작성하기...'}
                    </div>
                    <div className={styles.logFooter}>
                      <a href={`https://notion.so/${dailyLog.id.replace(/-/g, '')}`} target="_blank" rel="noopener noreferrer" className={styles.logLink}>노션에서 열기 →</a>
                      <span>{dailyLog.completionRate}% 달성</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button className={styles.createLogBtn} onClick={async () => {
                const res = await fetch('/api/daily-log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ date: toDateStr(selectedDate) })
                })
                const data = await res.json()
                if (data.log) {
                  setDailyLog(data.log)
                  window.open(data.log.notionUrl, '_blank')
                }
              }}>
                + 오늘 기록 만들기
              </button>
            )}
          </section>
        </main>
      ) : (
        <main className={styles.historyMain}>
          <div className={styles.historyTitle}>모든 기록</div>
          <div className={styles.historyGrid}>
            {historyLogs.length === 0 ? (
              <div className={styles.empty}>기록이 없어요</div>
            ) : historyLogs.map(log => (
              <a key={log.id} href={log.notionUrl} target="_blank" rel="noopener noreferrer" className={styles.historyCard}>
                <div className={styles.historyDate}>{new Date(log.date + 'T12:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
                <div className={styles.historyContent}>{log.content || '내용 없음'}</div>
                <div className={styles.historyRate}>
                  <div className={styles.historyBar}>
                    <div className={styles.historyFill} style={{ width: `${log.completionRate}%` }} />
                  </div>
                  <span>{log.completionRate}%</span>
                </div>
              </a>
            ))}
          </div>
        </main>
      )}
    </div>
  )
}
