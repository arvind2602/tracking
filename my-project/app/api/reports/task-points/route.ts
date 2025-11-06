import { NextResponse } from 'next/server';

export async function GET() {
  const data = {
    data: [
      { name: 'Project A', 'John Doe': 10, 'Jane Doe': 20 },
      { name: 'Project B', 'John Doe': 30, 'Jane Doe': 40 },
    ],
    employees: ['John Doe', 'Jane Doe'],
  };

  return NextResponse.json(data);
}
