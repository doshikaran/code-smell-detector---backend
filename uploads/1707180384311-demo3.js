// Function to log a user's login
function logUserLogin1(userId) {
    const time = new Date().toISOString();
    console.log(`User ${userId} logged in at ${time}`);
}

// Similar functionality but for logout
function logUserLogout1(userId) {
    const time = new Date().toISOString();
    console.log(`User ${userId} logged out at ${time}`);
}
