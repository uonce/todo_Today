import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_TOKEN })
const TODO_DB_ID = process.env.TODO_DB_ID!

const NOTION_COLORS = [
  'default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'
]

export async function GET() {
  try {
    const db = await notion.databases.retrieve({ database_id: TODO_DB_ID }) as any
    const categoryProp = db.properties['업무구분'] as any

    if (!categoryProp || categoryProp.type !== 'select') {
      return NextResponse.json({ categories: [] })
    }

    const categories = categoryProp.select.options.map((opt: any) => ({
      id: opt.id,
      name: opt.name,
      color: opt.color,
    }))

    return NextResponse.json({ categories })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { name, color } = await req.json()

  if (!NOTION_COLORS.includes(color)) {
    return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
  }

  try {
    const db = await notion.databases.retrieve({ database_id: TODO_DB_ID }) as any
    const categoryProp = db.properties['업무구분'] as any

    if (!categoryProp || categoryProp.type !== 'select') {
      return NextResponse.json({ error: 'Category property not found' }, { status: 400 })
    }

    const newOption = { name, color }
    const updatedOptions = [...categoryProp.select.options, newOption]

    await notion.databases.update({
      database_id: TODO_DB_ID,
      properties: {
        '업무구분': {
          select: {
            options: updatedOptions
          }
        }
      }
    })

    return NextResponse.json({ ok: true, category: newOption })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { id, name, color } = await req.json()

  if (color && !NOTION_COLORS.includes(color)) {
    return NextResponse.json({ error: 'Invalid color' }, { status: 400 })
  }

  try {
    const db = await notion.databases.retrieve({ database_id: TODO_DB_ID }) as any
    const categoryProp = db.properties['업무구분'] as any

    if (!categoryProp || categoryProp.type !== 'select') {
      return NextResponse.json({ error: 'Category property not found' }, { status: 400 })
    }

    const updatedOptions = categoryProp.select.options.map((opt: any) => {
      if (opt.id === id) {
        const updated: any = { ...opt }
        if (name) updated.name = name
        if (color) updated.color = color
        return updated
      }
      return opt
    })

    await notion.databases.update({
      database_id: TODO_DB_ID,
      properties: {
        '업무구분': {
          select: {
            options: updatedOptions
          }
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
