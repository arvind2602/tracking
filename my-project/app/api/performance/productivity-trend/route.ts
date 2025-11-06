import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { name: 'Week 1', points: 100 },
    { name: 'Week 2', points: 150 },
    { name: 'Week 3', points: 120 },
    { name: 'Week 4', points: 200 },
  ];

  return NextResponse.json(data);
}
