const Sequelize = require("sequelize");
const db = require("../configs/database");

module.exports = db.define("users", {
  email: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true
  },
  uname: {
    type: Sequelize.STRING,
    allowNull: false
  },
  mobile: {
    type: Sequelize.INTEGER,
    allowNull: true,
    default: "-"
  },
  password: {
    type: Sequelize.STRING,
    allowNull: false
  },
  resetToken: {
    type: Sequelize.STRING,
    allowNull: true
  },
  resetTokenExpiry: {
    type: Sequelize.DATE,
    allowNull: true
  }
});
