const { query, shutdownPool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const LOG_TYPES = ['WORK', 'LUNCH', 'BREAK', 'WASHROOM', 'PERSONAL_EMERGENCY', 'HOME', 'OTHER'];
const OFFICE_LAT = 28.6139;
const OFFICE_LNG = 77.2090;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedAttendance() {
    console.log('Starting attendance seed...');

    try {
        // 1. Get Employees
        const empResult = await query('SELECT id FROM employee');
        const employees = empResult.rows;

        if (employees.length === 0) {
            console.log('No employees found. Please create employees first.');
            return;
        }

        const logsToInsert = [];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30); // Last 30 days

        for (let i = 0; i < 50; i++) {
            const empId = employees[getRandomInt(0, employees.length - 1)].id;
            const type = LOG_TYPES[getRandomInt(0, LOG_TYPES.length - 1)];

            // Random check-in time
            const checkIn = getRandomDate(startDate, endDate);

            // Random duration (5 mins to 9 hours)
            let checkOut = null;
            const durationMinutes = getRandomInt(5, 540);

            // 90% chance to be checked out, 10% active
            const isCompleted = Math.random() > 0.1;

            if (isCompleted) {
                checkOut = new Date(checkIn.getTime() + durationMinutes * 60000);
                // Ensure checkout isn't in the future
                if (checkOut > new Date()) {
                    checkOut = new Date(); // Cap at now
                }
            }

            // Random location (within 20m of office roughly, some outliers)
            // 0.0001 deg is roughly 11 meters
            const isNear = Math.random() > 0.1; // 90% near
            const latOffset = isNear ? getRandomFloat(-0.0001, 0.0001) : getRandomFloat(-0.01, 0.01);
            const lngOffset = isNear ? getRandomFloat(-0.0001, 0.0001) : getRandomFloat(-0.01, 0.01);

            const latitude = OFFICE_LAT + latOffset;
            const longitude = OFFICE_LNG + lngOffset;

            // Device
            const deviceId = uuidv4().substring(0, 18); // Shortened UUID for variety
            const deviceType = Math.random() > 0.5 ? 'Mozilla/5.0 (Mobile)' : 'Mozilla/5.0 (Desktop)';
            const reason = type === 'WORK' ? null : `Random reason ${i}`;

            await query(
                `INSERT INTO "TimeLog" ("employeeId", "checkIn", "checkOut", "type", "reason", "latitude", "longitude", "deviceId", "deviceType", "createdAt")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [empId, checkIn, checkOut, type, reason, latitude, longitude, deviceId, deviceType, checkIn]
            );
        }

        console.log('Successfully inserted 50 dummy attendance logs.');

    } catch (err) {
        console.error('Error seeding attendance:', err);
    } finally {
        await shutdownPool();
    }
}

seedAttendance();
