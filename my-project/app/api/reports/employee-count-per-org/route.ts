import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { name: 'Vighnotech', employeeCount: 25 },
    { name: 'Google', employeeCount: 50 },
    { name: 'Microsoft', employeeCount: 75 },
  ];

  return NextResponse.json(data);
}
