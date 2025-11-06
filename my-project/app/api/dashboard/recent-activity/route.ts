import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    { id: 1, user: 'John Doe', action: 'created task', target: '"Implement login page"', time: '2 hours ago' },
    { id: 2, user: 'Jane Doe', action: 'commented on task', target: '"Fix button alignment"', time: '3 hours ago' },
    { id: 3, user: 'John Doe', action: 'completed task', target: '"Add a new logo"', time: '1 day ago' },
  ];

  return NextResponse.json(data);
}
