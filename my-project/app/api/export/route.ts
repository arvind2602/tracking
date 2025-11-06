
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getEmployeeCountPerOrg() {
  const orgs = await prisma.organization.findMany({
    include: {
      users: true,
    },
  });
  return orgs.map((org) => ({
    name: org.name,
    employeeCount: org.users.length,
  }));
}

export async function GET(req: NextRequest) {
  const employeeCountPerOrg = await getEmployeeCountPerOrg();

  let csv = 'Organization,Employee Count\n';
  employeeCountPerOrg.forEach((org) => {
    csv += `${org.name},${org.employeeCount}\n`;
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="export.csv"',
    },
  });
}
