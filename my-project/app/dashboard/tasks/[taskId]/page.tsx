"use client";
import { Task, User, Project, Comment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { useParams } from 'next/navigation';
import Breadcrumbs from "@/components/ui/breadcrumbs";

export default function TaskDetailPage() {
  const { taskId } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch task details
        const taskResponse = await axios.get(`/tasks/tasks/${taskId}`); // Assuming an API endpoint for single task details
        setTask(taskResponse.data);

        // Fetch users and projects (if needed for display)
        const usersResponse = await axios.get('/auth/organization'); // Assuming an API endpoint for all users
        setUsers(usersResponse.data);
        const projectsResponse = await axios.get('/projects'); // Assuming an API endpoint for all projects
        setProjects(projectsResponse.data);

        // Fetch comments
        const commentsResponse = await axios.get(`/tasks/comments/${taskId}`);
        setComments(commentsResponse.data);
      } catch (err) {
        console.error("Error fetching task details:", err);
        setError("Failed to load task details.");
        toast.error("Failed to load task details.");
      } finally {
        setLoading(false);
      }
    };

    if (taskId) {
      fetchData();
    }
  }, [taskId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await axios.post(`/tasks/comments/${taskId}`, { content: newComment });
      setComments((prev) => [...prev, response.data]);
      setNewComment("");

    } catch (err) {
      console.error("Error adding comment:", err);
      toast.error("Failed to add comment");
    }
  };

  if (loading) {
    return <div className="p-4">Loading task details...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!task) {
    return <div className="p-4">Task not found.</div>;
  }

  const assignedUser = users.find((user) => user.id === task.assignedTo);
  const project = projects.find((p) => p.id === task.projectId);

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Tasks', href: '/dashboard/tasks' },
    { label: task.title, href: `/dashboard/tasks/${taskId}` },
  ];

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <h1 className="text-3xl font-bold mb-4">Task: {task.title}</h1>
      <div className="bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg p-6 mb-6">
        <p className="text-lg mb-2"><strong>Description:</strong> {task.description}</p>
        <p className="text-lg mb-2"><strong>Status:</strong> {task.status}</p>
        <p className="text-lg mb-2"><strong>Assigned To:</strong>
          <span className="cursor-pointer" onClick={() => assignedUser && router.push(`/dashboard/users/${assignedUser.id}/tasks`)}>
            {assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : "Unassigned"}
          </span>
        </p>
        <p className="text-lg mb-2"><strong>Project:</strong> {project?.name}</p>
        <p className="text-lg mb-2"><strong>Points:</strong> {task.points}</p>
      </div>

      <div className="bg-card/50 backdrop-blur-lg rounded-xl border border-accent/20 shadow-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Comments</h2>
        {comments.length === 0 ? (
          <p className="text-gray-500">No comments yet.</p>
        ) : (
          <div className="space-y-4 mb-6 max-h-60 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-gray-100 p-3 rounded-md text-black">
                <p className="font-semibold">{comment.userName}</p>
                <p className="text-sm">{comment.content}</p>
                <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <textarea
            className="w-full p-2 border rounded-md text-white"
            rows={4}
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          ></textarea>
          <Button onClick={handleAddComment} className="mt-3">Add Comment</Button>
        </div>
      </div>
    </div>
  );
}
