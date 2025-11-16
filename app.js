require("dotenv").config();
const path = require("path");
const express = require("express");
const { Pool } = require("pg");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: "cats",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.session());

app.get("/", (req, res) => {
  res.render("index", { user: req.user }); // User object from deserialize
});

app.get("/sign-up", (req, res) => {
  res.render("sign-up-form");
});

app.post("/sign-up", async (req, res, next) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10); // Hash password before input to database
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [req.body.username, hashedPassword]);
    res.redirect("/");
  } catch (err) {
    return next(err);
  }
});

app.post(
  "/log-in",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
  })
);

app.get("/log-out", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// Runs when user try to login
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
      const user = rows[0];

      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password); // Hash the password from user input then compares it to the password in database
      if (!passwordMatch) {
        return done(null, false, { message: "Incorrect password" });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Serialize the user object to an id and sends it as cookie to browser
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Browser sends the id to express which then used to access the user object and then runs the rest of the application with that user object
passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    const user = rows[0];

    done(null, user);
  } catch (err) {
    done(err);
  }
});

app.listen(3000, (error) => {
  if (error) {
    throw error;
  }
  console.log("app listening on port 3000");
});
