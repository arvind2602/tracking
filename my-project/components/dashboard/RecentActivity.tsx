'use client';

import { useQuery } from '@tanstack/react-query';

import axios from '@/lib/axios';

async function getRecentActivity() {
  const res = await axios.get('/performance/recent-activity');
  return res.data;
}

interface Activity {
  id: string;
  user: string;
  time: string;
  action: string;
  target: string;
}

export function RecentActivity() {
  const { data, isLoading, error } = useQuery<Activity[]>({
    queryKey: ['recentActivity'],
    queryFn: getRecentActivity,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading data</div>;

  return (
    <div>
      <h3 className="text-lg font-medium">Recent Activity</h3>
      <ul className="divide-y divide-gray-200">
        {data?.map((activity: Activity) => (
          <li key={activity.id} className="py-4">
            <div className="flex space-x-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{activity.user}</h3>
                  <p className="text-sm text-gray-500 md:hidden">{activity.time}</p>
                  <p className="hidden md:block text-sm text-gray-500">{activity.time}</p>
                </div>
                <p className="text-sm text-gray-500">
                  {activity.action} {activity.target}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
