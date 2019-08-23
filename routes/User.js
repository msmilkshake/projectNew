const express = require("express");
const router = express.Router();
const User = require("../model/users");
const Complain = require("../model/complain");
const Seq = require("sequelize");
const Op = Seq.Op;
const bcrypt = require("bcryptjs");
const passport = require("passport");
const isUserAuthenticated = require("../configs/auth").u;
const sendgrid = require("../configs/email");
const crypto = require("crypto");
const uuid4 = require("uuid/v4");
const r = require("../configs/redditapi");

const { userAuth } = require("../configs/passport");
userAuth(passport);

// const auth = userAuth(passport);

router.get("/login", (req, res) => {
  res.render("users/login", {
    title: "Sarokaar | Login",
    layout: "layouts/layout2.ejs"
  });
});

router.get("/logout", (req, res) => {
  req.logOut();
  req.flash("success_msg", "you are logged out");
  res.redirect("/user/login");
  console.log("user session destroyed");
});

router.post("/password-verify", (req, res) => {
  const { password, cpassword, userId, token } = req.body;
  if (password.length >= 6 && password == cpassword) {
    User.findOne({
      where: {
        [Op.and]: [
          {
            resetToken: token
          },
          {
            resetTokenExpiry: { [Op.gte]: Date.now() }
          },
          {
            email: userId
          }
        ]
      }
    })
      .then(user => {
        const resetUser = user;
        bcrypt
          .hash(password, 10)
          .then(hash => {
            resetUser.password = hash;
            resetUser.resetTokenExpiry = undefined;
            resetUser.resetToken = undefined;
            resetUser
              .save()
              .then(user => {
                req.flash("success_msg", "successfully changed password");
                res.redirect("/user/login");
              })
              .catch(err => console.log(err));
          })
          .catch(err => console.log(err));
      })
      .catch(err => console.log(err));
  } else {
    req.flash(
      "error_msg",
      "passwords must be 6 or more characters long and must match"
    );
    res.redirect("/user/create-new-password");
  }
});

