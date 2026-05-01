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
  // Auth: Vercel이 자동 생성한 CRON_SECRET 사용
  // - Vercel 자동 크론 / 대시보드 Run → Authorization: Bearer <CRON_SECRET> 헤더 자동 포함
  // - 수동 직접 호출 → ?key=<CRON_SECRET 값> 쿼리 파라미터로 대체 가능
  // - CRON_SECRET 미설정 시 검증 스킵 (초기 배포 호환)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const headerKey = req.headers.get('authorization')?.replace('Bearer ', '')
    const queryKey = req.nextUrl.searchParams.get('key')
    if (headerKey !== cronSecret && queryKey !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized', hint: 'Add ?key=<CRON_SECRET> or set Authorization header' }, { status: 401 })
    }
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
