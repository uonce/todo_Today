import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const DAILY_LOG_DB_ID = process.env.DAILY_LOG_DB_ID!

function formatLog(page: any) {
  return {
    id: page.id,
    url: page.url,
    notionUrl: page.url,
    date: page.properties['날짜']?.date?.start || '',
    content: page.properties['오늘기록']?.rich_text?.[0]?.plain_text || '',
    completionRate: Math.round((page.properties['롤업']?.rollup?.number || 0) * 100),
  }
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  const all = req.nextUrl.searchParams.get('all')
  const month = req.nextUrl.searchParams.get('month') // 'YYYY-MM'

  try {
    if (month) {
      const [year, mon] = month.split('-')
      const startDate = `${year}-${mon}-01`
      const lastDay = new Date(Number(year), Number(mon), 0).getDate()
      const endDate = `${year}-${mon}-${String(lastDay).padStart(2, '0')}`
      const response = await notion.databases.query({
        database_id: DAILY_LOG_DB_ID,
        filter: {
          and: [
            { property: '날짜', date: { on_or_after: startDate } },
            { property: '날짜', date: { on_or_before: endDate } }
          ]
        }
      })
      const dates = response.results
        .map((p: any) => p.properties['날짜']?.date?.start)
        .filter(Boolean)
      return NextResponse.json({ dates })
    }

    if (all) {
      const response = await notion.databases.query({
        database_id: DAILY_LOG_DB_ID,
        sorts: [{ property: '날짜', direction: 'descending' }]
      })
      const logs = response.results.map(formatLog)
      return NextResponse.json({ logs })
    }

    if (!date) return NextResponse.json({ log: null })

    const response = await notion.databases.query({
      database_id: DAILY_LOG_DB_ID,
      filter: {
        property: '날짜',
        date: { equals: date }
      }
    })

    const log = response.results[0] ? formatLog(response.results[0]) : null
    return NextResponse.json({ log })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const { id, content } = await req.json()
  try {
    await notion.pages.update({
      page_id: id,
      properties: {
        '오늘기록': { rich_text: [{ text: { content } }] }
      }
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { date } = await req.json()
  try {
    const page = await notion.pages.create({
      parent: { database_id: DAILY_LOG_DB_ID },
      properties: {
        '페이지': { title: [{ text: { content: date } }] },
        '날짜': { date: { start: date } }
      }
    })
    return NextResponse.json({ log: formatLog(page) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
