import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { name: 'Jane Doe', totalPoints: 30 },
    { name: 'John Doe', totalPoints: 30 },
  ];

  return NextResponse.json(data);
}
