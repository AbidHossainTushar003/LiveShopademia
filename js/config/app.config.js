export const appConfig = Object.freeze({
    apiBaseUrl: 'https://api.shopademia.store/api/v1',
    useMockApi: true,                 // set to false once the real API is live
    delivery: { advanceCharge: 100 }, // PLACEHOLDER: set your real advance delivery charge (BDT)
    bkash: { merchantNumber: '01XXXXXXXXX', accountType: 'Personal' } // PLACEHOLDER: your receiving bKash number
});
