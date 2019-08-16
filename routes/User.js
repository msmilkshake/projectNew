const express = require("express");
const router = express.Router();
const User = require("../model/users");
const Complain = require("../model/complain");
const Seq = require("sequelize");
const Op = Seq.Op;
const bcrypt = require("bcryptjs");
const passport = require("passport");
// const { ensureAuthenticated } = require("../configs/auth");
const ensureLoggedIn = require("connect-ensure-login").ensureLoggedIn;
const sendgrid = require("../configs/email");
const crypto = require("crypto");

router.get("/login", (req, res) => {
  res.render("users/login", {
    title: "Sarokaar | Login",
    layout: "layouts/layout2.ejs"
  });
});

router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "you are logged out");
  res.redirect("/user/login");
});

router.post("/password-verify", (req, res) => {
  const { password, cpassword,userId, token } = req.body;
  if (password.length >= 6 && password == cpassword) {
    User.findOne({
    where: {[Op.and]: [{
      resetToken: token
    },{
      resetTokenExpiry: {[Op.gte]: Date.now()}
    },{
      email: userId
    }
  ]}
  })
    .then(user=>{
      const resetUser = user;
      bcrypt.hash(password,10)
        .then(hash=>{
          resetUser.password = hash;
          resetUser.resetTokenExpiry = undefined;
          resetUser.resetToken = undefined;
          resetUser.save()
            .then((user)=>{
              req.flash("success_msg", "successfully changed password");
              res.redirect("/user/login");
            })
            .catch(err=> console.log(err));
        })
        .catch(err => console.log(err));
    })
    .catch(err=> console.log(err));
  } else {
    req.flash(
      "error_msg",
      "passwords must be 6 or more characters long and must match"
    );
    res.redirect("/user/create-new-password");
  }
});

router.post("/home", (req, res, next) => {
  let { email, password } = req.body;
  if (email == "" || password == "") {
    req.flash("error_msg", "please fill in all fields");
    res.redirect("/user/login");
  }

  passport.authenticate("user-local", (err, user, info) => {
    if (err) {
      req.flash("error_msg", "authentication failed.");
      res.redirect("/user/login");
    }
    if (user) {
      req.session.user = user;
      res.render("users/home", {
        user,
        layout: "layouts/users"
      });
      // res.redirect("/user/home");
    } else {
      req.flash("error_msg", info.message);
      res.redirect("/user/login");
    }
  })(req, res, next);
});

router.get("/home", (req, res) => {
  res.render("users/home", {
    layout: "layouts/users",
    user: req.session.user
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
        crypto.randomBytes(32,(err,buffer)=>{
          if(err) throw err;
          const token = buffer.toString('hex');
          user.resetToken = token;
          user.resetTokenExpiry = Date.now() + 3600000;
          user.save()
            .then(result =>{
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
            })
        })
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
    where: {[Op.and]: [{
      resetToken: req.params.token
    },{
      resetTokenExpiry: {[Op.gte]: Date.now()}
    }
  ]}
  })
    .then(user=>{
      res.render("users/create-new-password", {
      token:user.resetToken,
      userId: user.email,
      layout: "layouts/layout2.ejs",
      title: "create new password"
    });
  })
});

router.get("/complain-form", (req, res) => {
  res.render("users/complain-form", {
    layout: "layouts/users.ejs",
    user: req.session.user
  });
});

// router.post("/complain-form", (req, res) => {
//   let { title, location, description } = req.body;
//   // let { myImage } = req.file;
//   console.log(title);
//   upload(req, res, err => {
//     if (err) {
//       res.redirect("/user/home");
//       // res.render("users/home", {
//       //   title: "error",
//       //   msg: err,
//       //   layout: "layouts/main.ejs"
//       // });
//     } else {
//       if (req.file == "undefined") {
//         res.render("users/complainform", {
//           title: "error",
//           msg: "Error: No File Selected!",
//           layout: "layouts/main.ejs"
//         });
//       } else {
//         res.redirect("users/complainform", {
//           title: "uploading",
//           msg: "File Uploaded!",
//           file: `../uploads/${req.file.filename}`,
//           layout: "layouts/main.ejs"
//         });
//       }
//     }
//   });
// });

router.get("/register", (req, res) => {
  res.render("users/register", {
    title: "register",
    layout: "layouts/layout2.ejs"
  });
});

router.post("/register", (req, res) => {
  let { uname, email, mobile, password, cpassword } = req.body;
  let errors = [];

  if (uname == "" || email == "" || mobile == "" || password == "") {
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
          password = hash;
          User.create({
            uname,
            email,
            mobile,
            password
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
