/**
 * Generates a reasonably stable device identifier for the browser.
 * Note: For production, consider using a dedicated library like FingerprintJS.
 */
export const getDeviceId = (): string => {
    if (typeof window === 'undefined') return '';

    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
        const userAgent = navigator.userAgent;
        const language = navigator.language;
        const entropy = Math.random().toString(36).substring(2, 10);

        // Simple hash-like string
        deviceId = `dev_${btoa(`${userAgent}|${screenInfo}|${language}|${entropy}`).substring(0, 32)}`;
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
};

export const getDeviceInfo = () => {
    if (typeof window === 'undefined') return {};

    return {
        deviceName: 'Web Browser',
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        browser: navigator.userAgent.split(' ')[0],
        os: navigator.platform
    };
};
