import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const TODO_DB_ID = process.env.TODO_DB_ID!

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
