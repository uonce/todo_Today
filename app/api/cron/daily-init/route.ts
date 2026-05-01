import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const TODO_DB_ID = process.env.TODO_DB_ID!
const DAILY_LOG_DB_ID = process.env.DAILY_LOG_DB_ID!
const ROUTINE_DB_ID = process.env.ROUTINE_DB_ID!

function getKstDateStr(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

async function detectRelationProp(): Promise<string | null> {
  if (!DAILY_LOG_DB_ID) return null
  try {
    const db = await notion.databases.retrieve({ database_id: TODO_DB_ID }) as any
    const normalize = (id: string) => id.replace(/-/g, '')
    for (const [name, prop] of Object.entries(db.properties as any)) {
      if (
        (prop as any).type === 'relation' &&
        normalize((prop as any).relation?.database_id || '') === normalize(DAILY_LOG_DB_ID)
      ) {
        return name
      }
    }
  } catch {}
  return null
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = getKstDateStr()

  try {
    // 1. Daily Log가 이미 있으면 전체 스킵
    const existingLog = await notion.databases.query({
      database_id: DAILY_LOG_DB_ID,
      filter: { property: '날짜', date: { equals: today } }
    })

    if (existingLog.results.length > 0) {
      return NextResponse.json({ ok: true, date: today, skipped: true, reason: 'Daily Log already exists' })
    }

    // 2. Daily Log 생성
    const logPage = await notion.pages.create({
      parent: { database_id: DAILY_LOG_DB_ID },
      properties: {
        '페이지': { title: [{ text: { content: today } }] },
        '날짜': { date: { start: today } }
      }
    })
    const logId = logPage.id

    // 3. 루틴 불러오기
    if (!ROUTINE_DB_ID) {
      return NextResponse.json({ ok: true, date: today, logId, todosCreated: 0, note: 'ROUTINE_DB_ID not set' })
    }

    const routinesRes = await notion.databases.query({ database_id: ROUTINE_DB_ID })
    const routines = routinesRes.results
      .filter((p: any) => p.object === 'page')
      .map((p: any) => {
        const props = p.properties || {}
        const titleProp = props['할일'] || props['할 일'] || props['Name'] || props['이름']
        return {
          title: titleProp?.title?.[0]?.plain_text || '',
          category: props['업무구분']?.select?.name || '',
          order: props['순서']?.number ?? 0,
        }
      })
      .filter(r => r.title)
      .sort((a, b) => a.order - b.order)

    // 4. 관계형 속성명 감지
    const relProp = await detectRelationProp()

    // 5. 루틴 → 오늘 할일로 생성 + Daily Log 관계형 연결
    let todosCreated = 0
    for (const routine of routines) {
      const properties: any = {
        '할 일': { title: [{ text: { content: routine.title } }] },
        '날짜': { date: { start: today } },
        '': { checkbox: false }
      }
      if (routine.category) {
        properties['업무구분'] = { select: { name: routine.category } }
      }
      if (relProp) {
        properties[relProp] = { relation: [{ id: logId }] }
      }
      await notion.pages.create({ parent: { database_id: TODO_DB_ID }, properties })
      todosCreated++
    }

    return NextResponse.json({ ok: true, date: today, logId, todosCreated })
  } catch (e: any) {
    console.error('Cron daily-init error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
