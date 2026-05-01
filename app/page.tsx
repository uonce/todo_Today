'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

interface Routine {
  id: string
  title: string
  category: string
  order: number
}

interface Category {
  id: string
  name: string
  color: string
}

function formatDate(date: Date) {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}

function toDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getCategoryBgColor(color: string): string {
  const colorMap: Record<string, string> = {
    default: '#e5e7eb',
    gray: '#d1d5db',
    brown: '#d2691e',
    orange: '#fdba74',
    yellow: '#fcd34d',
    green: '#86efac',
    blue: '#93c5fd',
    purple: '#d8b4fe',
    pink: '#f9a8d4',
    red: '#fca5a5',
  }
  return colorMap[color] || '#e5e7eb'
}

const CATEGORY_COLORS: Record<string, string> = {
  '알고리즘': '#f9a8d4',
  '토익': '#fdba74',
  '글쓰기': '#86efac',
  '자소서/포폴': '#fca5a5',
  '기타': '#d1d5db',
}

const ROUTINES = [
  { title: '알고리즘 문제 풀기(2문제)', category: '알고리즘' },
  { title: '토익 문제 풀기(3문제)', category: '토익' },
]

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [editTodoTitle, setEditTodoTitle] = useState('')
  const [editTodoCategory, setEditTodoCategory] = useState('')
  const [editTodoNote, setEditTodoNote] = useState('')
  const [editingLog, setEditingLog] = useState(false)
  const [logDraft, setLogDraft] = useState('')
  const [savingLog, setSavingLog] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [loadingRoutine, setLoadingRoutine] = useState(false)
  const [achievementTab, setAchievementTab] = useState<'daily' | 'weekly'>('daily')
  const [weeklyDaysTodos, setWeeklyDaysTodos] = useState<Record<string, Todo[]>>({})
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'routine' | 'category'>('routine')
  const [routines, setRoutines] = useState<Routine[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingRoutines, setLoadingRoutines] = useState(false)
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null)
  const [editRoutineTitle, setEditRoutineTitle] = useState('')
  const [editRoutineCategory, setEditRoutineCategory] = useState('')
  const [newRoutineTitle, setNewRoutineTitle] = useState('')
  const [newRoutineCategory, setNewRoutineCategory] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('default')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryColor, setEditingCategoryColor] = useState('default')
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [selectedTodoIds, setSelectedTodoIds] = useState<Set<string>>(new Set())
  const [isMobile, setIsMobile] = useState(false)
  const [todoMode, setTodoMode] = useState<'normal' | 'adding' | 'editing' | 'selecting'>('normal')

  const NOTION_COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']

  const dragItem = useRef<string | null>(null)
  const dragOverItem = useRef<string | null>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchDragActive = useRef(false)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const isLongPress = useRef(false)

  const getWeekDates = useCallback((date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    const weekStart = new Date(d.setDate(diff))
    const weekDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + i)
      weekDates.push(toDateStr(date))
    }
    return weekDates
  }, [])

  const fetchWeeklyData = useCallback(async (date: Date) => {
    try {
      const weekDates = getWeekDates(date)
      const results: Record<string, Todo[]> = {}
      await Promise.all(
        weekDates.map(async (dateStr) => {
          const res = await fetch(`/api/todos?date=${dateStr}`)
          const data = await res.json()
          results[dateStr] = data.todos || []
        })
      )
      setWeeklyDaysTodos(results)
    } catch (e) {
      console.error(e)
    }
  }, [getWeekDates])

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

  const fetchRoutines = useCallback(async () => {
    setLoadingRoutines(true)
    try {
      const res = await fetch('/api/routines')
      const data = await res.json()
      console.log('Fetch routines response:', data)
      if (data.error) {
        console.error('Routine API error:', data.error)
      }
      setRoutines(data.routines || [])
    } catch (e) {
      console.error('Fetch routines error:', e)
    } finally {
      setLoadingRoutines(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(data.categories || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  const resetAllModes = () => {
    setShowAddForm(false)
    setEditingTodoId(null)
    setSelectedTodoIds(new Set())
    setTodoMode('normal')
    setNewTodo('')
  }

  useEffect(() => {
    resetAllModes()
    fetchData(selectedDate)
    fetchWeeklyData(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    if (view === 'history') fetchHistory()
  }, [view, fetchHistory])

  useEffect(() => {
    if (showSettingsModal) {
      fetchRoutines()
      fetchCategories()
    }
  }, [showSettingsModal, fetchRoutines, fetchCategories])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleCalendarTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleCalendarTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX
    const threshold = 50

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))
      } else {
        setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))
      }
    }
  }

  const toggleTodo = async (todo: Todo) => {
    const updatedTodos = todos.map(t => t.id === todo.id ? { ...t, done: !t.done } : t)
    setTodos(updatedTodos)

    const weekDates = getWeekDates(selectedDate)
    const newWeeklyData = { ...weeklyDaysTodos }
    const todoDateIndex = weekDates.indexOf(todo.date)
    if (todoDateIndex !== -1) {
      newWeeklyData[todo.date] = (newWeeklyData[todo.date] || []).map(t =>
        t.id === todo.id ? { ...t, done: !t.done } : t
      )
      setWeeklyDaysTodos(newWeeklyData)
    }

    await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todo.id, done: !todo.done })
    })
  }

  const deleteTodo = async (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id))
    await fetch('/api/todos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
  }

  const toggleTodoSelection = (id: string) => {
    if (todoMode === 'adding' || todoMode === 'editing') return

    setSelectedTodoIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      if (newSet.size > 0 && todoMode === 'normal') {
        setTodoMode('selecting')
      } else if (newSet.size === 0) {
        setTodoMode('normal')
      }
      return newSet
    })
  }

  const deleteSelectedTodos = async () => {
    for (const id of selectedTodoIds) {
      await deleteTodo(id)
    }
    setSelectedTodoIds(new Set())
    setTodoMode('normal')
  }

  const startEditTodo = (todo: Todo) => {
    if (todoMode === 'selecting' || todoMode === 'adding') return
    setEditingTodoId(todo.id)
    setEditTodoTitle(todo.title)
    setEditTodoCategory(todo.category)
    setEditTodoNote(todo.note)
    setTodoMode('editing')
  }

  const updateTodo = async () => {
    if (!editingTodoId || !editTodoTitle.trim()) return
    const id = editingTodoId
    setTodos(prev => prev.map(t => t.id === id ? { ...t, title: editTodoTitle, category: editTodoCategory, note: editTodoNote } : t))
    setEditingTodoId(null)
    setTodoMode('normal')
    await fetch('/api/todos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, title: editTodoTitle, category: editTodoCategory, note: editTodoNote })
    })
  }

  const createTodo = async () => {
    if (!newTodo.trim()) return
    setAddingTodo(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, category: newCategory, date: toDateStr(selectedDate), logId: dailyLog?.id })
      })
      const data = await res.json()
      if (data.todo) {
        setTodos(prev => [...prev, data.todo])
        setNewTodo('')
        setShowAddForm(false)
        setTodoMode('normal')
      }
    } finally {
      setAddingTodo(false)
    }
  }

  const loadRoutine = async () => {
    setLoadingRoutine(true)
    try {
      const dateStr = toDateStr(selectedDate)
      const response = await fetch('/api/routines')
      const data = await response.json()
      const routinesToLoad = data.routines || []

      for (const r of routinesToLoad) {
        const res = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: r.title, category: r.category, date: dateStr, logId: dailyLog?.id })
        })
        const resData = await res.json()
        if (resData.todo) setTodos(prev => [...prev, resData.todo])
      }
    } finally {
      setLoadingRoutine(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragItem.current = id
    dragOverItem.current = null
    e.dataTransfer.effectAllowed = 'move'
    setDraggedId(id)
  }

  const handleDragEnter = (id: string) => {
    if (!dragItem.current || id === dragItem.current || id === dragOverItem.current) return
    dragOverItem.current = id
    setTodos(prev => {
      const items = [...prev]
      const fromIdx = items.findIndex(t => t.id === dragItem.current)
      const toIdx = items.findIndex(t => t.id === id)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [removed] = items.splice(fromIdx, 1)
      items.splice(toIdx, 0, removed)
      return items
    })
  }

  const handleDragEnd = () => {
    dragItem.current = null
    dragOverItem.current = null
    setDraggedId(null)
  }

  const addRoutine = async () => {
    if (!newRoutineTitle.trim()) return
    try {
      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRoutineTitle,
          category: newRoutineCategory
        })
      })
      const data = await res.json()
      if (data.routine) {
        setRoutines(prev => [...prev, data.routine])
        setNewRoutineTitle('')
        setNewRoutineCategory('')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const updateRoutine = async (id: string) => {
    if (!editRoutineTitle.trim()) return
    try {
      await fetch('/api/routines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title: editRoutineTitle,
          category: editRoutineCategory
        })
      })
      setRoutines(prev => prev.map(r => r.id === id ? { ...r, title: editRoutineTitle, category: editRoutineCategory } : r))
      setEditingRoutineId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const deleteRoutine = async (id: string) => {
    try {
      await fetch('/api/routines', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      setRoutines(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const addCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          color: newCategoryColor
        })
      })
      const data = await res.json()
      if (data.ok) {
        setCategories(prev => [...prev, { id: '', name: newCategoryName, color: newCategoryColor }])
        setNewCategoryName('')
        setNewCategoryColor('default')
        await fetchCategories()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const updateCategory = async (id: string, name?: string, color?: string) => {
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, color })
      })
      const data = await res.json()
      if (data.ok) {
        await fetchCategories()
        setEditingCategoryId(null)
      }
    } catch (e) {
      console.error(e)
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

  const calculateAchievement = (todoList: Todo[]) => {
    const completed = todoList.filter(t => t.done).length
    const total = todoList.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    return { completed, total, percentage }
  }

  const dailyAchievement = calculateAchievement(todos)

  const weeklyAchievement = (() => {
    let totalCompleted = 0, totalCount = 0
    Object.values(weeklyDaysTodos).forEach(dayTodos => {
      const completed = dayTodos.filter(t => t.done).length
      totalCompleted += completed
      totalCount += dayTodos.length
    })
    return {
      completed: totalCompleted,
      total: totalCount,
      percentage: totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0
    }
  })()

  const completedCount = dailyAchievement.completed
  const totalCount = dailyAchievement.total
  const completionPct = dailyAchievement.percentage

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
  const isEditing = editingTodoId !== null

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>✦</span>
          <span className={styles.logoText}>오늘할일</span>
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
          <section
            className={styles.calendarSection}
            ref={calendarRef}
            onTouchStart={handleCalendarTouchStart}
            onTouchEnd={handleCalendarTouchEnd}
          >
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

            <div
              className={styles.weeklyCard}
              onTouchStart={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
            >
              <div className={styles.achievementTabsHeader}>
                <button
                  className={`${styles.achievementTab} ${achievementTab === 'daily' ? styles.achievementTabActive : ''}`}
                  onClick={() => setAchievementTab('daily')}
                >
                  일간 달성도
                </button>
                <button
                  className={`${styles.achievementTab} ${achievementTab === 'weekly' ? styles.achievementTabActive : ''}`}
                  onClick={() => setAchievementTab('weekly')}
                >
                  주간 달성도
                </button>
              </div>
              {achievementTab === 'daily' ? (
                <>
                  <div className={styles.weeklyBar}>
                    <div className={styles.weeklyFill} style={{ width: `${dailyAchievement.percentage}%` }} />
                  </div>
                  <div className={styles.weeklyStats}>
                    <span>{dailyAchievement.completed}/{dailyAchievement.total} 완료</span>
                    <span className={styles.weeklyPct}>{dailyAchievement.percentage}%</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.weeklyBar}>
                    <div className={styles.weeklyFill} style={{ width: `${weeklyAchievement.percentage}%` }} />
                  </div>
                  <div className={styles.weeklyStats}>
                    <span>{weeklyAchievement.completed}/{weeklyAchievement.total} 완료</span>
                    <span className={styles.weeklyPct}>{weeklyAchievement.percentage}%</span>
                  </div>
                </>
              )}
            </div>

            <button className={styles.settingsBtn} onClick={() => setShowSettingsModal(true)} title="설정">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24" />
              </svg>
            </button>
          </section>

          {/* Right: Todos + Daily Log */}
          <section className={styles.rightSection}>
            <datalist id="category-options">
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c} />)}
            </datalist>

            {/* Todo section title + buttons */}
            <div className={styles.sectionTitleRow}>
              <div className={styles.sectionTitle}>
                <span className={styles.pin}>📌</span>
                {toDateStr(selectedDate) === todayStr ? '오늘의 할일' : `${selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 할일`}
              </div>
              <div className={styles.sectionActions}>
                {isMobile && selectedTodoIds.size > 0 && (
                  <button
                    className={styles.deleteSelectedBtn}
                    onClick={deleteSelectedTodos}
                  >
                    삭제 ({selectedTodoIds.size})
                  </button>
                )}
                {!isMobile && (
                  <>
                    <button
                      className={styles.routineBtn}
                      onClick={loadRoutine}
                      disabled={loadingRoutine}
                    >
                      {loadingRoutine ? '추가 중...' : '루틴 불러오기'}
                    </button>
                    <button
                      className={`${styles.addTodoToggleBtn} ${showAddForm ? styles.addTodoToggleBtnActive : ''}`}
                      onClick={() => { setShowAddForm(v => !v); setNewTodo('') }}
                    >
                      +
                    </button>
                  </>
                )}
                {isMobile && selectedTodoIds.size === 0 && (
                  <>
                    <button
                      className={styles.routineBtn}
                      onClick={loadRoutine}
                      disabled={loadingRoutine}
                    >
                      {loadingRoutine ? '...' : '루틴'}
                    </button>
                    <button
                      className={`${styles.addTodoToggleBtn} ${showAddForm ? styles.addTodoToggleBtnActive : ''}`}
                      onClick={() => {
                        setShowAddForm(v => !v)
                        setNewTodo('')
                        if (!showAddForm && todoMode === 'normal') {
                          setTodoMode('adding')
                        } else {
                          setTodoMode('normal')
                        }
                      }}
                    >
                      +
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Add todo form */}
            {showAddForm && (
              <div className={styles.addTodoRow}>
                <input
                  list="category-options"
                  className={styles.categoryInput}
                  placeholder="카테고리"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                />
                <input
                  className={styles.addTodoInput}
                  placeholder="할일 추가..."
                  value={newTodo}
                  onChange={e => setNewTodo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createTodo()}
                  autoFocus
                />
                <button className={styles.addTodoBtn} onClick={createTodo} disabled={addingTodo}>
                  {addingTodo ? '...' : '↵'}
                </button>
              </div>
            )}

            {/* Todo list */}
            <div
              className={styles.todoList}
              onClick={e => {
                if (isMobile && todoMode === 'selecting' && e.target === e.currentTarget) {
                  setSelectedTodoIds(new Set())
                  setTodoMode('normal')
                }
              }}
            >
              {loading ? (
                <div className={styles.empty}>불러오는 중...</div>
              ) : todos.length === 0 ? (
                <div className={styles.empty}>할일이 없어요</div>
              ) : todos.map(todo => {
                const editing = editingTodoId === todo.id
                const isSelected = selectedTodoIds.has(todo.id)

                const handleTodoTouchStart = (e: React.TouchEvent) => {
                  if (!isMobile || editing || todoMode === 'adding' || todoMode === 'editing') return
                  const touch = e.touches[0]
                  touchStartX.current = touch.clientX
                  touchStartY.current = touch.clientY
                  touchDragActive.current = false
                  isLongPress.current = false
                  if (longPressTimer.current) clearTimeout(longPressTimer.current)
                  if (todoMode === 'normal') {
                    longPressTimer.current = setTimeout(() => {
                      if (!touchDragActive.current) {
                        isLongPress.current = true
                        toggleTodoSelection(todo.id)
                      }
                    }, 600)
                  }
                }

                const handleTodoTouchMove = (e: React.TouchEvent) => {
                  if (!isMobile || editing || todoMode === 'adding' || todoMode === 'editing') return
                  const touch = e.touches[0]
                  const dx = touch.clientX - touchStartX.current
                  const dy = touch.clientY - touchStartY.current
                  const dist = Math.sqrt(dx * dx + dy * dy)
                  if (!touchDragActive.current && dist > 8 && todoMode !== 'selecting') {
                    touchDragActive.current = true
                    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
                    dragItem.current = todo.id
                    dragOverItem.current = null
                    setDraggedId(todo.id)
                  }
                  if (touchDragActive.current) {
                    e.preventDefault()
                    const el = document.elementFromPoint(touch.clientX, touch.clientY)
                    const todoEl = el?.closest('[data-todo-id]') as HTMLElement | null
                    if (todoEl) {
                      const targetId = todoEl.dataset.todoId
                      if (targetId && targetId !== dragItem.current) handleDragEnter(targetId)
                    }
                  }
                }

                const handleTodoTouchEnd = (e: React.TouchEvent) => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current)
                  if (touchDragActive.current) {
                    touchDragActive.current = false
                    handleDragEnd()
                    return
                  }
                  if (isMobile && todoMode === 'selecting' && !isLongPress.current) {
                    e.preventDefault()
                    toggleTodoSelection(todo.id)
                  }
                }

                return (
                  <div
                    key={todo.id}
                    data-todo-id={todo.id}
                    className={[
                      styles.todoItem,
                      todo.done ? styles.todoDone : '',
                      draggedId === todo.id ? styles.todoItemDragging : '',
                      editing ? styles.todoItemEditing : '',
                      isSelected ? styles.todoItemSelected : '',
                    ].join(' ')}
                    draggable={!isEditing && !isMobile}
                    onDragStart={e => handleDragStart(e, todo.id)}
                    onDragEnter={() => handleDragEnter(todo.id)}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={handleDragEnd}
                    onTouchStart={isMobile ? handleTodoTouchStart : undefined}
                    onTouchMove={isMobile ? handleTodoTouchMove : undefined}
                    onTouchEnd={isMobile ? handleTodoTouchEnd : undefined}
                  >
                    {/* Drag handle */}
                    {!isMobile && (
                      <span className={styles.dragHandle}>
                        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                          <circle cx="4" cy="3" r="1.5" />
                          <circle cx="4" cy="8" r="1.5" />
                          <circle cx="4" cy="13" r="1.5" />
                          <circle cx="8" cy="3" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </span>
                    )}

                    {/* Checkbox */}
                    <button
                      className={styles.checkbox}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTodo(todo)
                      }}
                      style={editing ? { alignSelf: 'flex-start', marginTop: 4 } : undefined}
                    >
                      {todo.done ? '✓' : ''}
                    </button>

                    {editing ? (
                      <div className={styles.todoEditArea}>
                        <div className={styles.todoEditTopRow}>
                          <input
                            list="category-options"
                            className={styles.editCategoryInput}
                            value={editTodoCategory}
                            onChange={e => setEditTodoCategory(e.target.value)}
                            placeholder="카테고리"
                          />
                          <input
                            className={styles.editTitleInput}
                            value={editTodoTitle}
                            onChange={e => setEditTodoTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') updateTodo()
                              if (e.key === 'Escape') setEditingTodoId(null)
                            }}
                            autoFocus
                          />
                        </div>
                        <input
                          className={styles.editNoteInput}
                          value={editTodoNote}
                          onChange={e => setEditTodoNote(e.target.value)}
                          placeholder="비고 (선택사항)"
                          onKeyDown={e => {
                            if (e.key === 'Enter') updateTodo()
                            if (e.key === 'Escape') setEditingTodoId(null)
                          }}
                        />
                        <div className={styles.todoEditActions}>
                          <button className={styles.editCancelBtn} onClick={() => setEditingTodoId(null)}>취소</button>
                          <button className={styles.editSaveBtn} onClick={updateTodo}>저장</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span
                          className={styles.categoryBadge}
                          style={{ background: CATEGORY_COLORS[todo.category] || '#e5e7eb' }}
                        >
                          {todo.category}
                        </span>
                        <span className={styles.todoTitle} onClick={() => startEditTodo(todo)}>
                          {todo.title}
                        </span>
                        {todo.note && <span className={styles.todoNote}>{todo.note}</span>}
                      </>
                    )}

                    {/* Delete button */}
                    {!isMobile && (
                      <button
                        className={styles.deleteBtn}
                        onClick={() => deleteTodo(todo.id)}
                        title="삭제"
                        style={editing ? { alignSelf: 'flex-start', marginTop: 2 } : undefined}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
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

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSettingsModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>설정</h2>
              <button className={styles.modalClose} onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>

            <div className={styles.modalTabs}>
              <button
                className={`${styles.modalTab} ${settingsTab === 'routine' ? styles.modalTabActive : ''}`}
                onClick={() => setSettingsTab('routine')}
              >
                루틴 설정
              </button>
              <button
                className={`${styles.modalTab} ${settingsTab === 'category' ? styles.modalTabActive : ''}`}
                onClick={() => setSettingsTab('category')}
              >
                업무구분 설정
              </button>
            </div>

            <div className={styles.modalTabContent}>
              {settingsTab === 'routine' ? (
                <div className={styles.routineSettingsTab}>
                  <div className={styles.routineInputRow}>
                    <input
                      type="text"
                      className={styles.routineInput}
                      placeholder="루틴 이름"
                      value={newRoutineTitle}
                      onChange={e => setNewRoutineTitle(e.target.value)}
                    />
                    <select
                      className={styles.routineCategorySelect}
                      value={newRoutineCategory}
                      onChange={e => setNewRoutineCategory(e.target.value)}
                    >
                      <option value="">업무구분 선택</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <button className={styles.routineAddBtn} onClick={addRoutine}>추가</button>
                  </div>

                  <div className={styles.routineList}>
                    {loadingRoutines ? (
                      <div className={styles.tabPlaceholder}>불러오는 중...</div>
                    ) : routines.length === 0 ? (
                      <div className={styles.tabPlaceholder}>등록된 루틴이 없어요</div>
                    ) : routines.map(routine => (
                      <div key={routine.id} className={styles.routineItem}>
                        {editingRoutineId === routine.id ? (
                          <div className={styles.routineEditForm}>
                            <input
                              type="text"
                              className={styles.routineInput}
                              value={editRoutineTitle}
                              onChange={e => setEditRoutineTitle(e.target.value)}
                            />
                            <select
                              className={styles.routineCategorySelect}
                              value={editRoutineCategory}
                              onChange={e => setEditRoutineCategory(e.target.value)}
                            >
                              <option value="">업무구분 선택</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                              ))}
                            </select>
                            <button className={styles.routineSaveBtn} onClick={() => updateRoutine(routine.id)}>저장</button>
                            <button className={styles.routineCancelBtn} onClick={() => setEditingRoutineId(null)}>취소</button>
                          </div>
                        ) : (
                          <>
                            <div className={styles.routineInfo}>
                              <span className={styles.routineTitle}>{routine.title}</span>
                              {routine.category && (
                                <span
                                  className={styles.routineBadge}
                                  style={{
                                    background: categories.find(c => c.name === routine.category)?.color || '#e5e7eb'
                                  }}
                                >
                                  {routine.category}
                                </span>
                              )}
                            </div>
                            <div className={styles.routineActions}>
                              <button className={styles.routineEditBtn} onClick={() => {
                                setEditingRoutineId(routine.id)
                                setEditRoutineTitle(routine.title)
                                setEditRoutineCategory(routine.category)
                              }}>편집</button>
                              <button className={styles.routineDeleteBtn} onClick={() => deleteRoutine(routine.id)}>삭제</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.categorySettingsTab}>
                  <div className={styles.categoryInputRow}>
                    <input
                      type="text"
                      className={styles.modalCategoryInput}
                      placeholder="업무구분 이름"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                    />
                    <select
                      className={styles.colorSelect}
                      value={newCategoryColor}
                      onChange={e => setNewCategoryColor(e.target.value)}
                    >
                      {NOTION_COLORS.map(color => (
                        <option key={color} value={color}>{color}</option>
                      ))}
                    </select>
                    <button className={styles.categoryAddBtn} onClick={addCategory}>추가</button>
                  </div>

                  <div className={styles.categoryList}>
                    {categories.length === 0 ? (
                      <div className={styles.tabPlaceholder}>등록된 업무구분이 없어요</div>
                    ) : categories.map(category => (
                      <div key={category.id} className={styles.categoryItem}>
                        {editingCategoryId === category.id ? (
                          <div className={styles.categoryEditForm}>
                            <input
                              type="text"
                              className={styles.modalCategoryInput}
                              value={editingCategoryName}
                              onChange={e => setEditingCategoryName(e.target.value)}
                              placeholder="이름"
                            />
                            <select
                              className={styles.colorSelect}
                              value={editingCategoryColor}
                              onChange={e => setEditingCategoryColor(e.target.value)}
                            >
                              {NOTION_COLORS.map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                            <button className={styles.categorySaveBtn} onClick={() => updateCategory(category.id, editingCategoryName || category.name, editingCategoryColor)}>저장</button>
                            <button className={styles.categoryCancelBtn} onClick={() => setEditingCategoryId(null)}>취소</button>
                          </div>
                        ) : (
                          <>
                            <div className={styles.categoryNameSection}>
                              <span
                                className={styles.categoryColorDot}
                                style={{ background: getCategoryBgColor(category.color) }}
                              />
                              <span className={styles.categoryName}>{category.name}</span>
                            </div>
                            <button
                              className={styles.categoryEditBtn}
                              onClick={() => {
                                setEditingCategoryId(category.id)
                                setEditingCategoryName(category.name)
                                setEditingCategoryColor(category.color)
                              }}
                            >
                              수정
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
