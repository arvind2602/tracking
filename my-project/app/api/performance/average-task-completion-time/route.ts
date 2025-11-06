import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { id: 'emp1', name: 'John Doe', averageCompletionTime: 86400000 },
    { id: 'emp2', name: 'Jane Doe', averageCompletionTime: 172800000 },
  ];

  return NextResponse.json(data);
}
