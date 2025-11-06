import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { name: 'John Doe', taskCount: 2, totalPoints: 30 },
    { name: 'Jane Doe', taskCount: 1, totalPoints: 30 },
  ];

  return NextResponse.json(data);
}
