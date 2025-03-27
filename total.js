const UserModel = require("./dataBase.js");

module.exports = function (date, user_id) {
    
    const today = new Date(date); 
    const startOfWeek = new Date(today);
    const startOfMonth = new Date(today);

   
    startOfWeek.setDate(today.getDate() - today.getDay()); 
    startOfMonth.setDate(1); 

    let total = 0, month = 0, week = 0, day = 0;

    return UserModel.findById(user_id).then((results) => {
        if (!results || !results.expense) return [day, week, month, total];

        results.expense.forEach(expense => {
            expense.items.forEach(item => {
                const itemPrice = parseFloat(item.price); 

                const expenseDate = new Date(expense.title); 

                // if the expense is today
                if (expenseDate.toDateString() === today.toDateString()) {
                    day += itemPrice;
                }

                // if the expense is within this week
                if (expenseDate >= startOfWeek && expenseDate <= today) {
                    week += itemPrice;
                }

                // if the expense is within this month
                if (expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear()) {
                    month += itemPrice;
                }

                total += itemPrice;
            });
        });

        return [day, week, month, total];
    }).catch(err => {
        return [0, 0, 0, 0]; 
    });
};
