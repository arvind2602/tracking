import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { name: 'Admin', value: 10 },
    { name: 'User', value: 90 },
  ];

  return NextResponse.json(data);
}
