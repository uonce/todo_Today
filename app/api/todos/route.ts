import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const TODO_DB_ID = process.env.TODO_DB_ID!
const DAILY_LOG_DB_ID = process.env.DAILY_LOG_DB_ID

// Notion DB 스키마에서 Daily Log를 가리키는 관계형 속성명을 자동 감지 (캐시)
let cachedRelationProp: string | null | undefined = undefined

async function getDailyLogRelationProp(): Promise<string | null> {
  if (cachedRelationProp !== undefined) return cachedRelationProp
  if (!DAILY_LOG_DB_ID) {
    cachedRelationProp = null
    return null
  }
  try {
    const db = await notion.databases.retrieve({ database_id: TODO_DB_ID }) as any
    const normalize = (id: string) => id.replace(/-/g, '')
    for (const [name, prop] of Object.entries(db.properties as any)) {
      if (
        (prop as any).type === 'relation' &&
        normalize((prop as any).relation?.database_id || '') === normalize(DAILY_LOG_DB_ID)
      ) {
        cachedRelationProp = name
        return name
      }
    }
  } catch {}
  cachedRelationProp = null
  return null
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ todos: [] })

  try {
    const response = await notion.databases.query({
      database_id: TODO_DB_ID,
      filter: {
        property: '날짜',
        date: { equals: date }
      }
    })

    const todos = response.results.map((page: any) => ({
      id: page.id,
      url: page.url,
      title: page.properties['할 일']?.title?.[0]?.plain_text || '',
      category: page.properties['업무구분']?.select?.name || '기타',
      done: page.properties['']?.checkbox || false,
      note: page.properties['비고']?.rich_text?.[0]?.plain_text || '',
      date: page.properties['날짜']?.date?.start || '',
    }))

    return NextResponse.json({ todos })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { title, category, date, logId } = await req.json()
  const properties: any = {
    '할 일': { title: [{ text: { content: title } }] },
    '업무구분': { select: { name: category } },
    '날짜': { date: { start: date } },
    '': { checkbox: false }
  }
  if (logId) {
    const relProp = await getDailyLogRelationProp()
    if (relProp) {
      properties[relProp] = { relation: [{ id: logId }] }
    }
  }
  try {
    const page = await notion.pages.create({
      parent: { database_id: TODO_DB_ID },
      properties
    }) as any
    const todo = {
      id: page.id,
      url: page.url,
      title: page.properties['할 일']?.title?.[0]?.plain_text || title,
      category: page.properties['업무구분']?.select?.name || category,
      done: false,
      note: '',
      date,
    }
    return NextResponse.json({ todo })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { id, done } = await req.json()
  try {
    await notion.pages.update({
      page_id: id,
      properties: {
        '': { checkbox: done }
      }
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { id, title, category, note } = await req.json()
  try {
    await notion.pages.update({
      page_id: id,
      properties: {
        '할 일': { title: [{ text: { content: title } }] },
        '업무구분': { select: { name: category } },
        '비고': note ? { rich_text: [{ text: { content: note } }] } : { rich_text: [] },
      }
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  try {
    await notion.pages.update({
      page_id: id,
      archived: true
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
