const UserModel = require("./dataBase.js");

module.exports = function (date, user_id) {
    // Date format: Saturday, October 5
    const today = new Date(date); // Parse the input date
    const startOfWeek = new Date(today);
    const startOfMonth = new Date(today);

    // Set startOfWeek to the first day of the week (Sunday or Monday based on your locale)
    startOfWeek.setDate(today.getDate() - today.getDay()); // Adjust to your week start day
    startOfMonth.setDate(1); // Set to the first day of the month

    let total = 0, month = 0, week = 0, day = 0;

    return UserModel.findById(user_id).then((results) => {
        if (!results || !results.expense) return [day, week, month, total];

        // Iterate through the user's expenses
        results.expense.forEach(expense => {
            expense.items.forEach(item => {
                const itemPrice = parseFloat(item.price); // Assuming price is a string, convert to float

                // Assuming expense.title is a valid date string (e.g., "October 5, 2024")
                const expenseDate = new Date(expense.title); 

                // Check if the expense is today
                if (expenseDate.toDateString() === today.toDateString()) {
                    day += itemPrice;
                }

                // Check if the expense is within this week
                if (expenseDate >= startOfWeek && expenseDate <= today) {
                    week += itemPrice;
                }

                // Check if the expense is within this month
                if (expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear()) {
                    month += itemPrice;
                }

                // Final total
                total += itemPrice;
            });
        });

        return [day, week, month, total];
    }).catch(err => {
        return [0, 0, 0, 0]; // Return zeros in case of error
    });
};
