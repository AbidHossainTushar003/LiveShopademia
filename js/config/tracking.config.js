// Tracking setup: paste IDs and flip `enabled`. Nothing loads while enabled is false or the ID is empty.
export const trackingConfig = Object.freeze({
    debug: true, // logs every tracking event to the browser console; set false in production
    metaPixel: { enabled: false, pixelId: '' },  // e.g. '123456789012345'
    googleTag: { enabled: false, tagId: '' }     // e.g. 'G-XXXXXXXXXX' (GA4) or 'AW-XXXXXXXXX' (Ads)
});
