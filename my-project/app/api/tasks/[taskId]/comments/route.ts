import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: { taskId: string } }) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { taskId } = params;

    const comments = await prisma.comment.findMany({
      where: {
        taskId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { taskId: string } }) {
  try {
    const session = await auth();
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { taskId } = params;
    const { content } = await request.json();

    if (!content) {
      return new NextResponse("Comment content is required", { status: 400 });
    }

    const user = session.user;

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        authorId: user.id, // Assuming user.id is available from the session
        userName: user.name, // Assuming user.name is available from the session
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
