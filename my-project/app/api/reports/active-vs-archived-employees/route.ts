import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { name: 'Active', value: 90 },
    { name: 'Archived', value: 10 },
  ];

  return NextResponse.json(data);
}
