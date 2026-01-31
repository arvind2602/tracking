export const getProxiedImageUrl = (url: string) => {
    if (!url) return '';
    // Don't proxy base64 or blob URLs
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    // If it's already proxied, return as is
    if (url.includes('images.weserv.nl')) return url;

    // Clean the URL (remove local double slashes that might break the proxy)
    const cleanUrl = url.replace(/([^:])\/\//g, '$1/');

    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&default=${encodeURIComponent(url)}`;
};
