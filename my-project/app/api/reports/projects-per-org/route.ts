import { NextResponse } from 'next/server';

export async function GET() {
  const data = [
    {
      id: 'org1',
      name: 'Vighnotech',
      projects: [
        { id: 'proj1', name: 'Project A', progress: 50 },
        { id: 'proj2', name: 'Project B', progress: 100 },
      ],
    },
    {
      id: 'org2',
      name: 'Google',
      projects: [
        { id: 'proj3', name: 'Project C', progress: 0 },
      ],
    },
  ];

  return NextResponse.json(data);
}
