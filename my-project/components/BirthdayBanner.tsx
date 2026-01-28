'use client';

import React, { useEffect, useState } from 'react';
import axios from '@/lib/axios';
import { X, Gift } from 'lucide-react';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    dob: string | null;
    image: string | null;
}

export function BirthdayBanner() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [daysUntil, setDaysUntil] = useState<number | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await axios.get('/auth/organization');
                const allEmployees: Employee[] = response.data;

                const today = new Date();
                const currentYear = today.getFullYear();

                // Normalize today to start of day
                today.setHours(0, 0, 0, 0);

                let minDiffDays = Infinity;
                let nextBirthdayEmployees: Employee[] = [];

                allEmployees.forEach(emp => {
                    if (!emp.dob) return;

                    const dobDate = new Date(emp.dob);
                    const birthMonth = dobDate.getMonth();
                    const birthDay = dobDate.getDate();

                    // Create dates for this year and next year
                    const thisYearBirthday = new Date(currentYear, birthMonth, birthDay);
                    const nextYearBirthday = new Date(currentYear + 1, birthMonth, birthDay);

                    // Get the next occurrence
                    let nextBirthday = thisYearBirthday;

                    // If birthday has passed this year (strictly less than today), look at next year
                    if (thisYearBirthday < today) {
                        nextBirthday = nextYearBirthday;
                    }

                    // Calculate difference in milliseconds
                    const diffTime = nextBirthday.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < minDiffDays) {
                        minDiffDays = diffDays;
                        nextBirthdayEmployees = [emp];
                    } else if (diffDays === minDiffDays) {
                        nextBirthdayEmployees.push(emp);
                    }
                });

                if (nextBirthdayEmployees.length > 0) {
                    setEmployees(nextBirthdayEmployees);
                    setDaysUntil(minDiffDays);
                }
            } catch (error) {
                console.error('Failed to fetch employees for birthdays', error);
            }
        };

        fetchEmployees();
    }, []);

    if (employees.length === 0 || daysUntil === null || !isVisible) return null;

    // Format names
    const names = employees.map(b => `${b.firstName} ${b.lastName}`).join(', ');

    return (
        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white relative overflow-hidden transition-all duration-500 ease-in-out shadow-md">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                {/* Simple pattern using CSS radial gradient */}
                <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            </div>
            <div className="container mx-auto px-4 py-3 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                    <Gift className="h-6 w-6 animate-bounce" />
                    <div className="text-sm font-medium">
                        {daysUntil === 0 ? (
                            <span>
                                Happy Birthday to <span className="font-bold">{names}</span>! 🎂 Have a fantastic day!
                            </span>
                        ) : (
                            <span>
                                <span className="font-bold">Upcoming Birthday:</span> {names} in <span className="font-bold">{daysUntil} days</span>! 🎈
                            </span>
                        )}
                    </div>
                </div>

                <button onClick={() => setIsVisible(false)} className="text-white/80 hover:text-white transition-colors">
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
