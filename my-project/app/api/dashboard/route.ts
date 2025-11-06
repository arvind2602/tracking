import { NextResponse } from 'next/server';

export async function GET() {
  // Mock data
  const data = {
    totalEmployees: 100,
    activeEmployees: 90,
    archivedEmployees: 10,
    totalProjects: 50,
    tasksByStatus: [
      { status: 'TODO', _count: { status: 20 } },
      { status: 'IN_PROGRESS', _count: { status: 30 } },
      { status: 'DONE', _count: { status: 50 } },
    ],
    totalPoints: 1000,
  };

  return NextResponse.json(data);
}
