'use client';

import { useQuery } from '@tanstack/react-query';

import axios from '@/lib/axios';
import Link from 'next/link';

async function getRecentActivity() {
  const res = await axios.get('/performance/recent-activity');
  return res.data;
}

interface Activity {
  id: string;
  userId: string;
  projectId: string;
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
      <h3 className="text-lg font-medium mb-4">Recent Activity</h3>
      <ul className="divide-y divide-border">
        {data?.map((activity: Activity) => (
          <li key={activity.id} className="py-4">
            <div className="flex space-x-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {activity.userId ? (
                      <Link href={`/dashboard/users/${activity.userId}`} className="hover:text-primary hover:underline transition-colors">
                        {activity.user}
                      </Link>
                    ) : (
                      activity.user
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground md:hidden">{activity.time}</p>
                  <p className="hidden md:block text-sm text-muted-foreground">{activity.time}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {activity.action}{' '}
                  {activity.projectId ? (
                    <Link href={`/dashboard/projects/${activity.projectId}`} className="text-foreground hover:text-primary hover:underline transition-colors font-medium">
                      {activity.target}
                    </Link>
                  ) : (
                    activity.target
                  )}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
