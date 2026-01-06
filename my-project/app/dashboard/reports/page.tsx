'use client';

import { EmployeeCountPerOrg } from "@/components/reports/EmployeeCountPerOrg";
import { ActiveVsArchivedEmployees } from "@/components/reports/ActiveVsArchivedEmployees";
import { ProjectsPerOrg } from "@/components/reports/ProjectsPerOrg";
import { TasksByStatus } from "@/components/reports/TasksByStatus";
import { TasksPerEmployee } from "@/components/reports/TasksPerEmployee";
import { TaskPoints } from "@/components/reports/TaskPoints";
import { RoleDistribution } from "@/components/reports/RoleDistribution";
import axios from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import React from "react";

export default function ReportsPage() {
  const handleExport = async () => {
    try {
      const res = await axios.get('/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      // The error toast is already handled by the axios interceptor
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-200 to-purple-200">
            Reports
          </h1>
          <p className="text-slate-400 mt-2 font-medium">View organizational reports and analytics.</p>
        </div>
        <Button
          onClick={handleExport}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-none rounded-xl px-8 py-6 shadow-lg shadow-blue-500/20 transition-all duration-300 gap-2 font-bold"
        >
          <Download className="h-5 w-5" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300">
          <EmployeeCountPerOrg />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300">
          <ActiveVsArchivedEmployees />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300 lg:col-span-3">
          <ProjectsPerOrg />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300">
          <TasksByStatus />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300">
          <RoleDistribution />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300 lg:col-span-3">
          <TasksPerEmployee />
        </div>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl hover:bg-white/10 transition-all duration-300 lg:col-span-3">
          <TaskPoints />
        </div>
      </div>
    </div>
  );
}