router.post("/home", async (req, res, next) => {
  let { email, password } = req.body;
  if (email == "" || password == "") {
    req.flash("error_msg", "please fill in all fields");
    res.redirect("/user/login");
  }

  passport.authenticate("user-local", (err, user, info) => {
    if (err) {
      return next(err);
      // req.flash("error_msg", "authentication failed.");
      // res.redirect("/user/login");
    }
    if (user) {
      req.login(user, async err => {
        if (err) {
          return next(err);
        }
        const sr1 = await r.getSubreddit("DeTrashed").getHot();
        const sr2 = await r.getSubreddit("pics").getHot();
        const sr3 = await r.getSubreddit("TrashTag").getHot();
        const posts = [...sr1, ...sr2, ...sr3];
        console.log(posts.length);
        const filteredposts = posts.filter(post => {
          const pat1 = new RegExp(/#TrashTag|garbage|sewage|trash|clean/gi);
          const pat2 = new RegExp(/.jpg$|.png$|.gif$/);
          return post.title.match(pat1) && post.url.match(pat2);
        });
        console.log(filteredposts.length);
        res.render("users/home", {
          Zposts: filteredposts,
          user,
          layout: "layouts/users"
        });
      });
    } else {
      req.flash("error_msg", info.message);
      return res.redirect("/user/login");
    }
  })(req, res, next);
});

router.get("/home", isUserAuthenticated, (req, res) => {
  res.redirect("users/home", {
    layout: "layouts/users",
    // user
    user: req.user
  });
});

router.get("/settings", isUserAuthenticated, (req, res) => {
  res.render("users/settings", {
    layout: "layouts/users",
    user: req.user
    // user
  });
});

router.post("/settings", (req, res) => {
  const { uname, email, mobile, password, image } = req.body;
  const pic = req.file;
  User.findOne({
    where: {
      id: req.session.user.id
    }
  }).then(user => {
    if (pic) {
      image = `../uploads/admins/${pic.filename}`;
    }
    if (user) {
      if (password) {
        if (password === cpassword) {
          hash = bcrypt.hashSync(password, 10);
          user.uname = uname;
          user.email = email;
          user.mobile = mobile;
          user.password = hash;
          user.image = image;
          user.save().then(result => {
            if (result.email != email) {
              req.logOut();
              req.flash("success_msg", "sucess. login to continue");
              res.status(200).redirect("/user/login");
            } else {
              req.flash("success_msg", "successfully changed admin info");
              res.status(200).redirect("/user/settings");
            }
          });
        } else {
          req.flash("error_msg", "please match both passwords");
          res.redirect("/user/settings");
        }
      }
      user.uname = uname;
      user.email = email;
      user.image = image;
      user
        .save()
        .then(result => {
          if (result.email != email) {
            req.logOut();
            req.flash("success_msg", "sucess. login to continue");
            res.status(200).redirect("/user/login");
          } else {
            req.flash("success_msg", "successfully changed");
            res.redirect("/user/settings");
          }
        })
        .catch(err => console.log(err));
    }
  });
});

router.get("/handle-forgot-password", (req, res) => {
  const email = req.query.email;
  User.findOne({
    where: {
      email
    }
  })
    .then(user => {
      if (user) {
        crypto.randomBytes(32, (err, buffer) => {
          if (err) throw err;
          const token = buffer.toString("hex");
          user.resetToken = token;
          user.resetTokenExpiry = Date.now() + 3600000;
          user.save().then(result => {
            sendgrid(
              email,
              "sovanshahihero@gmail.com",
              "email account verification for changing password for Sarokaar",
              `<!DOCTYPE html>
          <html>
            <head>
              <title>Hi</title>
            </head>
            <body>
              click <a href="http://localhost:3000/user/create-new-password/${token}" target="_blank">here</a>
              to verify your account
            </body>
          </html>`
            );

            req.flash("link", email);
            res.redirect("/user/forgot-password");
          });
        });
      } else {
        req.flash("error_msg", "invalid email");
        res.redirect("/user/forgot-password");
      }
    })
    .catch(err => console.log(err));
});

router.get("/forgot-password", (req, res) => {
  res.render("users/forgot-password", {
    layout: "layouts/layout2.ejs",
    title: "reset password"
  });
});

router.get("/create-new-password/:token", (req, res) => {
  User.findOne({
    where: {
      [Op.and]: [
        {
          resetToken: req.params.token
        },
        {
          resetTokenExpiry: { [Op.gte]: Date.now() }
        }
      ]
    }
  }).then(user => {
    res.render("users/create-new-password", {
      token: user.resetToken,
      userId: user.email,
      layout: "layouts/layout2.ejs",
      title: "create new password"
    });
  });
});

router.get("/complain-form", isUserAuthenticated, (req, res) => {
  res.render("users/complain-form", {
    layout: "layouts/users.ejs",
    user: req.user
    // user
  });
});

router.post("/upload", (req, res) => {
  let { title, location, description } = req.body;
  const myImage = req.file;
  let errors = [];
  if (!myImage) {
    errors.push({ msg: "Error: No File Selected!" });
    res.status(422).render("users/complain-form", {
      layout: "layouts/users.ejs",
      // user: req.session.user,
      user: req.user,
      errors
    });
  }
  const imageUrl = `../uploads/${myImage.filename}`;
  let d = new Date();
  const date = d.toDateString();
  const pid = uuid4();
  Complain.create({
    cid: pid,
    title,
    description,
    image: imageUrl,
    createdBy: req.user.email,
    dateCreated: date
  })
    .then(result => {
      req.flash("success_msg", "complaint uploaded");
      res.status(200).redirect("/user/complain-form");
    })
    .catch(err => console.log(err));
});

router.get("/history", isUserAuthenticated, (req, res) => {
  Complain.findAll({ where: { createdBy: req.user.email } })
    .then(complains => {
      complains.forEach(complain => {});
      res.render("users/history", {
        complains,
        // user: req.session.user,
        user: req.user,
        layout: "layouts/users.ejs"
      });
    })
    .catch(err => {
      console.log(err);
    });
});

router.get("/register", (req, res) => {
  res.render("users/register", {
    title: "register",
    layout: "layouts/layout2.ejs"
  });
});

router.post("/register", (req, res) => {
  const { uname, email, mobile, password, cpassword, gender } = req.body;
  const males = ["/uploads/users/um1.png", "/uploads/users/um2.png"];
  const females = ["/uploads/users/ufm1.png", "/uploads/users/ufm2.png"];
  let errors = [];
  if (uname == "" || email == "") {
    errors.push({ msg: "please fill in all the fields" });
  }

  if (!mobile.match(/^[0-9]{10}$/)) {
    errors.push({ msg: "mobile number should be 10 digit" });
  }

  if (password.length < 6) {
    errors.push({ msg: "password must be atleast 6 characters long!" });
  }

  if (cpassword != password) {
    errors.push({ msg: "please match the password fields" });
  }

  if (errors.length > 0) {
    res.render("users/register", {
      title: "registration invalid",
      layout: "layouts/layout2.ejs",
      errors,
      uname,
      email,
      mobile,
      password,
      cpassword
    });
  } else {
    User.findOne({
      where: {
        email
      }
    })
      .then(user => {
        if (!user) {
          const hash = bcrypt.hashSync(password, 10);
          const getpicmale = males[Math.ceil(Math.random() * 2) - 1];
          const getpicfemale = females[Math.ceil(Math.random() * 2) - 1];
          const id = uuid4();
          User.create({
            id,
            uname,
            email,
            gender: gender == "male" ? 1 : 0,
            mobile,
            password: hash,
            image: gender == "male" ? getpicmale : getpicfemale
          })
            .then(user => {
              req.flash(
                "success_msg",
                "successfully registered. login to contiue"
              );
              res.redirect("/user/login");
            })
            .catch(err => {
              console.log(err);
            });
        } else {
          errors.push({ msg: "email already exists in our system" });
          res.render("users/register", {
            layout: "layouts/layout2",
            errors,
            title: "invalid entries"
          });
        }
      })
      .catch(err => {
        console.log(err);
      });
  }
});

module.exports = router;
