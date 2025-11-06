import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true,
        role: true,
        organization: { select: { name: true } },
      },
    });

    let csv = 'ID,First Name,Last Name,Email,Position,Role,Organization\n';
    users.forEach((user) => {
      const organizationName = user.organization ? user.organization.name : 'N/A';
      csv += `${user.id},\"${user.firstName}\",\"${user.lastName}\",\"${user.email}\",\"${user.position}\",${user.role},\"${organizationName}\"\n`;
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="users.csv"',
      },
    });
  } catch (error) {
    console.error('Error exporting users:', error);
    return NextResponse.json({ message: 'Failed to export users' }, { status: 500 });
  }
}
