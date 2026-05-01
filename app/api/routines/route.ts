import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const ROUTINE_DB_ID = process.env.ROUTINE_DB_ID!

if (!ROUTINE_DB_ID) {
  console.warn('ROUTINE_DB_ID is not set in environment variables')
}

export async function GET() {
  if (!ROUTINE_DB_ID) return NextResponse.json({ routines: [] })

  try {
    const response = await notion.databases.query({
      database_id: ROUTINE_DB_ID,
    })

    const routines = response.results.map((page: any) => ({
      id: page.id,
      title: page.properties['제목']?.title?.[0]?.plain_text || '',
      category: page.properties['업무구분']?.select?.name || '',
      order: page.properties['순서']?.number || 0,
    }))

    return NextResponse.json({ routines: routines.sort((a, b) => a.order - b.order) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!ROUTINE_DB_ID) return NextResponse.json({ error: 'ROUTINE_DB_ID not set' }, { status: 400 })

  const { title, category, order } = await req.json()

  try {
    const response = await notion.databases.query({
      database_id: ROUTINE_DB_ID,
    })
    const maxOrder = Math.max(...response.results.map((p: any) => p.properties['순서']?.number || 0), 0)

    const page = await notion.pages.create({
      parent: { database_id: ROUTINE_DB_ID },
      properties: {
        '제목': { title: [{ text: { content: title } }] },
        '업무구분': category ? { select: { name: category } } : undefined,
        '순서': { number: order ?? maxOrder + 1 },
      }
    }) as any

    const routine = {
      id: page.id,
      title: page.properties['제목']?.title?.[0]?.plain_text || title,
      category: page.properties['업무구분']?.select?.name || '',
      order: page.properties['순서']?.number || 0,
    }

    return NextResponse.json({ routine })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { id, title, category, order } = await req.json()

  try {
    await notion.pages.update({
      page_id: id,
      properties: {
        '제목': { title: [{ text: { content: title } }] },
        '업무구분': category ? { select: { name: category } } : { select: null },
        '순서': order !== undefined ? { number: order } : undefined,
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
