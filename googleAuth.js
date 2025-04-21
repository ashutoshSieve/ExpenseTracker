require("dotenv").config();
const UserModel=require("./dataBase.js");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport=require("passport");


passport.use(new GoogleStrategy({
    clientID: process.env.ID,
    clientSecret: process.env.SECRET,
    callbackURL: "https://driving-elspeth-ashutoshserver-54c4997a.koyeb.app/auth/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    UserModel.findOne({google_id: profile.id }).then(user => {
        
        if (user) {
            return cb(null, user);
        } else {
            const newUser = new UserModel({
                google_id: profile.id,
                name: profile.displayName
            });
            newUser.save().then(user => {
                return cb(null, user);
            }).catch(err => {
                return cb(err, null);
            });
        }
    }).catch(err => {
        return cb(err, null);
    });
  }
));


// Serialize and deserialize user for session support
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    UserModel.findById(id).then((results,err) =>{
        done(err, results);
    });
});

