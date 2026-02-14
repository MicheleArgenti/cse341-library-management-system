const express = require('express');
const mongodb = require('./data/database.js');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const passport = require('passport');
const session = require('express-session');
const GitHubStrategy = require('passport-github2').Strategy;
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app
  .use(bodyParser.json())
  .use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
  }))

  .use(passport.initialize())

  .use(passport.session())

  .use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      "Origin, X-Requested-With, Content-Type, Accept, Z-Key, Authorization"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "POST, GET, PUT, PATCH, OPTIONS, DELETE"
    );
    next();
  })
  .use(cors({ methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'] }))
  .use(cors({ oring: '*'}))
  .use('/', require('./routes'))

//  passport.use(new GitHubStrategy({
//    clientID: process.env.GITHUB_CLIENT_ID,
//    clientSecret: process.env.GITHUB_CLIENT_SECRET,
//    callbackURL: process.env.CALLBACK_URL
//  },
//  function(accessToken, refreshToken, profile, done) {
//    return done(null, profile);
//  }
//  ));

// passport.serializeUser((user, done) => {
//   done(null, user);
// });
// passport.deserializeUser((user, done) => {
//   done(null, user);
// });

// app.get('/', (req, res) => { res.send(req.session.user !== undefined ? `Logged in as ${req.session.user.displayName}` : 'Logged Out'); });
// app.get('/github/callback', passport.authenticate('github', {
//   failureRedirect: '/api-docs', session: false}),
//   (req, res) => {
//   req.session.user = req.user;
//   res.redirect('/');
// });


mongodb.initDb((err) => {
  if (err) {
    console.log('Failed to connect to database');
  } else {
    app.listen(port, () => { 
      console.log(`Database is listening and node is running on port ${port}`);
    });
  }
});