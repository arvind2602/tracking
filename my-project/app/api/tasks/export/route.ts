import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assignedTo = searchParams.get('assignedTo');

    const whereClause: { assignedTo?: string } = {};
    if (assignedTo) {
      whereClause.assignedTo = assignedTo;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedToUser: { select: { firstName: true, lastName: true } },
        project: { select: { name: true } },
      },
    });

    let csv = 'Description,Status,Assigned To,Points,Project\n';
    tasks.forEach((task) => {
      const assignedToName = task.assignedToUser ? `${task.assignedToUser.firstName} ${task.assignedToUser.lastName}` : 'Unassigned';
      const projectName = task.project ? task.project.name : 'N/A';
      csv += `"${task.description}",${task.status},"${assignedToName}",${task.points},"${projectName}"\n`;
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="tasks.csv"',
      },
    });
  } catch (error) {
    console.error('Error exporting tasks:', error);
    return NextResponse.json({ message: 'Failed to export tasks' }, { status: 500 });
  }
}

