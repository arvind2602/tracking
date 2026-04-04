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

    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const screen = window.screen;
    const pixelRatio = window.devicePixelRatio || 1;
    
    let browserName = "Unknown";
    if (ua.indexOf("Firefox") > -1) browserName = "Firefox";
    else if (ua.indexOf("SamsungBrowser") > -1) browserName = "Samsung Browser";
    else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browserName = "Opera";
    else if (ua.indexOf("Trident") > -1) browserName = "IE";
    else if (ua.indexOf("Edge") > -1) browserName = "Edge";
    else if (ua.indexOf("Chrome") > -1) browserName = "Chrome";
    else if (ua.indexOf("Safari") > -1) browserName = "Safari";

    // More specific hardware telemetry
    const cores = (navigator as any).hardwareConcurrency || 'N/A';
    const memory = (navigator as any).deviceMemory || 'N/A'; // GB
    const language = navigator.language;

    return {
        deviceName: `${browserName} on ${platform} (${cores} CPU, ${memory}GB RAM)`,
        deviceType: /Mobile|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop',
        browser: browserName,
        os: platform,
        resolution: `${screen.width}x${screen.height}`,
        pixelRatio,
        language,
        cores,
        memory
    };
};
