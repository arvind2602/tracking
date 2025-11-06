import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { id: 'emp1', name: 'John Doe', completionRate: 50 },
    { id: 'emp2', name: 'Jane Doe', completionRate: 100 },
  ];

  return NextResponse.json(data);
}
