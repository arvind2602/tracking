'use client';

import { EmployeeCountPerOrg } from "@/components/reports/EmployeeCountPerOrg";
import { ActiveVsArchivedEmployees } from "@/components/reports/ActiveVsArchivedEmployees";
import { ProjectsPerOrg } from "@/components/reports/ProjectsPerOrg";
import { TasksByStatus } from "@/components/reports/TasksByStatus";
import { TasksPerEmployee } from "@/components/reports/TasksPerEmployee";
import { TaskPoints } from "@/components/reports/TaskPoints";
import { RoleDistribution } from "@/components/reports/RoleDistribution";

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
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
        <h1 className="text-2xl font-bold mb-2 md:mb-0">Reports</h1>
        <button
          onClick={handleExport}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Export
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <EmployeeCountPerOrg />
        </div>
        <div className="border rounded-lg p-4">
          <ActiveVsArchivedEmployees />
        </div>
        <div className="border rounded-lg p-4 md:col-span-3">
          <ProjectsPerOrg />
        </div>
        <div className="border rounded-lg p-4">
          <TasksByStatus />
        </div>
        <div className="border rounded-lg p-4">
          <RoleDistribution />
        </div>
        <div className="border rounded-lg p-4 md:col-span-3">
          <TasksPerEmployee />
        </div>
        <div className="border rounded-lg p-4 md:col-span-3">
          <TaskPoints />
        </div>
      </div>
    </div>
  );
}