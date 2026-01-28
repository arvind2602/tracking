'use client';

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Breadcrumbs from "@/components/ui/breadcrumbs";
import axios from "@/lib/axios";
import toast from "react-hot-toast";
import { Loader } from "lucide-react";
import { Task, User, Project } from "@/lib/types";
import AllTasks from "@/components/tasks/AllTasks";

export default function UserTasksPage() {
  const router = useRouter();
  const { userId } = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const fetchUserTasks = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const [tasksResponse, usersResponse, projectsResponse] = await Promise.all([
          axios.get(`/tasks/user/${userId}`),
          axios.get("/auth/organization"),
          axios.get("/projects"),
        ]);
        setTasks(tasksResponse.data);
        setUsers(usersResponse.data);
        setProjects(projectsResponse.data);

        const currentUser = usersResponse.data.find((user: User) => user.id === userId);
        if (currentUser) {
          setUserName(`${currentUser.firstName} ${currentUser.lastName}`);
        }

      } catch (error) {
        console.error("Error fetching user tasks:", error);
        toast.error("Failed to fetch user tasks.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTasks();
  }, [userId]);

  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Users", href: "/dashboard/users" }, // Assuming a users list page
    { label: `${userName}'s Tasks`, href: `/dashboard/users/${userId}/tasks` },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader className="animate-spin h-12 w-12 text-accent" />
      </div>
    );
  }

  return (
    <div className="font-mono">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex justify-between items-center mb-8 mt-4">
        <h1 className="text-4xl font-bold text-white">{userName}'s Tasks</h1>
      </div>

      {/*  Create a list of the tasks */}
      <AllTasks tasks={tasks} users={users} projects={projects} />
    </div>
  );
}
