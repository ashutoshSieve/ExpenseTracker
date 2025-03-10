require("dotenv").config();
const express=require("express");
const ejs=require("ejs");
const bodyParser=require("body-parser");
const passport=require("passport");
const session=require("express-session");
const MongoStore=require("connect-mongo");
const User=require("./dataBase.js");
const dates=require("./date.js");
const sums=require("./total.js");

const app=express();
app.use(bodyParser.urlencoded({extended:true}));
app.set("view engine", "ejs");
app.use(express.static("public"));


app.set('trust proxy', 1) 
app.use(session({
    secret: process.env.AUTH,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({mongoUrl: process.env.URL, collectionName: "session"}),
    cookie: {
        maxAge:1000*60*60*24
    }
}));

require("./googleAuth.js");
require("./passport.js");
app.use(passport.initialize());
app.use(passport.session());


app.get("/", function(req,res){
    res.render("home");
});


app.get("/track", function(req, res) {
    const today = dates();

    if (req.isAuthenticated()) {
        let price;
        const expenseToday = req.user.expense.find(element => element.title === today);

        sums(today, req.user._id)
            .then(total => {
                price = total;

                if (expenseToday) {
                    return res.render("tracker", {
                        date: expenseToday.title,
                        content: expenseToday.items,
                        user: req.user.name,
                        data: price
                    });
                } else {
                    return res.render("tracker", {
                        date: today,
                        content: [],
                        user: req.user.name,
                        data: price
                    });
                }
            })
            .catch(err => {
                console.error(err);
                res.render("error", {message: "Error calculating totals. Please try again later."});
            });
    } else {
        res.redirect("/login");
    }
});


app.get("/logout", function(req,res){
    req.logout(function(err){
        if(err){return next(err);}
        res.redirect("/");
    });
});


app.get('/google', passport.authenticate('google', { scope: ['profile'] }));
  
app.get('/auth/callback', 
    passport.authenticate('google', { failureRedirect: "/", successRedirect: "/track" }));


app.get("/register", function(req,res){
    res.render("register");
});

app.get("/login", function(req,res){
    res.render("login");
});

app.get("/updatedTrack", function(req,res){
    if(req.isAuthenticated()){
        let price;
        User.findById(req.user._id).then((result) => {
            if(result){
                sums(req.session.title, req.user._id)
                .then(total => {
                    price = total; 
                    return res.render("tracker", {
                        date: req.session.title,
                        content: result.expense.find(exp => exp.title === req.session.title).items,
                        user: req.user.name,
                        data: price // Pass the resolved price data
                    });
                });
            }else{
                res.render("error", {message: "User not Found!!"});
            }
        }).catch((err) => {
            console.log(err);
            res.render("error", {message: "Invalid Credentials."});
        });
    }else{
        return res.redirect("/");
    }
});

app.post("/register", function(req,res){
    User.findOne({email: req.body.email})
    .then((results) => {
        if (results) {
            res.render("error", {message:"Email Already Exist !."});
        } else {
            const newUser = new User({
                name: req.body.name,
                email: req.body.email,
                password: req.body.password
            });
            
            newUser.save().then(() => {
                // Log in the user immediately after signup
                req.login(newUser, (err) => {
                    if (err) {
                        console.log(err);
                        return res.redirect("/"); // Handle the error appropriately
                    }
                    res.redirect("/track");
                });
            }).catch(err => console.log(err));
        }
    })
    .catch((err) => {
        console.error(err);
        res.render("error", {message:"Error finding the user."});
    });

});

app.post("/login", passport.authenticate("local", {
    successRedirect:"/track",
    failureRedirect:"/"
}));

app.post("/addItems", function(req, res) {
    const price = req.body.price;
    const item = req.body.item;
    const expenseTitle = dates();


    if(req.isAuthenticated()){
        const expense = req.user.expense.find(exp => exp.title === expenseTitle);

        if (expense) {
            expense.items.push({ item: item, price: price });
        } else {
            // Add a new expense entry with title and item
            req.user.expense.push({
                title: expenseTitle,
                items: [{ item: item, price: price }]
            });
        }

        req.user.save().then(() => {
            return res.redirect("/track");  
        });
    }else{
        res.redirect("/");
    }
});


app.post("/search", function(req, res) {
    const dateToFind = req.body.search;
    
    if(req.isAuthenticated()){
        const expenseFound = req.user.expense.find(expense => expense.title === dateToFind);

        if (expenseFound) {
            // Redirect to the tracker page with the found expense
            req.session.title=expenseFound.title;
            res.redirect("/updatedTrack");
        }else{
            res.render("error", {message:" date not found."});
        }
    }else{
        res.redirect("/");
    } 
});

app.post("/delete", function(req, res) {
    if (req.isAuthenticated()) {
        const itemToDeleteId = req.body.delete; 
        const page = req.body.page; 
        
        User.findById(req.user._id).then(user => {

            const expense = user.expense.find(exp => exp.title === page);
            req.session.title=expense.title;

            const itemIndex = expense.items.findIndex(item => item._id.toString() === itemToDeleteId);

            if(expense.items.length>0){
                expense.items.splice(itemIndex, 1);
                user.save();
            }
            res.redirect("/updatedTrack");
        });
    } else {
        res.render("error", {message: "You are not logged in !!."});
    }
});

app.get("/details", async function (req, res) {
    if (req.isAuthenticated()) {
        try {
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.render("error", { message: "User not found!" });
            }

            const today = new Date();
            const last7Days = new Date(today);
            last7Days.setDate(today.getDate() - 7);
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            let weeklyItems = [];
            let monthlyItems = [];

            user.expense.forEach(exp => {
                // Convert "Monday, March 10" into a valid date
                let fullDateStr = `${exp.title}, ${today.getFullYear()}`;
                let expDate = new Date(fullDateStr);

                exp.items.forEach(item => {
                    let itemDetails = {
                        name: item.item, 
                        price: item.price,
                        date: exp.title 
                    };

                    // Weekly Expense Collection (last 7 days)
                    if (expDate >= last7Days && expDate <= today) {
                        weeklyItems.push(itemDetails);
                    }

                    // Monthly Expense Collection (current month)
                    if (expDate >= firstDayOfMonth && expDate <= today) {
                        monthlyItems.push(itemDetails);
                    }
                });
            });

            res.render("details", {
                user: req.user.name,
                weeklyItems,
                monthlyItems
            });

        } catch (err) {
            console.error("Error fetching expense details:", err);
            res.render("error", { message: "Error fetching expense details." });
        }
    } else {
        res.redirect("/login");
    }
});


app.listen(process.env.PORT, function(){
    console.log("server is running on port 3000!!");
});
