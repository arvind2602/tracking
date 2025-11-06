import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { name: 'TODO', count: 20 },
    { name: 'IN_PROGRESS', count: 30 },
    { name: 'DONE', count: 50 },
  ];

  return NextResponse.json(data);
}
