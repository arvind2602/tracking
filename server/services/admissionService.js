const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const ADMISSION_SERVER_URL = process.env.ADMISSION_SERVER_URL;

/**
 * Authenticates user against the external Admission Server
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<Object>} Admission server response data
 */
const loginToAdmissionServer = async (email, password) => {
    try {
        const response = await axios.post(`${ADMISSION_SERVER_URL}/auth/login`, {
            workEmail: email,
            password
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // The admission server returns { success, message, data: { user, token } }
        // based on the response format seen in QuestionPaperSymbosis
        return response.data;
    } catch (error) {
        if (error.response) {
            // Forward the error message from admission server
            const message = error.response.data?.message || 'Admission Server authentication failed';
            const err = new Error(message);
            err.statusCode = error.response.status;
            throw err;
        }
        throw new Error('Admission Server is unreachable');
    }
};

module.exports = {
    loginToAdmissionServer
};
