'use client';

import { useQuery } from '@tanstack/react-query';
import axios from '@/lib/axios';
import { useState } from 'react';

async function getTaskPoints() {
  const res = await axios.get('/reports/task-points');
  return res.data;
}

interface TaskPointsData {
  data: any[];
  employees: string[];
}

interface HeatmapCell {
  employee: string;
  project: string;
  points: number;
}

export function TaskPoints() {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const { data, isLoading, error } = useQuery<TaskPointsData>({
    queryKey: ['taskPoints'],
    queryFn: getTaskPoints,
  });

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;
  if (error) return <div className="text-destructive">Error loading data</div>;

  // Transform data for heatmap
  const projects = data?.data || [];
  const employees = data?.employees || [];

  // Calculate max points for color scaling
  let maxPoints = 0;
  projects.forEach(project => {
    employees.forEach(emp => {
      const points = project[emp] || 0;
      if (points > maxPoints) maxPoints = points;
    });
  });

  // Color scale function - from light to dark based on points
  const getColor = (points: number) => {
    if (points === 0) return 'hsl(var(--muted))';
    const intensity = points / maxPoints;

    // Using a blue-purple gradient scale
    if (intensity < 0.2) return 'hsl(220, 70%, 95%)';
    if (intensity < 0.4) return 'hsl(220, 75%, 80%)';
    if (intensity < 0.6) return 'hsl(220, 80%, 65%)';
    if (intensity < 0.8) return 'hsl(220, 85%, 50%)';
    return 'hsl(220, 90%, 35%)';
  };

  const getTextColor = (points: number) => {
    if (points === 0) return 'hsl(var(--muted-foreground))';
    const intensity = points / maxPoints;
    return intensity > 0.5 ? '#ffffff' : 'hsl(var(--foreground))';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Task Points per Project and Employee</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Low</span>
          <div className="flex gap-1">
            <div className="w-6 h-4 rounded" style={{ backgroundColor: 'hsl(220, 70%, 95%)' }} />
            <div className="w-6 h-4 rounded" style={{ backgroundColor: 'hsl(220, 75%, 80%)' }} />
            <div className="w-6 h-4 rounded" style={{ backgroundColor: 'hsl(220, 80%, 65%)' }} />
            <div className="w-6 h-4 rounded" style={{ backgroundColor: 'hsl(220, 85%, 50%)' }} />
            <div className="w-6 h-4 rounded" style={{ backgroundColor: 'hsl(220, 90%, 35%)' }} />
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/50 backdrop-blur-sm border-b border-r px-2 py-2 md:px-4 md:py-3 text-left text-[10px] md:text-sm font-semibold min-w-[100px] md:min-w-[150px]">
                    Employee
                  </th>
                  {projects.map((project) => (
                    <th
                      key={project.name}
                      className="border-b px-2 py-2 md:px-4 md:py-3 text-center text-[10px] md:text-sm font-semibold min-w-[80px] md:min-w-[120px] bg-muted/30"
                    >
                      <div className="truncate" title={project.name}>
                        {project.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee, empIndex) => (
                  <tr key={employee} className="hover:bg-muted/20 transition-colors">
                    <td className="sticky left-0 z-10 bg-card backdrop-blur-sm border-r px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-sm font-medium">
                      <div className="truncate" title={employee}>
                        {employee}
                      </div>
                    </td>
                    {projects.map((project) => {
                      const points = project[employee] || 0;
                      return (
                        <td
                          key={`${employee}-${project.name}`}
                          className="border-l relative group cursor-pointer transition-all"
                          style={{
                            backgroundColor: getColor(points),
                          }}
                          onMouseEnter={() => setHoveredCell({ employee, project: project.name, points })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className="px-2 py-2 md:px-4 md:py-3 text-center text-[10px] md:text-sm font-semibold"
                            style={{ color: getTextColor(points) }}
                          >
                            {points > 0 ? points : '-'}
                          </div>

                          {/* Tooltip */}
                          {hoveredCell?.employee === employee && hoveredCell?.project === project.name && (
                            <div className="absolute z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-lg shadow-lg text-sm whitespace-nowrap pointer-events-none">
                              <div className="font-semibold text-foreground">{employee}</div>
                              <div className="text-muted-foreground">{project.name}</div>
                              <div className="font-bold text-primary mt-1">{points} points</div>
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-popover" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">{employees.length}</span> Employees
        </div>
        <div>
          <span className="font-medium text-foreground">{projects.length}</span> Projects
        </div>
        <div>
          <span className="font-medium text-foreground">{maxPoints}</span> Max Points
        </div>
      </div>
    </div>
  );
}
